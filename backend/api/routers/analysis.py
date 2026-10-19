"""Batch analysis runs (+ SSE progress) and CSV upload."""

from __future__ import annotations

import asyncio
import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from api import schemas
from api.sse import sse, sse_response
from reglens.core.db import get_db
from reglens.core.models import Account, AnalysisRun, Transaction
from reglens.pipeline.jobs import get_events, start_run

router = APIRouter(prefix="/analysis", tags=["analysis"])
CHANNELS = {"cash", "NEFT", "RTGS", "IMPS", "UPI", "SWIFT", "card"}


def _run_out(r: AnalysisRun) -> schemas.RunOut:
    return schemas.RunOut(id=r.id, status=r.status, source=r.source, total=r.total, processed=r.processed,
                          flagged=r.flagged, provider=r.provider, started_at=r.started_at, finished_at=r.finished_at,
                          error=r.error)


@router.get("/runs", response_model=list[schemas.RunOut])
def list_runs(db: Session = Depends(get_db)) -> list[schemas.RunOut]:
    return [_run_out(r) for r in db.scalars(select(AnalysisRun).order_by(AnalysisRun.id.desc()).limit(20)).all()]


@router.post("/runs", response_model=schemas.RunOut, status_code=202)
def create_run(body: schemas.RunStartIn | None = None, db: Session = Depends(get_db)) -> schemas.RunOut:
    running = db.scalars(select(AnalysisRun).where(AnalysisRun.status.in_(["queued", "running"]))).first()
    if running and get_events(running.id) and not get_events(running.id).done:
        return _run_out(running)
    run_id = start_run(source="synthetic", pace_ms=body.pace_ms if body else None, actor="asha")
    return _run_out(db.get(AnalysisRun, run_id))


@router.get("/runs/{run_id}", response_model=schemas.RunOut)
def get_run(run_id: int, db: Session = Depends(get_db)) -> schemas.RunOut:
    run = db.get(AnalysisRun, run_id)
    if run is None:
        raise HTTPException(404, "Run not found")
    return _run_out(run)


@router.get("/runs/{run_id}/events")
async def run_events(run_id: int, request: Request):
    """SSE stream: started → decision* / progress* → done. Replays from the start for late subscribers."""
    events = get_events(run_id)
    if events is None:
        raise HTTPException(404, "No live events for this run (it may have finished before a restart)")

    async def gen():
        cursor = 0
        yield "retry: 1500\n\n"
        while True:
            if await request.is_disconnected():
                return
            batch = events.events[cursor:]
            cursor += len(batch)
            for e in batch:
                yield sse(e)
            if events.done and cursor >= len(events.events):
                return
            if not batch:
                yield ": keep-alive\n\n"
            await asyncio.sleep(0.12)

    return sse_response(gen())


@router.post("/upload", response_model=schemas.UploadResult)
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)) -> schemas.UploadResult:
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(raw))
    required = {"account_id", "timestamp", "amount_inr", "channel", "direction"}
    if not reader.fieldnames or not required <= set(reader.fieldnames):
        raise HTTPException(422, f"CSV must include columns: {', '.join(sorted(required))}")
    accounts = set(db.scalars(select(Account.id)).all())
    errors: list[str] = []
    inserted: list[str] = []
    existing = set(db.scalars(select(Transaction.id)).all())
    for i, row in enumerate(reader, start=2):
        try:
            if row["account_id"] not in accounts:
                raise ValueError(f"unknown account {row['account_id']}")
            if row["channel"] not in CHANNELS:
                raise ValueError(f"unknown channel {row['channel']}")
            if row["direction"] not in ("credit", "debit"):
                raise ValueError("direction must be credit or debit")
            tid = (row.get("id") or "").strip() or f"U{len(existing) + len(inserted) + 1:05d}"
            if tid in existing or tid in inserted:
                raise ValueError(f"duplicate id {tid}")
            db.add(Transaction(
                id=tid, account_id=row["account_id"], timestamp=datetime.fromisoformat(row["timestamp"]),
                amount_inr=float(row["amount_inr"]), currency=row.get("currency") or "INR", channel=row["channel"],
                direction=row["direction"], counterparty_id=(row.get("counterparty_id") or None),
                counterparty_country=(row.get("counterparty_country") or "IN").upper()[:2],
                purpose_code=row.get("purpose_code") or None, source="upload",
            ))
            inserted.append(tid)
        except (ValueError, KeyError) as exc:
            errors.append(f"row {i}: {exc}")
    if len(errors) > 50:
        errors = errors[:50] + ["…"]
    db.commit()
    run_id = start_run(source=f"upload:{file.filename}", txn_ids=inserted, actor="asha") if inserted else None
    return schemas.UploadResult(run_id=run_id, inserted=len(inserted), errors=errors)
