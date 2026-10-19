"""Background batch analysis with an in-memory event log consumed by the SSE endpoint."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select

from reglens.audit.chain import append as audit
from reglens.config import get_settings
from reglens.core.db import new_session
from reglens.core.models import AnalysisRun, Decision, Transaction, utcnow
from reglens.kb.retriever import get_retriever
from reglens.llm.providers import get_provider
from reglens.pipeline.analyze import REVIEWED_STATES, analyze_transaction, build_history
from reglens.rules.engine import get_ruleset


@dataclass
class RunEvents:
    events: list[dict[str, Any]] = field(default_factory=list)
    done: bool = False
    cond: threading.Condition = field(default_factory=threading.Condition)

    def push(self, event: dict[str, Any]) -> None:
        with self.cond:
            event["seq"] = len(self.events)
            self.events.append(event)
            self.cond.notify_all()

    def finish(self) -> None:
        with self.cond:
            self.done = True
            self.cond.notify_all()


_RUNS: dict[int, RunEvents] = {}
_LOCK = threading.Lock()


def get_events(run_id: int) -> RunEvents | None:
    return _RUNS.get(run_id)


def _decision_event(d: Decision, txn: Transaction) -> dict[str, Any]:
    return {
        "type": "decision", "decision_id": d.id, "transaction_id": txn.id, "amount_inr": txn.amount_inr,
        "channel": txn.channel, "direction": txn.direction, "status": d.status, "risk_level": d.risk_level,
        "rules": [h["rule_id"] for h in d.rules_fired], "citation_issue": d.citation_issue,
        "requires_four_eyes": d.requires_four_eyes, "timestamp": txn.timestamp.isoformat(),
    }


def run_batch(run_id: int, txn_ids: list[str] | None = None, pace_ms: int | None = None, actor: str = "system",
              events: RunEvents | None = None) -> None:
    events = events or _RUNS.setdefault(run_id, RunEvents())
    pace = (get_settings().analysis_pace_ms if pace_ms is None else pace_ms) / 1000
    session = new_session()
    try:
        run = session.get(AnalysisRun, run_id)
        ruleset = get_ruleset()
        provider = get_provider()
        retriever = get_retriever(session, refresh=True)
        stmt = select(Transaction).order_by(Transaction.timestamp, Transaction.id)
        if txn_ids:
            stmt = stmt.where(Transaction.id.in_(txn_ids))
        txns = list(session.scalars(stmt).all())
        reviewed = set(session.scalars(
            select(Decision.transaction_id).where(Decision.is_current, Decision.status.in_(REVIEWED_STATES))
        ).all())
        todo = [t for t in txns if t.id not in reviewed]
        history = build_history(session, ruleset)

        run.status, run.total, run.provider = "running", len(todo), f"{provider.name}:{provider.model}"
        session.commit()
        events.push({"type": "started", "run_id": run_id, "total": len(todo), "skipped_reviewed": len(txns) - len(todo),
                     "provider": run.provider})

        flagged = 0
        for i, txn in enumerate(todo, start=1):
            flat, hist = history.history_for(txn.id)
            d = analyze_transaction(session, txn, flat, hist, provider=provider, retriever=retriever,
                                    ruleset=ruleset, run_id=run_id, actor=actor)
            if d.rules_fired or d.requires_review:
                flagged += 1
                events.push(_decision_event(d, txn))
            run.processed, run.flagged = i, flagged
            if i % 10 == 0 or i == len(todo):
                session.commit()
                events.push({"type": "progress", "processed": i, "total": len(todo), "flagged": flagged})
            if pace:
                time.sleep(pace)

        run.status, run.finished_at = "done", utcnow()
        audit(session, "ANALYSIS_RUN_COMPLETED", "analysis_run", run_id, actor,
              {"processed": len(todo), "flagged": flagged, "provider": run.provider})
        session.commit()
        events.push({"type": "done", "processed": len(todo), "total": len(todo), "flagged": flagged})
    except Exception as exc:  # pragma: no cover - surfaced to the UI
        session.rollback()
        run = session.get(AnalysisRun, run_id)
        if run:
            run.status, run.error, run.finished_at = "failed", str(exc)[:1000], utcnow()
            session.commit()
        events.push({"type": "error", "message": str(exc)[:500]})
    finally:
        session.close()
        events.finish()


def start_run(source: str = "synthetic", txn_ids: list[str] | None = None, pace_ms: int | None = None,
              actor: str = "system", background: bool = True) -> int:
    session = new_session()
    try:
        run = AnalysisRun(status="queued", source=source)
        session.add(run)
        session.commit()
        run_id = run.id
    finally:
        session.close()
    with _LOCK:
        _RUNS[run_id] = RunEvents()
    if background:
        threading.Thread(target=run_batch, args=(run_id, txn_ids, pace_ms, actor), daemon=True).start()
    else:
        run_batch(run_id, txn_ids, pace_ms, actor)
    return run_id
