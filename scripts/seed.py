"""Seed RegLens: synthetic data -> SQLite, regulations -> KB index, full analysis, evaluation."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from reglens.seed import seed_all  # noqa: E402

if __name__ == "__main__":
    seed_all(analyze="--no-analyze" not in sys.argv)
