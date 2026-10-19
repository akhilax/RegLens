"""analyze_transaction(): features → rules → retrieval → LLM (strict JSON) → guardrails → routing → trace."""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from reglens.audit.chain import append as audit
from reglens.config import get_settings
from reglens.core.models import Account, Customer, Decision, Transaction
from reglens.core.utils import canonical_json, sha256
from reglens.kb.retriever import HybridRetriever, get_retriever
from reglens.llm import prompts
from reglens.llm.providers import LLMProvider, LLMRequest, get_provider
from reglens.llm.schema import LLMAnalysis, parse_analysis
from reglens.pipeline.guardrails import apply_guardrails, score_risk
from reglens.rules.engine import RuleSet, evaluate_rules, flatten, get_ruleset, public_features

REVIEWED_STATES = {"in_review", "awaiting_second_approval", "approved", "rejected"}


@dataclass
class HistoryIndex:
    """Chronological, flattened transactions per customer, so rolling-window rules are O(n) per customer."""

    by_customer: dict[str, list[dict[str, Any]]]
    position: dict[str, tuple[str, int]]

    def history_for(self, txn_id: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        cid, idx = self.position[txn_id]
        rows = self.by_customer[cid]
        return rows[idx], rows[: idx + 1]


def build_history(session: Session, ruleset: RuleSet, customer_ids: set[str] | None = None) -> HistoryIndex:
    stmt = (
        select(Transaction, Account, Customer)
        .join(Account, Transaction.account_id == Account.id)
        .join(Customer, Account.customer_id == Customer.id)
        .order_by(Transaction.timestamp, Transaction.id)
    )
    if customer_ids:
        stmt = stmt.where(Customer.id.in_(customer_ids))
    by_customer: dict[str, list[dict[str, Any]]] = defaultdict(list)
    position: dict[str, tuple[str, int]] = {}
    for txn, acc, cust in session.execute(stmt).all():
        rows = by_customer[cust.id]
        position[txn.id] = (cust.id, len(rows))
        rows.append(flatten(txn, cust, acc, ruleset.params))
    return HistoryIndex(dict(by_customer), position)


def build_query(features: dict[str, Any], rules: list[dict[str, Any]]) -> str:
    parts = [r["name"] + ". " + r["description"] for r in rules]
    parts.append(f"{features['channel']} {features['direction']} transaction")
    if features.get("is_cross_border"):
        parts.append(f"cross-border wire transfer counterparty {features['counterparty_country']}")
    if features.get("customer.type") == "npo":
        parts.append("non-profit organisation receipt")
    if features.get("customer.is_pep"):
        parts.append("politically exposed person enhanced due diligence")
    if features["channel"] == "cash":
        parts.append("cash transaction reporting threshold")
    return " ".join(parts)


def retrieve(retriever: HybridRetriever, query: str, rules: list[dict[str, Any]], top_k: int) -> list[dict[str, Any]]:
    """Rule-anchored chunks (the rule's own source clauses) + hybrid search filtered to those regulations."""
    seen: dict[str, dict[str, Any]] = {}
    for r in rules:
        for ref in r["source_refs"]:
            cid = retriever.resolve_ref(ref)
            if cid and cid not in seen:
                chunk = retriever.by_id(cid, method="rule_ref")
                if chunk:
                    seen[cid] = chunk.to_dict()
    reg_filter = sorted({ref.split("#")[0] for r in rules for ref in r["source_refs"]}) or None
    for c in retriever.search(query, top_k=top_k, reg_ids=reg_filter):
        seen.setdefault(c.chunk_id, c.to_dict())
    if reg_filter:  # one unfiltered pass for context the rules may have missed
        for c in retriever.search(query, top_k=2):
            seen.setdefault(c.chunk_id, c.to_dict())
    return list(seen.values())


def call_llm(provider: LLMProvider, features: dict[str, Any], rules: list[dict[str, Any]], chunks: list[dict[str, Any]],
             txn_id: str) -> tuple[LLMAnalysis | None, str, list[str]]:
    req = LLMRequest(
        system=prompts.ANALYZE_SYSTEM,
        user=prompts.analyze_user(features, rules, chunks),
        context={"task": "analyze", "txn_id": txn_id, "rules": rules, "chunks": chunks, "features": features},
    )
    errors: list[str] = []
    raw = ""
    for attempt in (1, 2):
        req.attempt = attempt
        req.previous_error = errors[-1] if errors else None
        try:
            raw = provider.complete(req)
            return parse_analysis(raw), raw, errors
        except Exception as exc:  # invalid JSON, schema error, provider/network error
            errors.append(str(exc)[:300])
    return None, raw, errors


def rules_only_analysis(rules: list[dict[str, Any]]) -> LLMAnalysis:
    from reglens.llm.schema import ObligationOut

    sev = [r["severity"] for r in rules]
    risk = "high" if {"high", "critical"} & set(sev) else "medium" if "medium" in sev else "low"
    return LLMAnalysis(
        applicable_regulations=[],
        obligations=[ObligationOut(type=r["obligation"]["type"], deadline=r["deadline"],
                                   description=r["obligation"]["description"], source_rule_id=r["rule_id"])
                     for r in rules],
        risk_level=risk, confidence=0.3,
        summary="LLM output was invalid twice; showing deterministic rule results only. Human review required.",
    )


def analyze_transaction(session: Session, txn: Transaction, flat: dict[str, Any], history: list[dict[str, Any]], *,
                        provider: LLMProvider | None = None, retriever: HybridRetriever | None = None,
                        ruleset: RuleSet | None = None, run_id: int | None = None, actor: str = "system") -> Decision:
    t0 = time.perf_counter()
    settings = get_settings()
    provider = provider or get_provider()
    retriever = retriever or get_retriever(session)
    ruleset = ruleset or get_ruleset()

    features = public_features(flat)
    hits = [h.to_dict() for h in evaluate_rules(flat, history, ruleset)]
    query = build_query(flat, hits)
    chunks = retrieve(retriever, query, hits, settings.retrieval_top_k)

    analysis, raw, errors = call_llm(provider, features, hits, chunks, txn.id)
    fallback = analysis is None
    if analysis is None:
        analysis = rules_only_analysis(hits)

    guard = apply_guardrails(analysis, chunks, hits)
    score, risk_level = score_risk(hits, analysis.risk_level, guard.citation_issue)
    obligations = guard.output["obligations"]

    reasons: list[str] = []
    if any(o["reporting"] for o in obligations):
        reasons.append("reporting_obligation")
    if risk_level in ("medium", "high"):
        reasons.append(f"risk_{risk_level}")
    if analysis.confidence < settings.low_confidence_threshold:
        reasons.append("low_confidence")
    if guard.citation_issue:
        reasons.append("citation_issue")
    if fallback:
        reasons.append("llm_fallback")
    requires_review = bool(reasons)
    four_eyes = any(o["type"] == "STR" for o in obligations)
    status = "pending_review" if requires_review else ("logged" if obligations else "auto_cleared")

    # Supersede the previous current decision for this transaction (history is kept).
    for old in session.scalars(select(Decision).where(Decision.transaction_id == txn.id, Decision.is_current)).all():
        old.is_current = False

    output = {**guard.output, "risk_level": risk_level, "llm_risk_level": analysis.risk_level,
              "obligation_fixes": guard.obligation_fixes, "llm_errors": errors}
    decision = Decision(
        transaction_id=txn.id, run_id=run_id, is_current=True, status=status, risk_level=risk_level,
        risk_score=score, confidence=analysis.confidence, summary=analysis.summary, requires_review=requires_review,
        requires_four_eyes=four_eyes, citation_issue=guard.citation_issue, fallback_used=fallback,
        routing_reasons=reasons, features=features, rules_fired=hits, retrieved=chunks, retrieval_query=query,
        llm_raw=raw[:8000], output=output, invalid_citations=guard.invalid_citations, obligations=obligations,
        model_name=f"{provider.name}:{provider.model}", prompt_version=prompts.ANALYZE_VERSION,
        latency_ms=round((time.perf_counter() - t0) * 1000, 2),
    )
    session.add(decision)
    session.flush()
    audit(session, "ANALYSIS_COMPLETED", "decision", decision.id, actor, {
        "transaction_id": txn.id, "rules_fired": [h["rule_id"] for h in hits],
        "retrieved": [{"id": c["chunk_id"], "hash": c["content_hash"]} for c in chunks],
        "model": decision.model_name, "prompt_version": decision.prompt_version,
        "output_hash": sha256(canonical_json(output)), "status": status, "risk_level": risk_level,
    })
    return decision


def analyze_one(session: Session, txn_id: str, **kw: Any) -> Decision:
    txn = session.get(Transaction, txn_id)
    if txn is None:
        raise KeyError(txn_id)
    ruleset = kw.pop("ruleset", None) or get_ruleset()
    cust_id = session.get(Account, txn.account_id).customer_id
    idx = build_history(session, ruleset, {cust_id})
    flat, history = idx.history_for(txn_id)
    return analyze_transaction(session, txn, flat, history, ruleset=ruleset, **kw)


def current_decisions(session: Session) -> list[Decision]:
    return list(session.scalars(
        select(Decision).where(Decision.is_current).options(selectinload(Decision.transaction))
    ).all())
