"""Embedding backends: sentence-transformers (semantic) or hashed features (offline fallback)."""

from __future__ import annotations

import logging
import re
import zlib
from functools import lru_cache
from typing import Protocol

import numpy as np

from reglens.config import get_settings

log = logging.getLogger(__name__)
DIM = 384
_TOKEN = re.compile(r"[a-z0-9]+")
STOPWORDS = frozenset(
    "a an and are as at be by for from has have in is it its of on or such that the this to was were which with "
    "within any all must may shall be been being per".split()
)


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN.findall(text.lower()) if t not in STOPWORDS]


class Embedder(Protocol):
    name: str

    def embed(self, texts: list[str]) -> np.ndarray: ...


class HashEmbedder:
    """Deterministic signed feature hashing over unigrams + bigrams, L2-normalised."""

    name = "hash-384"

    def embed(self, texts: list[str]) -> np.ndarray:
        out = np.zeros((len(texts), DIM), dtype=np.float32)
        for row, text in enumerate(texts):
            toks = tokenize(text)
            feats = toks + [f"{a}_{b}" for a, b in zip(toks, toks[1:], strict=False)]
            for f in feats:
                h = zlib.crc32(f.encode())
                out[row, h % DIM] += 1.0 if (h >> 16) & 1 else -1.0
            norm = np.linalg.norm(out[row])
            if norm:
                out[row] /= norm
        return out


class SentenceTransformerEmbedder:
    name = "all-MiniLM-L6-v2"

    def __init__(self) -> None:
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    def embed(self, texts: list[str]) -> np.ndarray:
        vecs = self.model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return np.asarray(vecs, dtype=np.float32)


@lru_cache
def get_embedder() -> Embedder:
    choice = get_settings().embedder
    if choice in ("auto", "st"):
        try:
            return SentenceTransformerEmbedder()
        except Exception as exc:  # missing package, no network for first download, etc.
            if choice == "st":
                raise
            log.warning("sentence-transformers unavailable (%s); using hashed embeddings", exc)
    return HashEmbedder()
