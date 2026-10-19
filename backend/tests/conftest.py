import os
import sys
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="reglens-test-"))
os.environ["REGLENS_DB_URL"] = f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["REGLENS_EMBEDDER"] = "hash"
os.environ["REGLENS_VECTOR_STORE"] = "numpy"
os.environ["LLM_PROVIDER"] = "mock"
os.environ["ANALYSIS_PACE_MS"] = "0"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

from reglens.core.db import configure, new_session  # noqa: E402


@pytest.fixture(scope="module")
def seeded():
    """A freshly seeded and fully analysed database, rebuilt for every test module."""
    from reglens.seed import seed_all

    configure(os.environ["REGLENS_DB_URL"])
    return seed_all(analyze=True, quiet=True)


@pytest.fixture
def session(seeded):
    s = new_session()
    try:
        yield s
    finally:
        s.rollback()
        s.close()
