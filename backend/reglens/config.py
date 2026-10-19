"""Runtime configuration (env vars with safe offline defaults)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
REPORTS_DIR = BACKEND_DIR / "reports"

load_dotenv(BACKEND_DIR / ".env", override=False)
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")


def _env(name: str, default: str) -> str:
    value = os.environ.get(name)
    return value if value not in (None, "") else default


@dataclass(frozen=True)
class Settings:
    db_url: str = field(default_factory=lambda: _env("REGLENS_DB_URL", f"sqlite:///{(DATA_DIR / 'reglens.db').as_posix()}"))
    llm_provider: str = field(default_factory=lambda: _env("LLM_PROVIDER", "mock").lower())
    llm_model: str = field(default_factory=lambda: _env("LLM_MODEL", "claude-sonnet-5-5"))
    anthropic_api_key: str = field(default_factory=lambda: _env("ANTHROPIC_API_KEY", ""))
    ollama_url: str = field(default_factory=lambda: _env("OLLAMA_URL", "http://localhost:11434"))
    ollama_model: str = field(default_factory=lambda: _env("OLLAMA_MODEL", "llama3.1"))
    embedder: str = field(default_factory=lambda: _env("REGLENS_EMBEDDER", "auto").lower())
    vector_store: str = field(default_factory=lambda: _env("REGLENS_VECTOR_STORE", "auto").lower())
    analysis_pace_ms: int = field(default_factory=lambda: int(_env("ANALYSIS_PACE_MS", "12")))
    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            o.strip() for o in _env("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()
        )
    )
    regulations_dir: Path = DATA_DIR / "regulations"
    synthetic_dir: Path = DATA_DIR / "synthetic"
    vectors_dir: Path = DATA_DIR / "vectors"
    chroma_dir: Path = DATA_DIR / "chroma"
    retrieval_top_k: int = 6
    low_confidence_threshold: float = 0.6


@lru_cache
def get_settings() -> Settings:
    return Settings()
