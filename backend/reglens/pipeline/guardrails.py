"""Guardrails applied to every LLM analysis before it is stored."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from reglens.llm.schema import LLMAnalysis

RISK_SCORE = {"low": 20, "medium": 50, "high": 80}
SEVERITY_SCORE = {"low": 25, "medium": 50, "high": 75, "critical": 90}


@dataclass
class GuardrailResult:
    output: dict[str, Any]
    invalid_citations: list[dict[str, Any]] = field(default_factory=list)
    rejected_regulations: list[dict[str, Any]] = field(default_factory=list)
    obligation_fixes: list[str] = field(default_factory=list)

    @property
    def citation_issue(self) -> bool:
        return bool(self.invalid_citations or self.rejected_regulations)


def validate_citations(analysis: LLMAnalysis, retrieved: list[dict[str, Any]]) -> tuple[list[dict], list[dict], list[dict]]:
    """Strip citations that were not retrieved for THIS request (or belong to another regulation)."""
    by_id = {c["chunk_id"]: c for c in retrieved}
    kept, invalid, rejected = [], [], []
    for reg in analysis.applicable_regulations:
        valid_ids = []
        for cid in reg.citation_chunk_ids:
            chunk = by_id.get(cid)
            if chunk is None:
                invalid.append({"reg_id": reg.reg_id, "chunk_id": cid, "reason": "not in retrieved set"})
            elif chunk["reg_id"] != reg.reg_id:
                invalid.append({"reg_id": reg.reg_id, "chunk_id": cid, "reason": f"belongs to {chunk['reg_id']}"})
            else:
                valid_ids.append(cid)
        entry = reg.model_dump()
        entry["citation_chunk_ids"] = valid_ids
        if valid_ids:
            kept.append(entry)
        else:
            rejected.append({**entry, "reason_rejected": "no valid citation"})
    return kept, invalid, rejected


def reconcile_obligations(analysis: LLMAnalysis, rules: list[dict[str, Any]]) -> tuple[list[dict], list[str]]:
    """Deterministic rules own obligations and deadlines; the LLM may only add wording."""
    fixes: list[str] = []
    by_rule = {r["rule_id"]: r for r in rules}
    llm_by_rule = {}
    for ob in analysis.obligations:
        if ob.source_rule_id not in by_rule:
            fixes.append(f"dropped obligation {ob.type} with unknown source rule {ob.source_rule_id}")
            continue
        llm_by_rule[ob.source_rule_id] = ob
    out = []
    for rid, r in by_rule.items():
        ob = llm_by_rule.get(rid)
        if ob is None:
            fixes.append(f"added missing obligation from {rid}")
        elif ob.type != r["obligation"]["type"] or (ob.deadline or None) != r["deadline"]:
            fixes.append(f"corrected type/deadline for {rid}")
        out.append({
            "type": r["obligation"]["type"], "reporting": r["obligation"]["reporting"],
            "deadline": r["deadline"], "deadline_basis": r["deadline_basis"],
            "description": r["obligation"]["description"], "source_rule_id": rid,
        })
    return out, fixes


def apply_guardrails(analysis: LLMAnalysis, retrieved: list[dict[str, Any]], rules: list[dict[str, Any]]) -> GuardrailResult:
    kept, invalid, rejected = validate_citations(analysis, retrieved)
    obligations, fixes = reconcile_obligations(analysis, rules)
    output = {
        "applicable_regulations": kept,
        "obligations": obligations,
        "risk_level": analysis.risk_level,
        "confidence": analysis.confidence,
        "summary": analysis.summary,
        "rejected_regulations": rejected,
    }
    return GuardrailResult(output, invalid, rejected, fixes)


def score_risk(rules: list[dict[str, Any]], llm_risk: str, citation_issue: bool) -> tuple[float, str]:
    rule_score = 0.0
    if rules:
        rule_score = max(SEVERITY_SCORE[r["severity"]] for r in rules) + 5 * (len(rules) - 1)
    score = max(rule_score, RISK_SCORE.get(llm_risk, 20) if rules else min(RISK_SCORE.get(llm_risk, 20), 35))
    if citation_issue:
        score += 5
    score = min(score, 100.0)
    level = "low" if score < 40 else "medium" if score < 70 else "high"
    return score, level
