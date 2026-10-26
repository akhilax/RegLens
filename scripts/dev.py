"""Backend task runner: api | test | lint | openapi."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"


def main() -> None:
    task = sys.argv[1] if len(sys.argv) > 1 else "api"
    py = sys.executable
    env = {**os.environ, "PYTHONPATH": str(BACKEND)}

    if task == "api":
        port = os.environ.get("API_PORT", "8000")
        cmd = [py, "-m", "uvicorn", "api.main:app", "--reload", "--port", port, "--app-dir", str(BACKEND)]
        sys.exit(subprocess.call(cmd, cwd=str(BACKEND), env=env))
    if task == "test":
        env["REGLENS_EMBEDDER"] = "hash"
        sys.exit(subprocess.call([py, "-m", "pytest", "-q", *sys.argv[2:]], cwd=str(BACKEND), env=env))
    if task == "lint":
        sys.exit(subprocess.call([py, "-m", "ruff", "check", "."], cwd=str(BACKEND), env=env))
    if task == "openapi":
        sys.path.insert(0, str(BACKEND))
        from api.main import app

        out = ROOT / "frontend" / "src" / "api" / "openapi.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(app.openapi(), indent=2), encoding="utf-8")
        print(f"Wrote {out}")
        return
    sys.exit(f"Unknown task: {task}")


if __name__ == "__main__":
    main()
