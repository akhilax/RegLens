"""ORM → API model conversion helpers."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from api import schemas
from reglens.core.models import Account, AuditEntry, Customer, Decision, Transaction
from reglens.core.utils import mask_account
from reglens.review.service import current_round_approvals, earliest_deadline


def txn_out(t: Transaction, acc: Account, cust: Customer, d: Decision | None = None) -> schemas.TransactionOut:
    return schemas.TransactionOut(
        id=t.id, account_id=t.account_id, account_masked=mask_account(acc.account_number), customer_id=cust.id,
        customer_name=cust.name, customer_type=cust.type, customer_risk=cust.risk, is_pep=cust.is_pep,
        has_pan=cust.has_pan, timestamp=t.timestamp, amount_inr=t.amount_inr, currency=t.currency, channel=t.channel,
        direction=t.direction, counterparty_id=t.counterparty_id, counterparty_country=t.counterparty_country,
        purpose_code=t.purpose_code, source=t.source,
        decision_id=d.id if d else None, decision_status=d.status if d else None,
        risk_level=d.risk_level if d else None, rules=[h["rule_id"] for h in d.rules_fired] if d else [],
    )


def _parties(session: Session, txn: Transaction) -> tuple[Account, Customer]:
    acc = session.get(Account, txn.account_id)
    cust = session.get(Customer, acc.customer_id)
    return acc, cust


def summary_fields(d: Decision, cust: Customer) -> dict:
    t = d.transaction
    deadline = earliest_deadline(d)
    return dict(
        id=d.id, transaction_id=d.transaction_id, status=d.status, risk_level=d.risk_level, risk_score=d.risk_score,
        confidence=d.confidence, summary=d.summary, requires_review=d.requires_review,
        requires_four_eyes=d.requires_four_eyes, citation_issue=d.citation_issue, fallback_used=d.fallback_used,
        routing_reasons=d.routing_reasons, rules=[h["rule_id"] for h in d.rules_fired],
        obligations=[schemas.Obligation(**o) for o in d.obligations],
        earliest_deadline=None if deadline.startswith("9999") else deadline,
        approvals=[a.reviewer for a in current_round_approvals(d)], re_review_reason=d.re_review_reason,
        amount_inr=t.amount_inr, channel=t.channel, direction=t.direction, timestamp=t.timestamp,
        customer_type=cust.type, customer_name=cust.name, counterparty_country=t.counterparty_country,
        created_at=d.created_at,
    )


def decision_summary(session: Session, d: Decision) -> schemas.DecisionSummary:
    _, cust = _parties(session, d.transaction)
    return schemas.DecisionSummary(**summary_fields(d, cust))


def audit_out(e: AuditEntry) -> schemas.AuditEntryOut:
    return schemas.AuditEntryOut(id=e.id, timestamp=e.timestamp, event_type=e.event_type, entity_type=e.entity_type,
                                 entity_id=e.entity_id, actor=e.actor, payload=e.payload, prev_hash=e.prev_hash,
                                 hash=e.hash)


def decision_detail(session: Session, d: Decision) -> schemas.DecisionDetail:
    acc, cust = _parties(session, d.transaction)
    audits = session.scalars(
        select(AuditEntry).where(AuditEntry.entity_type == "decision", AuditEntry.entity_id == str(d.id))
        .order_by(AuditEntry.id)
    ).all()
    return schemas.DecisionDetail(
        **summary_fields(d, cust),
        features=d.features, rules_fired=[schemas.RuleHitOut(**h) for h in d.rules_fired],
        retrieved=[schemas.RetrievedChunkOut(**c) for c in d.retrieved], retrieval_query=d.retrieval_query,
        output=d.output, invalid_citations=d.invalid_citations, model_name=d.model_name,
        prompt_version=d.prompt_version, latency_ms=d.latency_ms, llm_raw=d.llm_raw,
        reviews=[schemas.ReviewOut(id=r.id, reviewer=r.reviewer, action=r.action, comment=r.comment,
                                   modifications=r.modifications, created_at=r.created_at) for r in d.reviews],
        transaction=txn_out(d.transaction, acc, cust, d), audit=[audit_out(e) for e in audits],
    )
