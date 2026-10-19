"""Deterministic rule engine: loads rules.yaml, computes features, evaluates rules, derives deadlines."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, Field, field_validator

from reglens.core.utils import add_working_days, fifteenth_of_next_month, to_date
from reglens.rules.dsl import EvalContext, evaluate, validate

RULES_DIR = Path(__file__).resolve().parent
SEVERITY_ORDER = {"low": 1, "medium": 2, "high": 3, "critical": 4}
DeadlineRule = Literal[
    "15th_of_next_month", "7_working_days_after_determination", "before_processing", "within_30_days", "immediate"
]


class Obligation(BaseModel):
    type: str
    reporting: bool
    description: str


class Rule(BaseModel):
    id: str
    name: str
    description: str
    severity: Literal["low", "medium", "high", "critical"]
    obligation: Obligation
    deadline_rule: DeadlineRule
    source_refs: list[str] = Field(min_length=1)
    condition: dict[str, Any]
    enabled: bool = True

    @field_validator("condition")
    @classmethod
    def _valid_condition(cls, v: dict[str, Any]) -> dict[str, Any]:
        validate(v)
        return v

    @field_validator("source_refs")
    @classmethod
    def _valid_refs(cls, v: list[str]) -> list[str]:
        for ref in v:
            if "#" not in ref:
                raise ValueError(f"source_ref must look like REG-ID#section, got {ref!r}")
        return v


class RuleSet(BaseModel):
    version: int
    params: dict[str, Any]
    lists: dict[str, list[Any]]
    rules: list[Rule]

    def get(self, rule_id: str) -> Rule | None:
        return next((r for r in self.rules if r.id == rule_id), None)


def _resolve_list(spec: Any, base: Path) -> list[Any]:
    if isinstance(spec, str) and spec.startswith("@"):
        file, _, key = spec[1:].partition(":")
        data = yaml.safe_load((base / file).read_text(encoding="utf-8"))
        return list(data[key])
    return list(spec)


def load_ruleset(path: Path | None = None) -> RuleSet:
    path = path or RULES_DIR / "rules.yaml"
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    raw["lists"] = {k: _resolve_list(v, path.parent) for k, v in (raw.get("lists") or {}).items()}
    return RuleSet.model_validate(raw)


@lru_cache
def get_ruleset() -> RuleSet:
    return load_ruleset()


# ---------------------------------------------------------------- features

def flatten(txn: Any, customer: Any, account: Any, params: dict[str, Any]) -> dict[str, Any]:
    """Build the flat feature namespace a rule condition can reference."""
    ts: datetime = txn.timestamp
    kyc_years = params.get("kyc_periodicity_years", {}).get(customer.risk, 10)
    kyc_last: date = customer.kyc_last_updated
    try:
        kyc_due = kyc_last.replace(year=kyc_last.year + int(kyc_years))
    except ValueError:  # 29 Feb
        kyc_due = kyc_last.replace(year=kyc_last.year + int(kyc_years), day=28)
    rate = float(params.get("usd_inr_rate", 88.0))
    return {
        "id": txn.id,
        "account_id": txn.account_id,
        "timestamp": ts,
        "amount_inr": float(txn.amount_inr),
        "amount_usd": round(float(txn.amount_inr) / rate, 2),
        "currency": txn.currency,
        "channel": txn.channel,
        "direction": txn.direction,
        "counterparty_id": txn.counterparty_id or None,
        "counterparty_country": txn.counterparty_country,
        "purpose_code": txn.purpose_code,
        "is_cross_border": txn.channel == "SWIFT" or txn.counterparty_country != "IN",
        "customer.id": customer.id,
        "customer.type": customer.type,
        "customer.risk": customer.risk,
        "customer.is_pep": bool(customer.is_pep),
        "customer.has_pan": bool(customer.has_pan),
        "customer.country": customer.country,
        "account.type": account.type,
        "kyc_due_date": kyc_due,
        "kyc_overdue_days": (to_date(ts) - kyc_due).days,
    }


def public_features(flat: dict[str, Any]) -> dict[str, Any]:
    """JSON-safe, PII-free copy of the features for trace storage and the LLM."""
    out = {}
    for k, v in flat.items():
        if k in {"customer.id"}:
            continue
        out[k] = v.isoformat() if isinstance(v, (date, datetime)) else v
    return out


# ---------------------------------------------------------------- evaluation

@dataclass
class RuleHit:
    rule_id: str
    name: str
    description: str
    severity: str
    obligation: dict[str, Any]
    deadline_rule: str
    deadline: str | None
    deadline_basis: str
    source_refs: list[str]
    evidence: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        for e in d["evidence"]:
            for k in ("actual", "expected"):
                if isinstance(e.get(k), (date, datetime)):
                    e[k] = e[k].isoformat()
        return d


def compute_deadline(rule: str, txn_date: date, determination: date | None = None) -> tuple[str | None, str]:
    if rule == "15th_of_next_month":
        return fifteenth_of_next_month(txn_date).isoformat(), "15th of the month after the transaction"
    if rule == "7_working_days_after_determination":
        if determination is None:
            return None, "7 working days after the Principal Officer determines suspicion"
        return add_working_days(determination, 7).isoformat(), "7 working days after determination"
    if rule == "within_30_days":
        from datetime import timedelta

        return (txn_date + timedelta(days=30)).isoformat(), "30 days from the transaction (internal SLA)"
    if rule in ("before_processing", "immediate"):
        return txn_date.isoformat(), "before the transaction is processed"
    return None, rule


def evaluate_rules(flat: dict[str, Any], history: list[dict[str, Any]], ruleset: RuleSet | None = None) -> list[RuleHit]:
    rs = ruleset or get_ruleset()
    hits: list[RuleHit] = []
    for rule in rs.rules:
        if not rule.enabled:
            continue
        ctx = EvalContext(current=flat, history=history, params=rs.params, lists=rs.lists)
        if evaluate(rule.condition, ctx):
            due, basis = compute_deadline(rule.deadline_rule, to_date(flat["timestamp"]))
            hits.append(RuleHit(rule.id, rule.name, rule.description, rule.severity, rule.obligation.model_dump(),
                                rule.deadline_rule, due, basis, rule.source_refs, ctx.evidence))
    return hits


def max_severity(hits: list[RuleHit]) -> str | None:
    if not hits:
        return None
    return max((h.severity for h in hits), key=lambda s: SEVERITY_ORDER[s])
