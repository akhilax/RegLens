"""One-shot project setup: Python venv + backend deps + npm deps.

Usage:  npm run setup            (core + ML extras, ML failures are non-fatal)
        npm run setup -- --lite  (skip ChromaDB / sentence-transformers)
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import venv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
VENV = BACKEND / ".venv"
IS_WIN = os.name == "nt"
VENV_PY = VENV / ("Scripts/python.exe" if IS_WIN else "bin/python")


def run(cmd: list[str], cwd: Path = ROOT, check: bool = True) -> int:
    print(f"\n$ {' '.join(cmd)}", flush=True)
    npm_like = cmd[0] in {"npm", "npx"}
    result = subprocess.run(cmd, cwd=str(cwd), shell=IS_WIN and npm_like)
    if check and result.returncode != 0:
        sys.exit(f"Command failed ({result.returncode}): {' '.join(cmd)}")
    return result.returncode


def main() -> None:
    lite = "--lite" in sys.argv
    if sys.version_info < (3, 11):
        sys.exit("Python 3.11+ is required.")

    if not VENV_PY.exists():
        print(f"Creating virtualenv at {VENV}")
        venv.EnvBuilder(with_pip=True).create(str(VENV))

    py = str(VENV_PY)
    run([py, "-m", "pip", "install", "--upgrade", "pip"])
    run([py, "-m", "pip", "install", "-r", str(BACKEND / "requirements.txt")])

    if not lite:
        code = run([py, "-m", "pip", "install", "-r", str(BACKEND / "requirements-ml.txt")], check=False)
        if code != 0:
            print(
                "\n[warn] Optional ML extras (ChromaDB / sentence-transformers) failed to install.\n"
                "       RegLens will use its built-in hashed embeddings + NumPy vector store instead."
            )

    env_file = BACKEND / ".env"
    if not env_file.exists():
        shutil.copy(BACKEND / ".env.example", env_file)
        print("Created backend/.env from .env.example (mock LLM, no API key needed).")

    if shutil.which("npm") is None:
        sys.exit("npm was not found. Install Node.js 20+ from https://nodejs.org/")
    run(["npm", "install"], cwd=ROOT)
    run(["npm", "install"], cwd=ROOT / "frontend")

    print("\nSetup complete. Next: npm run seed  then  npm run dev")


if __name__ == "__main__":
    main()
