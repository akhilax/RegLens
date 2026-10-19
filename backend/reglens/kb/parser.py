"""Parse regulation markdown (YAML front matter + anchored sections) into section-aware chunks."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

import yaml

from reglens.core.utils import sha256

FRONT_MATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
SECTION = re.compile(r"^##\s+(?P<heading>.+?)\s*\{#(?P<anchor>[a-z0-9][a-z0-9\-]*)\}\s*$", re.MULTILINE)
REQUIRED = ("reg_id", "title", "issuer", "version")


class RegulationParseError(ValueError):
    pass


@dataclass(frozen=True)
class ParsedChunk:
    section: str
    heading: str
    text: str
    content_hash: str
    ordinal: int

    def chunk_id(self, reg_id: str, version: int) -> str:
        return f"{reg_id}@v{version}#{self.section}"


@dataclass(frozen=True)
class ParsedDocument:
    reg_id: str
    title: str
    issuer: str
    version: int
    effective_date: date | None
    source_url: str | None
    banner: str
    chunks: list[ParsedChunk]
    raw_text: str
    content_hash: str


def parse_regulation(text: str) -> ParsedDocument:
    text = text.replace("\r\n", "\n")
    match = FRONT_MATTER.match(text)
    if not match:
        raise RegulationParseError("Missing YAML front matter (--- ... ---)")
    meta = yaml.safe_load(match.group(1)) or {}
    missing = [k for k in REQUIRED if k not in meta]
    if missing:
        raise RegulationParseError(f"Front matter missing fields: {', '.join(missing)}")

    body = text[match.end():]
    headers = list(SECTION.finditer(body))
    if not headers:
        raise RegulationParseError("No anchored sections found. Use '## Heading {#anchor}'.")

    banner = body[: headers[0].start()].strip()
    chunks: list[ParsedChunk] = []
    seen: set[str] = set()
    for i, h in enumerate(headers):
        end = headers[i + 1].start() if i + 1 < len(headers) else len(body)
        section_text = body[h.end():end].strip()
        anchor = h.group("anchor")
        if anchor in seen:
            raise RegulationParseError(f"Duplicate section anchor: {anchor}")
        seen.add(anchor)
        heading = h.group("heading").strip()
        chunks.append(ParsedChunk(anchor, heading, section_text, sha256(f"{heading}\n{section_text}"), i))

    eff = meta.get("effective_date")
    if isinstance(eff, str):
        eff = date.fromisoformat(eff)
    return ParsedDocument(
        reg_id=str(meta["reg_id"]).strip(),
        title=str(meta["title"]).strip(),
        issuer=str(meta["issuer"]).strip(),
        version=int(meta["version"]),
        effective_date=eff,
        source_url=meta.get("source_url"),
        banner=banner,
        chunks=chunks,
        raw_text=text,
        content_hash=sha256(body.strip()),
    )
