"""Knowledge-base persistence: versioned ingestion, supersession and section-level diffs."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from reglens.audit.chain import append as audit
from reglens.core.models import RegChunk, RegDocument
from reglens.kb.parser import ParsedDocument, parse_regulation


@dataclass
class SectionDiff:
    section: str
    heading: str
    change: str  # added | removed | changed | unchanged
    old_chunk_id: str | None = None
    new_chunk_id: str | None = None
    old_text: str | None = None
    new_text: str | None = None
    old_hash: str | None = None
    new_hash: str | None = None


@dataclass
class IngestResult:
    document_id: int
    reg_id: str
    version: int
    status: str  # created | new_version | unchanged
    previous_version: int | None = None
    diff: list[SectionDiff] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def active_document(session: Session, reg_id: str) -> RegDocument | None:
    return session.scalars(
        select(RegDocument).where(RegDocument.reg_id == reg_id, RegDocument.status == "active")
    ).first()


def diff_documents(old: RegDocument | None, new_chunks: list[RegChunk]) -> list[SectionDiff]:
    old_map = {c.section: c for c in (old.chunks if old else [])}
    new_map = {c.section: c for c in new_chunks}
    out: list[SectionDiff] = []
    for sec, nc in new_map.items():
        oc = old_map.get(sec)
        if oc is None:
            out.append(SectionDiff(sec, nc.heading, "added", None, nc.id, None, nc.text, None, nc.content_hash))
        else:
            change = "unchanged" if oc.content_hash == nc.content_hash else "changed"
            out.append(SectionDiff(sec, nc.heading, change, oc.id, nc.id, oc.text, nc.text, oc.content_hash,
                                   nc.content_hash))
    for sec, oc in old_map.items():
        if sec not in new_map:
            out.append(SectionDiff(sec, oc.heading, "removed", oc.id, None, oc.text, None, oc.content_hash, None))
    return out


def diff_versions(session: Session, reg_id: str, old_version: int, new_version: int) -> list[SectionDiff]:
    docs = {
        d.version: d
        for d in session.scalars(select(RegDocument).where(RegDocument.reg_id == reg_id)).all()
    }
    if old_version not in docs or new_version not in docs:
        raise KeyError("version not found")
    return diff_documents(docs[old_version], docs[new_version].chunks)


def ingest(session: Session, text: str, actor: str = "system") -> IngestResult:
    parsed: ParsedDocument = parse_regulation(text)
    current = active_document(session, parsed.reg_id)
    if current is not None and current.content_hash == parsed.content_hash:
        return IngestResult(current.id, current.reg_id, current.version, "unchanged")

    version = parsed.version
    if current is not None and version <= current.version:
        version = current.version + 1

    doc = RegDocument(
        reg_id=parsed.reg_id, title=parsed.title, issuer=parsed.issuer, version=version,
        effective_date=parsed.effective_date, source_url=parsed.source_url, raw_text=parsed.raw_text,
        content_hash=parsed.content_hash, uploaded_by=actor, status="active",
    )
    session.add(doc)
    session.flush()
    chunks = [
        RegChunk(id=pc.chunk_id(parsed.reg_id, version), document_id=doc.id, reg_id=parsed.reg_id, version=version,
                 section=pc.section, heading=pc.heading, text=pc.text, content_hash=pc.content_hash,
                 ordinal=pc.ordinal, status="active")
        for pc in parsed.chunks
    ]
    session.add_all(chunks)
    session.flush()

    diff: list[SectionDiff] = []
    previous_version = None
    if current is not None:
        diff = diff_documents(current, chunks)
        previous_version = current.version
        current.status = "superseded"
        for c in current.chunks:
            c.status = "superseded"
        audit(session, "KB_VERSION_SUPERSEDED", "reg_document", current.id, actor,
              {"reg_id": current.reg_id, "version": current.version, "superseded_by": version})

    audit(session, "KB_DOCUMENT_INGESTED", "reg_document", doc.id, actor, {
        "reg_id": doc.reg_id, "version": version, "content_hash": doc.content_hash,
        "chunks": [{"id": c.id, "hash": c.content_hash} for c in chunks],
        "changed_sections": [d.section for d in diff if d.change != "unchanged"],
    })
    session.flush()
    return IngestResult(doc.id, doc.reg_id, version, "new_version" if current else "created", previous_version, diff)


def ingest_directory(session: Session, directory: Path, actor: str = "system") -> list[IngestResult]:
    return [ingest(session, p.read_text(encoding="utf-8"), actor) for p in sorted(directory.glob("*.md"))]
