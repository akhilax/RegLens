import pytest
from sqlalchemy import select

from reglens.config import get_settings
from reglens.core.models import RegChunk, RegDocument
from reglens.core.utils import sha256
from reglens.kb.parser import RegulationParseError, parse_regulation
from reglens.kb.retriever import HybridRetriever
from reglens.kb.store import ingest

DOC = """---
reg_id: TEST-REG
title: Test regulation
issuer: Tester
version: 1
---

> DEMO SUMMARY

## Section 1 — Alpha {#s1}
Cash transactions above ten lakh rupees must be reported.

## Section 2 — Beta {#s2}
Wire transfers above five lakh rupees must be reported.
"""


def test_parse_sections_ids_and_hashes():
    doc = parse_regulation(DOC)
    assert doc.reg_id == "TEST-REG" and doc.version == 1
    assert [c.section for c in doc.chunks] == ["s1", "s2"]
    assert doc.chunks[0].chunk_id("TEST-REG", 1) == "TEST-REG@v1#s1"
    c = doc.chunks[0]
    assert c.content_hash == sha256(f"{c.heading}\n{c.text}")
    assert "DEMO SUMMARY" in doc.banner


@pytest.mark.parametrize("bad", ["no front matter", "---\ntitle: x\n---\n## A {#a}\ntext",
                                 "---\nreg_id: X\ntitle: x\nissuer: y\nversion: 1\n---\nno sections"])
def test_parse_rejects_malformed(bad):
    with pytest.raises(RegulationParseError):
        parse_regulation(bad)


def test_seed_corpus_has_stable_ids(session):
    ids = set(session.scalars(select(RegChunk.id)).all())
    assert "PML-RULES-2005@v1#rule3-1-a" in ids
    assert "RBI-KYC-MD@v1#sec38" in ids
    for doc in session.scalars(select(RegDocument)).all():
        assert "DEMO SUMMARY" in doc.raw_text


def test_versioning_supersedes_and_diffs(session):
    first = ingest(session, DOC)
    assert first.status == "created"
    same = ingest(session, DOC)
    assert same.status == "unchanged"
    v2 = DOC.replace("version: 1", "version: 2").replace("five lakh", "seven lakh")
    second = ingest(session, v2)
    assert second.status == "new_version" and second.version == 2 and second.previous_version == 1
    changes = {d.section: d.change for d in second.diff}
    assert changes == {"s1": "unchanged", "s2": "changed"}
    old = session.get(RegChunk, "TEST-REG@v1#s2")
    assert old.status == "superseded"
    assert session.get(RegChunk, "TEST-REG@v2#s2").status == "active"


def test_hybrid_retrieval_and_metadata_filter(session):
    r = HybridRetriever()
    r.sync(session)
    hits = r.search("cash transaction of more than ten lakh rupees CTR", top_k=4)
    assert any(h.chunk_id == "PML-RULES-2005@v1#rule3-1-a" for h in hits)
    filtered = r.search("periodic updation of KYC high risk", top_k=3, reg_ids=["RBI-KYC-MD"])
    assert filtered and all(h.reg_id == "RBI-KYC-MD" for h in filtered)
    assert filtered[0].chunk_id == "RBI-KYC-MD@v1#sec38"
    assert r.resolve_ref("FEMA-LRS#lrs-limit") == "FEMA-LRS@v1#lrs-limit"


def test_regulation_files_exist():
    files = list(get_settings().regulations_dir.glob("*.md"))
    assert len(files) >= 6
