"""Decisions (with full trace) and the human review queue."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from api import schemas
from api.convert import decision_detail, decision_summary
from reglens.core.db import get_db
from reglens.core.models import Decision
from reglens.pipeline.analyze import analyze_one
from reglens.review.service import REVIEWERS, ReviewError, act, queue

router = APIRouter(tags=["decisions"])


@router.get("/decisions", response_model=list[schemas.DecisionSummary])
def list_decisions(
    status: str | None = None,
    risk: str | None = None,
    flagged_only: bool = True,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[schemas.DecisionSummary]:
    stmt = select(Decision).where(Decision.is_current).options(selectinload(Decision.transaction),
                                                              selectinload(Decision.reviews))
    if status:
        stmt = stmt.where(Decision.status == status)
    if risk:
        stmt = stmt.where(Decision.risk_level == risk)
    if flagged_only:
        stmt = stmt.where(Decision.status != "auto_cleared")
    rows = db.scalars(stmt.order_by(Decision.risk_score.desc(), Decision.id).limit(limit)).all()
    return [decision_summary(db, d) for d in rows]


@router.get("/decisions/{decision_id}", response_model=schemas.DecisionDetail)
def get_decision(decision_id: int, db: Session = Depends(get_db)) -> schemas.DecisionDetail:
    d = db.get(Decision, decision_id)
    if d is None:
        raise HTTPException(404, "Decision not found")
    return decision_detail(db, d)


@router.post("/transactions/{txn_id}/analyze", response_model=schemas.DecisionDetail)
def reanalyze(txn_id: str, db: Session = Depends(get_db)) -> schemas.DecisionDetail:
    try:
        d = analyze_one(db, txn_id, actor="asha")
    except KeyError as exc:
        raise HTTPException(404, "Transaction not found") from exc
    db.commit()
    return decision_detail(db, d)


@router.get("/review/queue", response_model=list[schemas.DecisionSummary])
def review_queue(include_closed: bool = False, db: Session = Depends(get_db)) -> list[schemas.DecisionSummary]:
    return [decision_summary(db, d) for d in queue(db, include_closed=include_closed)]


@router.get("/review/reviewers", response_model=list[schemas.ReviewerOut])
def reviewers() -> list[schemas.ReviewerOut]:
    return [schemas.ReviewerOut(**r) for r in REVIEWERS]


@router.post("/review/{decision_id}/actions", response_model=schemas.DecisionDetail)
def review_action(decision_id: int, body: schemas.ReviewIn, db: Session = Depends(get_db)) -> schemas.DecisionDetail:
    try:
        d = act(db, decision_id, body.reviewer, body.action, body.comment, body.modifications)
    except ReviewError as exc:
        db.rollback()
        raise HTTPException(exc.status_code, exc.message) from exc
    db.commit()
    return decision_detail(db, d)
