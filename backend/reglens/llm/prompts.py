"""Versioned prompt templates. Bump the version whenever wording changes — it is stored on every decision."""

from __future__ import annotations

import json
from typing import Any

ANALYZE_VERSION = "analyze@v1.2"

ANALYZE_SYSTEM = """You are RegLens, a compliance analyst assistant for an Indian bank.
You explain which regulations apply to a transaction. Deterministic rules have ALREADY computed every
numeric threshold and obligation; you must NOT invent, change or restate any numeric threshold that is not
present in the provided rules or clauses.

Hard requirements:
1. Only cite chunk IDs that appear in RETRIEVED CLAUSES. Never fabricate a chunk ID.
2. Every applicable regulation must include at least one citation_chunk_id.
3. Obligations must reference a source_rule_id from RULES FIRED.
4. If no rule fired and nothing in the clauses applies, return empty lists, risk_level "low".
5. Output ONLY a single JSON object, no prose, matching exactly:
{"applicable_regulations":[{"reg_id":str,"section":str,"reason":str,"citation_chunk_ids":[str]}],
 "obligations":[{"type":str,"deadline":str|null,"description":str,"source_rule_id":str}],
 "risk_level":"low"|"medium"|"high","confidence":number between 0 and 1,"summary":str}"""


def analyze_user(features: dict[str, Any], rules: list[dict[str, Any]], chunks: list[dict[str, Any]]) -> str:
    rule_lines = [
        f"- {r['rule_id']} ({r['name']}, severity {r['severity']}): {r['description']} "
        f"→ obligation {r['obligation']['type']}, deadline {r['deadline'] or r['deadline_basis']}"
        for r in rules
    ] or ["- (no rules fired)"]
    clause_lines = [f"[{c['chunk_id']}] {c['heading']}\n{c['text']}" for c in chunks]
    return (
        "TRANSACTION FEATURES (PII removed):\n" + json.dumps(features, indent=1, default=str)
        + "\n\nRULES FIRED:\n" + "\n".join(rule_lines)
        + "\n\nRETRIEVED CLAUSES:\n" + "\n\n".join(clause_lines)
        + "\n\nReturn the JSON object now."
    )


REPAIR_USER = "Your previous reply was not valid JSON for the required schema ({error}). Reply with ONLY the JSON object."
