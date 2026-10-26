"""Seed everything: synthetic data, regulatory KB and a full analysis run."""

from __future__ import annotations

import csv
import shutil
import time
from datetime import date, datetime
from pathlib import Path

from reglens.config import get_settings
from reglens.core.db import init_db, session_scope
from reglens.core.models import Account, Customer, Transaction
from reglens.core.synthetic import generate, write_dataset
from reglens.kb.retriever import get_retriever, reset_retriever
from reglens.kb.store import ingest_directory


def _read(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def load_synthetic(session, directory: Path) -> tuple[int, int, int]:
    customers = _read(directory / "customers.csv")
    accounts = _read(directory / "accounts.csv")
    txns = _read(directory / "transactions.csv")
    session.add_all(Customer(
        id=c["id"], name=c["name"], type=c["type"], risk=c["risk"], is_pep=c["is_pep"] == "True",
        has_pan=c["has_pan"] == "True", pan=c["pan"] or None, kyc_last_updated=date.fromisoformat(c["kyc_last_updated"]),
        country=c["country"],
    ) for c in customers)
    session.add_all(Account(id=a["id"], customer_id=a["customer_id"], account_number=a["account_number"],
                            type=a["type"], opened_on=date.fromisoformat(a["opened_on"])) for a in accounts)
    session.add_all(Transaction(
        id=t["id"], account_id=t["account_id"], timestamp=datetime.fromisoformat(t["timestamp"]),
        amount_inr=float(t["amount_inr"]), currency=t["currency"], channel=t["channel"], direction=t["direction"],
        counterparty_id=t["counterparty_id"] or None, counterparty_country=t["counterparty_country"],
        purpose_code=t["purpose_code"] or None, source="synthetic",
    ) for t in txns)
    session.flush()
    return len(customers), len(accounts), len(txns)


def seed_all(analyze: bool = True, quiet: bool = False) -> dict:
    settings = get_settings()
    log = (lambda *a: None) if quiet else print
    t0 = time.perf_counter()

    reset_retriever()
    shutil.rmtree(settings.chroma_dir, ignore_errors=True)
    init_db(drop=True)

    ds = generate()
    write_dataset(ds, settings.synthetic_dir)
    log(f"Generated {len(ds.customers)} customers, {len(ds.accounts)} accounts, {len(ds.transactions)} transactions "
        f"({len(ds.truth)} planted) -> {settings.synthetic_dir}")

    with session_scope() as s:
        n = load_synthetic(s, settings.synthetic_dir)
        results = ingest_directory(s, settings.regulations_dir)
    log(f"Ingested {len(results)} regulatory documents")

    with session_scope() as s:
        retriever = get_retriever(s, refresh=True)
        log(f"Retriever ready: {retriever.backend} ({len(retriever.active_ids())} chunks)")

    summary: dict = {"documents": len(results), "transactions": n[2]}
    if analyze:
        from reglens.pipeline.jobs import start_run

        run_id = start_run(source="seed", pace_ms=0, background=False)
        summary.update(run_id=run_id)
        log(f"Analysis run #{run_id} complete.")
    log(f"Seed finished in {time.perf_counter() - t0:.1f}s")
    return summary
