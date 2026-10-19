"""Knowledge base: documents, versions, upload, diff and impact analysis."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from api import schemas
from reglens.config import get_settings
from reglens.core.db import get_db
from reglens.core.models import Decision, RegDocument
from reglens.kb.parser import RegulationParseError, parse_regulation
from reglens.kb.retriever import get_retriever
from reglens.kb.store import diff_versions, ingest
from reglens.pipeline.impact import analyze_impact, cited_chunk_ids

router = APIRouter(prefix="/kb", tags=["knowledge-base"])


def _versions(db: Session, reg_id: str) -> list[schemas.VersionOut]:
    docs = db.scalars(select(RegDocument).where(RegDocument.reg_id == reg_id).order_by(RegDocument.version.desc())).all()
    return [schemas.VersionOut(id=d.id, version=d.version, status=d.status, effective_date=d.effective_date,
                               uploaded_at=d.uploaded_at, uploaded_by=d.uploaded_by, content_hash=d.content_hash)
            for d in docs]


def _citing_counts(db: Session) -> dict[str, int]:
    counts: dict[str, int] = {}
    for d in db.scalars(select(Decision).where(Decision.is_current)).all():
        for reg in {cid.split("@")[0] for cid in cited_chunk_ids(d)}:
            counts[reg] = counts.get(reg, 0) + 1
    return counts


def _doc_out(db: Session, d: RegDocument, citing: dict[str, int]) -> dict:
    return dict(id=d.id, reg_id=d.reg_id, title=d.title, issuer=d.issuer, version=d.version,
                effective_date=d.effective_date, source_url=d.source_url, status=d.status, uploaded_at=d.uploaded_at,
                uploaded_by=d.uploaded_by, content_hash=d.content_hash, chunk_count=len(d.chunks),
                citing_decisions=citing.get(d.reg_id, 0), versions=_versions(db, d.reg_id))


@router.get("/documents", response_model=list[schemas.DocumentOut])
def list_documents(db: Session = Depends(get_db)) -> list[schemas.DocumentOut]:
    citing = _citing_counts(db)
    docs = db.scalars(select(RegDocument).where(RegDocument.status == "active").order_by(RegDocument.reg_id)).all()
    return [schemas.DocumentOut(**_doc_out(db, d, citing)) for d in docs]


@router.get("/documents/{reg_id}", response_model=schemas.DocumentDetail)
def get_document(reg_id: str, version: int | None = None, db: Session = Depends(get_db)) -> schemas.DocumentDetail:
    stmt = select(RegDocument).where(RegDocument.reg_id == reg_id)
    stmt = stmt.where(RegDocument.version == version) if version else stmt.where(RegDocument.status == "active")
    d = db.scalars(stmt).first()
    if d is None:
        raise HTTPException(404, "Document not found")
    banner = parse_regulation(d.raw_text).banner
    return schemas.DocumentDetail(
        **_doc_out(db, d, _citing_counts(db)), banner=banner,
        chunks=[schemas.ChunkOut(id=c.id, section=c.section, heading=c.heading, text=c.text,
                                 content_hash=c.content_hash, version=c.version, status=c.status) for c in d.chunks],
    )


@router.get("/documents/{reg_id}/diff", response_model=list[schemas.SectionDiffOut])
def get_diff(reg_id: str, from_version: int, to_version: int, db: Session = Depends(get_db)):
    try:
        return [schemas.SectionDiffOut(**vars(x)) for x in diff_versions(db, reg_id, from_version, to_version)]
    except KeyError as exc:
        raise HTTPException(404, "Version not found") from exc


def _ingest(db: Session, text: str, actor: str) -> schemas.IngestOut:
    try:
        result = ingest(db, text, actor)
    except RegulationParseError as exc:
        db.rollback()
        raise HTTPException(422, str(exc)) from exc
    impact = analyze_impact(db, result, actor)
    db.commit()
    get_retriever(db, refresh=True)
    return schemas.IngestOut(
        document_id=result.document_id, reg_id=result.reg_id, version=result.version, status=result.status,
        previous_version=result.previous_version, diff=[schemas.SectionDiffOut(**vars(x)) for x in result.diff],
        impacted=[schemas.ImpactItem(**i) for i in impact["impacted"]], informational=impact["informational"],
    )


@router.post("/documents", response_model=schemas.IngestOut)
async def upload_document(file: UploadFile = File(...), uploaded_by: str = Form("meera"),
                          db: Session = Depends(get_db)) -> schemas.IngestOut:
    text = (await file.read()).decode("utf-8-sig", errors="replace")
    return _ingest(db, text, uploaded_by)


@router.post("/documents/text", response_model=schemas.IngestOut)
def upload_text(body: schemas.TextUploadIn, db: Session = Depends(get_db)) -> schemas.IngestOut:
    return _ingest(db, body.text, body.uploaded_by)


@router.post("/demo-amendment", response_model=schemas.IngestOut)
def demo_amendment(db: Session = Depends(get_db)) -> schemas.IngestOut:
    """Load the bundled HYPOTHETICAL v2 of the PML Rules to demonstrate change-impact analysis."""
    path = get_settings().regulations_dir / "updates" / "pml-rules-2005.v2.md"
    return _ingest(db, path.read_text(encoding="utf-8"), "meera")


@router.get("/demo-amendment/source", response_model=schemas.TextUploadIn)
def demo_amendment_source() -> schemas.TextUploadIn:
    path = get_settings().regulations_dir / "updates" / "pml-rules-2005.v2.md"
    return schemas.TextUploadIn(text=path.read_text(encoding="utf-8"))
