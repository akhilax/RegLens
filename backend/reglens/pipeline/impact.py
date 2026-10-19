"""Regulation change impact analysis: which decisions cite clauses that a new version changed or removed?"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from reglens.audit.chain import append as audit
from reglens.core.models import Decision
from reglens.kb.store import IngestResult
from reglens.review.service import mark_for_re_review


def cited_chunk_ids(d: Decision) -> set[str]:
    return {cid for reg in d.output.get("applicable_regulations", []) for cid in reg.get("citation_chunk_ids", [])}


def analyze_impact(session: Session, result: IngestResult, actor: str = "system") -> dict[str, Any]:
    if result.status != "new_version":
        return {"impacted": [], "informational": 0, "changed_sections": []}

    changed = {d.old_chunk_id: d for d in result.diff if d.change in ("changed", "removed") and d.old_chunk_id}
    prefix = f"{result.reg_id}@v{result.previous_version}#"
    impacted: list[dict[str, Any]] = []
    informational = 0
    rows = session.scalars(select(Decision).where(Decision.is_current, Decision.status != "auto_cleared")).all()
    for d in rows:
        cited = cited_chunk_ids(d)
        hits = sorted(cited & set(changed))
        if hits:
            sections = [changed[h].section for h in hits]
            reason = (f"{result.reg_id} v{result.previous_version}→v{result.version} changed "
                      f"{', '.join(sections)}; decision cited superseded clause(s).")
            prev_status = d.status
            mark_for_re_review(session, d, reason, actor)
            impacted.append({"decision_id": d.id, "transaction_id": d.transaction_id, "previous_status": prev_status,
                             "risk_level": d.risk_level, "sections": sections, "cited_chunk_ids": hits})
        elif any(c.startswith(prefix) for c in cited):
            informational += 1

    audit(session, "IMPACT_ANALYSIS", "reg_document", result.document_id, actor, {
        "reg_id": result.reg_id, "from_version": result.previous_version, "to_version": result.version,
        "impacted_decisions": [i["decision_id"] for i in impacted], "informational": informational,
    })
    session.flush()
    return {"impacted": impacted, "informational": informational,
            "changed_sections": [d.section for d in result.diff if d.change != "unchanged"]}
