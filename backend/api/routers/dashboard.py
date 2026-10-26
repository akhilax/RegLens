"""Dashboard statistics, metadata and global search."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from api import schemas
from reglens import __version__
from reglens.core.db import get_db
from reglens.core.models import AnalysisRun, Decision, Transaction
from reglens.kb.retriever import get_retriever
from reglens.llm import prompts
from reglens.llm.providers import get_provider
from reglens.review.service import REVIEWERS
from reglens.rules.engine import get_ruleset

router = APIRouter(tags=["dashboard"])


@router.get("/stats", response_model=schemas.Stats)
def stats(db: Session = Depends(get_db)) -> schemas.Stats:
    txns = db.scalars(select(Transaction)).all()
    decisions = db.scalars(
        select(Decision).where(Decision.is_current).options(selectinload(Decision.transaction))
    ).all()
    by_txn = {d.transaction_id: d for d in decisions}
    status = Counter(d.status for d in decisions)
    flagged = [d for d in decisions if d.rules_fired]

    daily: dict[date, dict[str, float]] = defaultdict(lambda: {"transactions": 0, "flagged": 0, "volume_inr": 0.0})
    channel = Counter()
    for t in txns:
        day = daily[t.timestamp.date()]
        day["transactions"] += 1
        day["volume_inr"] += t.amount_inr
        d = by_txn.get(t.id)
        if d and d.rules_fired:
            day["flagged"] += 1
            channel[t.channel] += 1

    deadlines = []
    for d in decisions:
        if d.status in ("auto_cleared", "rejected"):
            continue
        for o in d.obligations:
            if o.get("deadline") and o.get("reporting"):
                deadlines.append(schemas.DeadlineItem(decision_id=d.id, transaction_id=d.transaction_id, type=o["type"],
                                                      deadline=o["deadline"], risk_level=d.risk_level, status=d.status))
    deadlines.sort(key=lambda x: x.deadline)
    today = date.today().isoformat()
    upcoming = [x for x in deadlines if x.deadline >= today][:8]
    overdue = [x for x in deadlines if x.deadline < today][-4:]

    last_run = db.scalars(select(AnalysisRun).order_by(AnalysisRun.id.desc()).limit(1)).first()
    return schemas.Stats(
        transactions=len(txns), analyzed=len(decisions), flagged=len(flagged),
        auto_cleared=status["auto_cleared"], logged=status["logged"], pending_review=status["pending_review"],
        in_review=status["in_review"], awaiting_second_approval=status["awaiting_second_approval"],
        approved=status["approved"], rejected=status["rejected"],
        citation_issues=sum(1 for d in decisions if d.citation_issue),
        hallucinations_blocked=sum(len(d.invalid_citations) for d in decisions),
        volume_inr=round(sum(t.amount_inr for t in txns), 2),
        flagged_volume_inr=round(sum(d.transaction.amount_inr for d in flagged), 2),
        risk_distribution=dict(Counter(d.risk_level for d in decisions)),
        by_rule=dict(Counter(h["rule_id"] for d in decisions for h in d.rules_fired).most_common()),
        by_obligation=dict(Counter(o["type"] for d in decisions for o in d.obligations).most_common()),
        by_channel=dict(channel.most_common()),
        daily=[schemas.DailyPoint(date=k, transactions=int(v["transactions"]), flagged=int(v["flagged"]),
                                  volume_inr=round(v["volume_inr"], 2)) for k, v in sorted(daily.items())],
        upcoming_deadlines=overdue + upcoming,
        last_run=None if last_run is None else {
            "id": last_run.id, "status": last_run.status, "processed": last_run.processed,
            "flagged": last_run.flagged, "provider": last_run.provider,
            "finished_at": last_run.finished_at.isoformat() if last_run.finished_at else None,
        },
    )


@router.get("/meta", response_model=schemas.MetaOut)
def meta(db: Session = Depends(get_db)) -> schemas.MetaOut:
    rs = get_ruleset()
    provider = get_provider()
    return schemas.MetaOut(
        app="RegLens", version=__version__, llm_provider=provider.name, llm_model=provider.model,
        prompt_versions={"analyze": prompts.ANALYZE_VERSION},
        retriever=get_retriever(db).backend,
        reviewers=[schemas.ReviewerOut(**r) for r in REVIEWERS],
        rules=[schemas.RuleOut(id=r.id, name=r.name, description=r.description, severity=r.severity,
                               obligation=r.obligation.model_dump(), deadline_rule=r.deadline_rule,
                               source_refs=r.source_refs) for r in rs.rules],
        params=rs.params, high_risk_jurisdictions=rs.lists.get("high_risk_jurisdictions", []),
    )


@router.get("/search", response_model=list[schemas.SearchHit])
def search(q: str = Query(min_length=1, max_length=64), db: Session = Depends(get_db)) -> list[schemas.SearchHit]:
    like = f"%{q.strip()}%"
    hits: list[schemas.SearchHit] = []
    for t in db.scalars(select(Transaction).where(or_(Transaction.id.ilike(like), Transaction.account_id.ilike(like)))
                        .limit(6)).all():
        hits.append(schemas.SearchHit(kind="transaction", id=t.id, title=f"{t.id} · ₹{t.amount_inr:,.0f}",
                                      subtitle=f"{t.channel} {t.direction} · {t.timestamp:%d %b %Y}",
                                      href=f"/app/transactions?focus={t.id}"))
    if q.strip().isdigit():
        d = db.get(Decision, int(q.strip()))
        if d:
            hits.append(schemas.SearchHit(kind="decision", id=str(d.id), title=f"Decision #{d.id}",
                                          subtitle=f"{d.transaction_id} · {d.status} · {d.risk_level}",
                                          href=f"/app/decisions/{d.id}"))
    for d in db.scalars(select(Decision).where(Decision.is_current, Decision.transaction_id.ilike(like)).limit(4)).all():
        hits.append(schemas.SearchHit(kind="decision", id=str(d.id), title=f"Decision #{d.id} ({d.transaction_id})",
                                      subtitle=f"{d.status} · {d.risk_level} risk", href=f"/app/decisions/{d.id}"))
    return hits
