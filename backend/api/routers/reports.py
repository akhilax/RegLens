"""DRAFT report downloads (approved decisions only)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from api import schemas
from reglens.core.db import get_db
from reglens.reports.exports import REPORT_TYPES, report_rows, to_csv, to_markdown

router = APIRouter(tags=["reports"])


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
