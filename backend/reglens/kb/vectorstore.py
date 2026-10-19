"""Vector stores: ChromaDB (persistent) or an in-process NumPy store. Both use cosine similarity."""

from __future__ import annotations

import logging
from typing import Protocol

import numpy as np

from reglens.config import get_settings

log = logging.getLogger(__name__)


class VectorStore(Protocol):
    name: str

    def ids(self) -> set[str]: ...

    def upsert(self, ids: list[str], vectors: np.ndarray) -> None: ...

    def delete(self, ids: list[str]) -> None: ...

    def query(self, vector: np.ndarray, k: int, allowed: set[str] | None = None) -> list[tuple[str, float]]: ...


class NumpyStore:
    name = "numpy"

    def __init__(self) -> None:
        self._ids: list[str] = []
        self._mat = np.zeros((0, 0), dtype=np.float32)

    def ids(self) -> set[str]:
        return set(self._ids)

    def upsert(self, ids: list[str], vectors: np.ndarray) -> None:
        if not ids:
            return
        self.delete(ids)
        self._ids.extend(ids)
        self._mat = vectors if self._mat.size == 0 else np.vstack([self._mat, vectors])

    def delete(self, ids: list[str]) -> None:
        drop = set(ids)
        keep = [i for i, cid in enumerate(self._ids) if cid not in drop]
        if len(keep) == len(self._ids):
            return
        self._ids = [self._ids[i] for i in keep]
        self._mat = self._mat[keep] if keep else np.zeros((0, 0), dtype=np.float32)

    def query(self, vector: np.ndarray, k: int, allowed: set[str] | None = None) -> list[tuple[str, float]]:
        if not self._ids:
            return []
        sims = self._mat @ vector
        order = np.argsort(-sims)
        out = []
        for i in order:
            cid = self._ids[i]
            if allowed is not None and cid not in allowed:
                continue
            out.append((cid, float(sims[i])))
            if len(out) >= k:
                break
        return out


class ChromaStore:
    name = "chroma"

    def __init__(self, collection: str) -> None:
        import chromadb

        settings = get_settings()
        settings.chroma_dir.mkdir(parents=True, exist_ok=True)
        client = chromadb.PersistentClient(path=str(settings.chroma_dir))
        self._col = client.get_or_create_collection(collection, metadata={"hnsw:space": "cosine"})

    def ids(self) -> set[str]:
        return set(self._col.get(include=[])["ids"])

    def upsert(self, ids: list[str], vectors: np.ndarray) -> None:
        if ids:
            self._col.upsert(ids=ids, embeddings=vectors.tolist())

    def delete(self, ids: list[str]) -> None:
        if ids:
            self._col.delete(ids=ids)

    def query(self, vector: np.ndarray, k: int, allowed: set[str] | None = None) -> list[tuple[str, float]]:
        n = self._col.count()
        if n == 0:
            return []
        res = self._col.query(query_embeddings=[vector.tolist()], n_results=n, include=["distances"])
        out = []
        for cid, dist in zip(res["ids"][0], res["distances"][0], strict=False):
            if allowed is not None and cid not in allowed:
                continue
            out.append((cid, 1.0 - float(dist)))
            if len(out) >= k:
                break
        return out


def make_store(embedder_name: str) -> VectorStore:
    choice = get_settings().vector_store
    if choice in ("auto", "chroma"):
        try:
            safe = "".join(c if c.isalnum() else "_" for c in embedder_name)
            return ChromaStore(f"reglens_{safe}")
        except Exception as exc:
            if choice == "chroma":
                raise
            log.warning("ChromaDB unavailable (%s); using NumPy vector store", exc)
    return NumpyStore()
