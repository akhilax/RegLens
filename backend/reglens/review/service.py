"""Human-in-the-loop review: queue ordering, approve/reject/modify, and four-eyes for STR candidates."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from reglens.audit.chain import append as audit
from reglens.core.models import Decision, ReviewAction
from reglens.core.utils import add_working_days

REVIEWERS: list[dict[str, str]] = [
    {"id": "asha", "name": "Asha Menon", "role": "AML Analyst"},
    {"id": "ravi", "name": "Ravi Kulkarni", "role": "Principal Officer (MLRO)"},
    {"id": "meera", "name": "Meera Iyer", "role": "Compliance Manager"},
]
REVIEWER_IDS = {r["id"] for r in REVIEWERS}
QUEUE_STATES = ("pending_review", "in_review", "awaiting_second_approval", "needs_re_review")
CLOSED_STATES = ("approved", "rejected")
RISK_ORDER = {"high": 0, "medium": 1, "low": 2}
SEPARATOR = "round_reset"


class ReviewError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def earliest_deadline(d: Decision) -> str:
    dates = [o["deadline"] for o in d.obligations if o.get("deadline")]
    return min(dates) if dates else "9999-12-31"


def queue(session: Session, include_closed: bool = False) -> list[Decision]:
    states = QUEUE_STATES + (CLOSED_STATES if include_closed else ())
    rows = session.scalars(
        select(Decision).where(Decision.is_current, Decision.status.in_(states))
        .options(selectinload(Decision.transaction), selectinload(Decision.reviews))
    ).all()
    return sorted(rows, key=lambda d: (RISK_ORDER.get(d.risk_level, 3), earliest_deadline(d), -d.risk_score, d.id))


def current_round_approvals(d: Decision) -> list[ReviewAction]:
    approvals: list[ReviewAction] = []
    for r in d.reviews:
        if r.action == SEPARATOR:
            approvals = []
        elif r.action in ("approve", "modify"):
            approvals.append(r)
    return approvals


def act(session: Session, decision_id: int, reviewer: str, action: str, comment: str | None = None,
        modifications: dict[str, Any] | None = None, today: date | None = None) -> Decision:
    d = session.get(Decision, decision_id)
    if d is None or not d.is_current:
        raise ReviewError(404, "Decision not found")
    if reviewer not in REVIEWER_IDS:
        raise ReviewError(400, f"Unknown reviewer {reviewer!r}")
    if action not in ("start_review", "approve", "reject", "modify"):
        raise ReviewError(400, f"Unknown action {action!r}")
    if d.status in CLOSED_STATES:
        raise ReviewError(409, f"Decision is already {d.status}")
    if d.status not in QUEUE_STATES:
        raise ReviewError(409, f"Decision with status {d.status} is not in the review queue")
    if action in ("reject", "modify") and not (comment and comment.strip()):
        raise ReviewError(422, "A comment is required to reject or modify a decision")

    before = d.status
    today = today or date.today()

    if action == "start_review":
        if d.status == "awaiting_second_approval":
            raise ReviewError(409, "Waiting for a second approver; start_review is not applicable")
        d.status = "in_review"
    elif action == "reject":
        d.status = "rejected"
    else:  # approve | modify
        approvals = current_round_approvals(d)
        if d.requires_four_eyes and any(a.reviewer == reviewer for a in approvals):
            raise ReviewError(409, "Four-eyes rule: the second approval must come from a different reviewer")
        if modifications:
            allowed = {k: v for k, v in modifications.items() if k in {"risk_level", "note", "obligations_removed"}}
            if allowed.get("risk_level") in ("low", "medium", "high"):
                d.risk_level = allowed["risk_level"]
            if allowed.get("obligations_removed"):
                removed = set(allowed["obligations_removed"])
                d.obligations = [o for o in d.obligations if o["type"] not in removed]
            d.output = {**d.output, "reviewer_modifications": allowed}
        if d.requires_four_eyes and len(approvals) == 0:
            d.status = "awaiting_second_approval"
        else:
            d.status = "approved"
            # STR clock starts on the date of determination by the Principal Officer.
            d.obligations = [
                {**o, "deadline": add_working_days(today, 7).isoformat(), "determined_on": today.isoformat()}
                if o["type"] == "STR" else o
                for o in d.obligations
            ]

    review = ReviewAction(decision_id=d.id, reviewer=reviewer, action=action, comment=comment,
                          modifications=modifications)
    session.add(review)
    session.flush()
    audit(session, f"REVIEW_{action.upper()}", "decision", d.id, reviewer, {
        "transaction_id": d.transaction_id, "from": before, "to": d.status, "comment": comment,
        "modifications": modifications, "four_eyes": d.requires_four_eyes,
    })
    session.flush()
    session.refresh(d)
    return d


def mark_for_re_review(session: Session, d: Decision, reason: str, actor: str = "system") -> None:
    before = d.status
    d.status = "needs_re_review"
    d.re_review_reason = reason
    session.add(ReviewAction(decision_id=d.id, reviewer=actor, action=SEPARATOR, comment=reason))
    audit(session, "DECISION_NEEDS_RE_REVIEW", "decision", d.id, actor,
          {"transaction_id": d.transaction_id, "from": before, "reason": reason})
