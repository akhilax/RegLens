"""Hybrid retriever: BM25 + dense vectors fused with Reciprocal Rank Fusion, with metadata filters."""

from __future__ import annotations

import threading
from dataclasses import asdict, dataclass

from rank_bm25 import BM25Okapi
from sqlalchemy import select
from sqlalchemy.orm import Session

from reglens.core.models import RegChunk
from reglens.kb.embeddings import get_embedder, tokenize
from reglens.kb.vectorstore import make_store

RRF_K = 60


@dataclass
class RetrievedChunk:
    chunk_id: str
    reg_id: str
    version: int
    section: str
    heading: str
    text: str
    content_hash: str
    score: float
    bm25_rank: int | None
    vector_rank: int | None
    method: str  # hybrid | rule_ref

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class _Doc:
    chunk_id: str
    reg_id: str
    version: int
    section: str
    heading: str
    text: str
    content_hash: str


class HybridRetriever:
    def __init__(self) -> None:
        self.embedder = get_embedder()
        self.store = make_store(self.embedder.name)
        self._docs: dict[str, _Doc] = {}
        self._order: list[str] = []
        self._bm25: BM25Okapi | None = None
        self._lock = threading.RLock()

    @property
    def backend(self) -> str:
        return f"bm25+{self.embedder.name}@{self.store.name}"

    def sync(self, session: Session) -> None:
        """Make the in-memory BM25 index and the vector store mirror the ACTIVE chunks in the database."""
        with self._lock:
            rows = session.scalars(select(RegChunk).where(RegChunk.status == "active").order_by(RegChunk.id)).all()
            self._docs = {
                r.id: _Doc(r.id, r.reg_id, r.version, r.section, r.heading, r.text, r.content_hash) for r in rows
            }
            self._order = list(self._docs)
            corpus = [tokenize(f"{d.heading} {d.text}") for d in self._docs.values()]
            self._bm25 = BM25Okapi(corpus) if corpus else None

            existing = self.store.ids()
            stale = [cid for cid in existing if cid not in self._docs]
            missing = [cid for cid in self._order if cid not in existing]
            self.store.delete(stale)
            if missing:
                texts = [f"{self._docs[c].heading}. {self._docs[c].text}" for c in missing]
                self.store.upsert(missing, self.embedder.embed(texts))

    def get(self, chunk_id: str) -> _Doc | None:
        return self._docs.get(chunk_id)

    def active_ids(self) -> set[str]:
        return set(self._docs)

    def resolve_ref(self, ref: str) -> str | None:
        """'PML-RULES-2005#rule3-1-a' -> active chunk id for that section (any version)."""
        reg_id, _, section = ref.partition("#")
        for cid, doc in self._docs.items():
            if doc.reg_id == reg_id and doc.section == section:
                return cid
        return None

    def search(self, query: str, top_k: int = 6, reg_ids: list[str] | None = None) -> list[RetrievedChunk]:
        with self._lock:
            if not self._docs:
                return []
            allowed = {c for c, d in self._docs.items() if not reg_ids or d.reg_id in reg_ids}
            if not allowed:
                return []
            pool = max(top_k * 3, 12)

            bm25_ranked: list[str] = []
            if self._bm25 is not None:
                scores = self._bm25.get_scores(tokenize(query))
                pairs = sorted(zip(self._order, scores, strict=False), key=lambda p: -p[1])
                bm25_ranked = [cid for cid, s in pairs if cid in allowed and s > 0][:pool]

            qvec = self.embedder.embed([query])[0]
            vec_ranked = [cid for cid, _ in self.store.query(qvec, pool, allowed)]

            fused: dict[str, float] = {}
            for ranked in (bm25_ranked, vec_ranked):
                for rank, cid in enumerate(ranked, start=1):
                    fused[cid] = fused.get(cid, 0.0) + 1.0 / (RRF_K + rank)
            bm25_pos = {cid: i + 1 for i, cid in enumerate(bm25_ranked)}
            vec_pos = {cid: i + 1 for i, cid in enumerate(vec_ranked)}

            out = []
            for cid, score in sorted(fused.items(), key=lambda p: (-p[1], p[0]))[:top_k]:
                d = self._docs[cid]
                out.append(RetrievedChunk(cid, d.reg_id, d.version, d.section, d.heading, d.text, d.content_hash,
                                          round(score, 6), bm25_pos.get(cid), vec_pos.get(cid), "hybrid"))
            return out

    def by_id(self, chunk_id: str, method: str = "rule_ref") -> RetrievedChunk | None:
        d = self._docs.get(chunk_id)
        if d is None:
            return None
        return RetrievedChunk(d.chunk_id, d.reg_id, d.version, d.section, d.heading, d.text, d.content_hash,
                              1.0, None, None, method)


_retriever: HybridRetriever | None = None
_lock = threading.Lock()


def get_retriever(session: Session | None = None, refresh: bool = False) -> HybridRetriever:
    global _retriever
    with _lock:
        if _retriever is None:
            _retriever = HybridRetriever()
            refresh = True
        if refresh and session is not None:
            _retriever.sync(session)
        return _retriever


def reset_retriever() -> None:
    global _retriever
    with _lock:
        _retriever = None
