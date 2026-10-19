"""Append-only, hash-chained audit log.

hash_n = SHA256(prev_hash || timestamp || event_type || entity_type || entity_id || actor || payload_json)
Any edit to a historic row breaks that row's hash and every link after it.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any

from sqlalchemy import event, select
from sqlalchemy.orm import Session

from reglens.core.models import AuditEntry, utcnow
from reglens.core.utils import canonical_json, sha256

GENESIS = "0" * 64

# Appends are serialised per process: the lock is taken on the first append in a session transaction and
# released when that transaction commits or rolls back, so concurrent writers can never fork the chain.
_CHAIN_LOCK = threading.RLock()
_HELD = "audit_chain_lock"


def _release(session: Session, *_args: Any) -> None:
    if session.info.pop(_HELD, False):
        _CHAIN_LOCK.release()


event.listen(Session, "after_commit", _release)
event.listen(Session, "after_rollback", _release)
event.listen(Session, "after_soft_rollback", _release)


def compute_hash(prev_hash: str, timestamp: str, event_type: str, entity_type: str, entity_id: str, actor: str,
                 payload: str) -> str:
    return sha256("|".join([prev_hash, timestamp, event_type, entity_type, entity_id, actor, payload]))


def append(session: Session, event_type: str, entity_type: str, entity_id: str | int, actor: str,
           payload: dict[str, Any]) -> AuditEntry:
    if not session.info.get(_HELD):
        _CHAIN_LOCK.acquire()
        session.info[_HELD] = True
    last = session.scalars(select(AuditEntry).order_by(AuditEntry.id.desc()).limit(1)).first()
    prev = last.hash if last else GENESIS
    ts = utcnow()
    body = canonical_json(payload)
    entry = AuditEntry(
        timestamp=ts, event_type=event_type, entity_type=entity_type, entity_id=str(entity_id), actor=actor,
        payload=body, prev_hash=prev,
        hash=compute_hash(prev, ts.isoformat(), event_type, entity_type, str(entity_id), actor, body),
    )
    session.add(entry)
    session.flush()
    return entry


@dataclass
class BlockStatus:
    id: int
    hash: str
    valid: bool
    reason: str | None = None


@dataclass
class ChainReport:
    valid: bool
    checked: int
    broken_at: int | None
    blocks: list[BlockStatus]


def verify_entries(entries: list[dict[str, Any]]) -> ChainReport:
    """Verify a chain given as plain dicts (works for DB rows or a tampered in-memory copy)."""
    prev = GENESIS
    blocks: list[BlockStatus] = []
    broken_at: int | None = None
    for e in entries:
        reason = None
        if broken_at is not None:
            reason = "after break"
        elif e["prev_hash"] != prev:
            reason = "prev_hash mismatch"
        else:
            expected = compute_hash(e["prev_hash"], e["timestamp"], e["event_type"], e["entity_type"],
                                    e["entity_id"], e["actor"], e["payload"])
            if expected != e["hash"]:
                reason = "content hash mismatch"
        ok = reason is None
        if not ok and broken_at is None:
            broken_at = e["id"]
        blocks.append(BlockStatus(e["id"], e["hash"], ok, reason))
        prev = e["hash"]
    return ChainReport(broken_at is None, len(entries), broken_at, blocks)


def entry_dict(e: AuditEntry) -> dict[str, Any]:
    return {
        "id": e.id, "timestamp": e.timestamp.isoformat(), "event_type": e.event_type, "entity_type": e.entity_type,
        "entity_id": e.entity_id, "actor": e.actor, "payload": e.payload, "prev_hash": e.prev_hash, "hash": e.hash,
    }


def verify_chain(session: Session) -> ChainReport:
    # populate_existing: always re-read stored values, never trust objects cached in the identity map
    rows = session.scalars(
        select(AuditEntry).order_by(AuditEntry.id).execution_options(populate_existing=True)
    ).all()
    return verify_entries([entry_dict(r) for r in rows])


def simulate_tamper(session: Session, entry_id: int) -> ChainReport:
    """Demo only: tamper with an in-memory COPY of the chain — the real log is never modified."""
    rows = [entry_dict(r) for r in session.scalars(select(AuditEntry).order_by(AuditEntry.id)).all()]
    for row in rows:
        if row["id"] == entry_id:
            row["payload"] = row["payload"].replace("}", ',"tampered":true}', 1) if row["payload"] else "tampered"
            break
    return verify_entries(rows)
