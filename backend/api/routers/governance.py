"""Audit log, evaluation results and DRAFT report downloads."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api import schemas
from api.convert import audit_out
from reglens.audit.chain import simulate_tamper, verify_chain
from reglens.core.db import get_db
from reglens.core.models import AuditEntry
from reglens.eval.evaluate import latest, run_evaluation
from reglens.reports.exports import REPORT_TYPES, report_rows, to_csv, to_markdown

router = APIRouter(tags=["governance"])


@router.get("/audit", response_model=schemas.Page[schemas.AuditEntryOut])
def audit_log(page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=1000), event_type: str | None = None,
              db: Session = Depends(get_db)) -> schemas.Page[schemas.AuditEntryOut]:
    stmt = select(AuditEntry)
    if event_type:
        stmt = stmt.where(AuditEntry.event_type == event_type)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(AuditEntry.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return schemas.Page(items=[audit_out(e) for e in rows], total=total, page=page, page_size=page_size)


def _report(r, simulated: bool = False) -> schemas.ChainReportOut:
    return schemas.ChainReportOut(valid=r.valid, checked=r.checked, broken_at=r.broken_at, simulated=simulated,
                                  blocks=[schemas.BlockStatusOut(**vars(b)) for b in r.blocks])


@router.get("/audit/verify", response_model=schemas.ChainReportOut)
def verify(db: Session = Depends(get_db)) -> schemas.ChainReportOut:
    return _report(verify_chain(db))


@router.post("/audit/simulate-tamper", response_model=schemas.ChainReportOut)
def tamper(body: schemas.TamperIn, db: Session = Depends(get_db)) -> schemas.ChainReportOut:
    """Demo only — tampers with an in-memory copy; the stored audit log is untouched."""
    return _report(simulate_tamper(db, body.entry_id), simulated=True)


@router.get("/eval")
def get_eval() -> dict:
    result = latest()
    if result is None:
        raise HTTPException(404, "No evaluation yet — run POST /api/eval/run or npm run seed")
    return result


@router.post("/eval/run")
def post_eval(db: Session = Depends(get_db)) -> dict:
    return run_evaluation(db)


@router.get("/reports", response_model=list[schemas.ReportTypeOut])
def reports(db: Session = Depends(get_db)) -> list[schemas.ReportTypeOut]:
    return [schemas.ReportTypeOut(type=k, title=v, approved_count=len(report_rows(db, k)))
            for k, v in REPORT_TYPES.items()]


@router.get("/reports/{report_type}.{fmt}")
def download_report(report_type: str, fmt: str, db: Session = Depends(get_db)) -> PlainTextResponse:
    if report_type.upper() not in REPORT_TYPES or fmt not in ("csv", "md"):
        raise HTTPException(404, "Unknown report")
    rows = report_rows(db, report_type)
    body = to_csv(rows) if fmt == "csv" else to_markdown(report_type, rows)
    media = "text/csv" if fmt == "csv" else "text/markdown"
    name = f"DRAFT_{report_type.upper()}.{fmt}"
    return PlainTextResponse(body, media_type=media, headers={"Content-Disposition": f'attachment; filename="{name}"'})
