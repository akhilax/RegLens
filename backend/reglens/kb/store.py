"""Knowledge-base persistence: load regulation markdown into documents + hashed, ID'd chunks."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from reglens.core.models import RegChunk, RegDocument
from reglens.kb.parser import parse_regulation


def ingest(session: Session, text: str, actor: str = "system") -> RegDocument:
    parsed = parse_regulation(text)
    doc = RegDocument(
        reg_id=parsed.reg_id, title=parsed.title, issuer=parsed.issuer, version=parsed.version,
        effective_date=parsed.effective_date, source_url=parsed.source_url, raw_text=parsed.raw_text,
        content_hash=parsed.content_hash, uploaded_by=actor, status="active",
    )
    session.add(doc)
    session.flush()
    session.add_all(
        RegChunk(id=pc.chunk_id(parsed.reg_id, parsed.version), document_id=doc.id, reg_id=parsed.reg_id,
                 version=parsed.version, section=pc.section, heading=pc.heading, text=pc.text,
                 content_hash=pc.content_hash, ordinal=pc.ordinal, status="active")
        for pc in parsed.chunks
    )
    session.flush()
    return doc


def ingest_directory(session: Session, directory: Path, actor: str = "system") -> list[RegDocument]:
    return [ingest(session, p.read_text(encoding="utf-8"), actor) for p in sorted(directory.glob("*.md"))]
