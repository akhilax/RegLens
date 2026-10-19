"""Evaluate current decisions against ground_truth.csv and write backend/reports/eval.{md,json}."""

from __future__ import annotations

import json
import statistics
from collections import Counter, defaultdict
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from reglens.config import REPORTS_DIR, get_settings
from reglens.core.db import new_session
from reglens.core.models import Decision, Transaction
from reglens.core.synthetic import read_ground_truth
from reglens.rules.engine import get_ruleset


def _prf(tp: int, fp: int, fn: int) -> dict[str, float]:
    p = tp / (tp + fp) if tp + fp else 1.0
    r = tp / (tp + fn) if tp + fn else 1.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    return {"precision": round(p, 4), "recall": round(r, 4), "f1": round(f1, 4), "tp": tp, "fp": fp, "fn": fn}


def _split(value: str) -> set[str]:
    return {v for v in (value or "").split(";") if v}


def compute(session: Session) -> dict[str, Any]:
    truth = read_ground_truth(get_settings().synthetic_dir / "ground_truth.csv")
    ruleset = get_ruleset()
    rule_regs = {r.id: {ref.split("#")[0] for ref in r.source_refs} for r in ruleset.rules}
    decisions = {d.transaction_id: d for d in session.scalars(select(Decision).where(Decision.is_current)).all()}
    txn_ids = list(session.scalars(select(Transaction.id).where(Transaction.source == "synthetic")).all())

    counts = {k: Counter() for k in ("rules", "obligations", "regulations")}
    per_rule: dict[str, Counter] = defaultdict(Counter)
    scenarios: dict[str, dict[str, int]] = defaultdict(lambda: {"transactions": 0, "detected": 0})
    confusion = Counter()
    valid_cites = invalid_cites = 0
    routed = 0
    latencies: list[float] = []
    missing = 0

    for tid in txn_ids:
        d = decisions.get(tid)
        if d is None:
            missing += 1
            continue
        t = truth.get(tid)
        exp_rules = _split(t.expected_rules) if t else set()
        exp_obl = _split(t.expected_obligations) if t else set()
        exp_regs = set().union(*(rule_regs[r] for r in exp_rules)) if exp_rules else set()

        pred_rules = {h["rule_id"] for h in d.rules_fired}
        pred_obl = {o["type"] for o in d.obligations}
        pred_regs = {r["reg_id"] for r in d.output.get("applicable_regulations", [])}

        for key, exp, pred in (("rules", exp_rules, pred_rules), ("obligations", exp_obl, pred_obl),
                               ("regulations", exp_regs, pred_regs)):
            counts[key]["tp"] += len(exp & pred)
            counts[key]["fp"] += len(pred - exp)
            counts[key]["fn"] += len(exp - pred)
        for rid in exp_rules | pred_rules:
            per_rule[rid]["tp" if rid in exp_rules and rid in pred_rules else "fn" if rid in exp_rules else "fp"] += 1

        if t:
            s = scenarios[t.scenario]
            s["transactions"] += 1
            s["detected"] += int(exp_rules == pred_rules)

        needs = bool(exp_rules)
        flagged = bool(pred_rules)
        confusion["tp" if needs and flagged else "fn" if needs else "fp" if flagged else "tn"] += 1

        valid_cites += sum(len(r.get("citation_chunk_ids", [])) for r in d.output.get("applicable_regulations", []))
        invalid_cites += len(d.invalid_citations)
        routed += int(d.requires_review)
        latencies.append(d.latency_ms)

    total = len(txn_ids) - missing
    lat_sorted = sorted(latencies)
    return {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "transactions_evaluated": total,
        "missing_decisions": missing,
        "rules": _prf(**{k: counts["rules"][k] for k in ("tp", "fp", "fn")}),
        "obligations": _prf(**{k: counts["obligations"][k] for k in ("tp", "fp", "fn")}),
        "regulations": _prf(**{k: counts["regulations"][k] for k in ("tp", "fp", "fn")}),
        "per_rule": {rid: _prf(c["tp"], c["fp"], c["fn"]) for rid, c in sorted(per_rule.items())},
        "scenarios": dict(sorted(scenarios.items())),
        "confusion": dict(confusion),
        "citations": {"valid": valid_cites, "invalid_stripped": invalid_cites,
                      "validity_rate_raw": round(valid_cites / (valid_cites + invalid_cites), 4)
                      if valid_cites + invalid_cites else 1.0,
                      "validity_rate_after_guardrail": 1.0},
        "routing": {"routed_to_human": routed, "pct_routed": round(routed / total, 4) if total else 0.0},
        "latency_ms": {"mean": round(statistics.fmean(latencies), 2) if latencies else 0.0,
                       "p95": round(lat_sorted[int(0.95 * (len(lat_sorted) - 1))], 2) if lat_sorted else 0.0,
                       "max": round(max(latencies), 2) if latencies else 0.0},
        "provider": next(iter(decisions.values())).model_name if decisions else None,
    }


def to_markdown(r: dict[str, Any]) -> str:
    def row(name: str, m: dict[str, Any]) -> str:
        return f"| {name} | {m['precision']:.3f} | {m['recall']:.3f} | {m['f1']:.3f} | {m['tp']} | {m['fp']} | {m['fn']} |"

    lines = [
        "# RegLens evaluation report", "",
        f"Generated {r['generated_at']} · provider `{r['provider']}` · {r['transactions_evaluated']} transactions", "",
        "## Identification quality (micro-averaged)", "",
        "| Target | Precision | Recall | F1 | TP | FP | FN |", "|---|---|---|---|---|---|---|",
        row("Rules fired", r["rules"]), row("Obligations", r["obligations"]), row("Applicable regulations", r["regulations"]),
        "", "## Per rule", "", "| Rule | Precision | Recall | F1 | TP | FP | FN |", "|---|---|---|---|---|---|---|",
        *[row(k, v) for k, v in r["per_rule"].items()],
        "", "## Planted scenarios", "", "| Scenario | Transactions | Exactly detected |", "|---|---|---|",
        *[f"| {k} | {v['transactions']} | {v['detected']} |" for k, v in r["scenarios"].items()],
        "", "## Guardrails, routing and latency", "",
        f"- Citations kept: **{r['citations']['valid']}**, hallucinated citations stripped: "
        f"**{r['citations']['invalid_stripped']}** (raw validity {r['citations']['validity_rate_raw']:.1%}; "
        "100% after guardrail)",
        f"- Routed to human review: **{r['routing']['routed_to_human']}** "
        f"({r['routing']['pct_routed']:.1%} of transactions)",
        f"- Flagging confusion: {r['confusion']}",
        f"- Latency per transaction: mean {r['latency_ms']['mean']} ms, p95 {r['latency_ms']['p95']} ms",
        "", "_Educational prototype. Ground truth is synthetic; regulatory summaries must be verified._", "",
    ]
    return "\n".join(lines)


def run_evaluation(session: Session | None = None) -> dict[str, Any]:
    own = session is None
    session = session or new_session()
    try:
        result = compute(session)
    finally:
        if own:
            session.close()
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "eval.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    (REPORTS_DIR / "eval.md").write_text(to_markdown(result), encoding="utf-8")
    return result


def latest() -> dict[str, Any] | None:
    path = REPORTS_DIR / "eval.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
