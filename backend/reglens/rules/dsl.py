"""A small, safe condition DSL. No eval/exec: every node type and operator is whitelisted.

Node forms
  {all: [node, ...]}  {any: [node, ...]}  {not: node}
  {field: <name>, op: <op>, value: <literal | $params.x | $lists.y>, band?: [lo, hi]}
  {agg: sum|count|max, field?: <name>, window: day|calendar_month|financial_year|{days: N},
   where?: [node, ...], match?: [field, ...], op: <op>, value: ...}
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any

from reglens.core.utils import financial_year_start

FIELD_RE = re.compile(r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?$")
AGGS = {"sum", "count", "max"}


class RuleDSLError(ValueError):
    pass


def _near_any(x: Any, thresholds: Any, band: Any) -> bool:
    lo, hi = band or (0.8, 1.0)
    return any(lo * t <= float(x) < hi * t for t in thresholds)


OPS: dict[str, Callable[..., bool]] = {
    "eq": lambda a, b, **_: a == b,
    "ne": lambda a, b, **_: a != b,
    "gt": lambda a, b, **_: a is not None and float(a) > float(b),
    "gte": lambda a, b, **_: a is not None and float(a) >= float(b),
    "lt": lambda a, b, **_: a is not None and float(a) < float(b),
    "lte": lambda a, b, **_: a is not None and float(a) <= float(b),
    "in": lambda a, b, **_: a in (b or []),
    "not_in": lambda a, b, **_: a not in (b or []),
    "between": lambda a, b, **_: a is not None and float(b[0]) <= float(a) <= float(b[1]),
    "near_any": lambda a, b, band=None, **_: a is not None and _near_any(a, b, band),
    "exists": lambda a, b, **_: a not in (None, ""),
    "not_exists": lambda a, b, **_: a in (None, ""),
    "is_true": lambda a, b, **_: a is True,
    "is_false": lambda a, b, **_: a is False,
}


@dataclass
class EvalContext:
    current: dict[str, Any]
    history: list[dict[str, Any]]  # same-customer transactions up to and including current, chronological
    params: dict[str, Any]
    lists: dict[str, list[Any]]
    evidence: list[dict[str, Any]] = field(default_factory=list)

    def resolve(self, value: Any) -> Any:
        if isinstance(value, str) and value.startswith("$"):
            ns, _, key = value[1:].partition(".")
            source = {"params": self.params, "lists": self.lists}.get(ns)
            if source is None or key not in source:
                raise RuleDSLError(f"Unknown reference {value}")
            return source[key]
        if isinstance(value, list):
            return [self.resolve(v) for v in value]
        if isinstance(value, dict):
            return {k: self.resolve(v) for k, v in value.items()}
        return value


def validate(node: Any, path: str = "condition") -> None:
    """Static validation so malformed rules fail at load time, not mid-analysis."""
    if not isinstance(node, dict):
        raise RuleDSLError(f"{path}: node must be a mapping")
    if "all" in node or "any" in node:
        key = "all" if "all" in node else "any"
        if not isinstance(node[key], list) or not node[key]:
            raise RuleDSLError(f"{path}.{key}: must be a non-empty list")
        for i, child in enumerate(node[key]):
            validate(child, f"{path}.{key}[{i}]")
        return
    if "not" in node:
        validate(node["not"], f"{path}.not")
        return
    if "agg" in node:
        if node["agg"] not in AGGS:
            raise RuleDSLError(f"{path}: unknown aggregate {node['agg']}")
        if node["agg"] != "count" and "field" not in node:
            raise RuleDSLError(f"{path}: aggregate {node['agg']} needs a field")
        for i, child in enumerate(node.get("where", [])):
            validate(child, f"{path}.where[{i}]")
    elif "field" not in node:
        raise RuleDSLError(f"{path}: expected all/any/not/agg/field")
    if "field" in node and not FIELD_RE.match(str(node["field"])):
        raise RuleDSLError(f"{path}: invalid field name {node['field']!r}")
    if node.get("op") not in OPS:
        raise RuleDSLError(f"{path}: unknown operator {node.get('op')!r}")


def _compare(op: str, actual: Any, expected: Any, band: Any = None) -> bool:
    try:
        return OPS[op](actual, expected, band=band)
    except (TypeError, ValueError):
        return False


def _in_window(window: Any, current_ts: datetime, ts: datetime) -> bool:
    cur: date = current_ts.date()
    d: date = ts.date()
    if window == "day":
        return d == cur
    if window == "calendar_month":
        return (d.year, d.month) == (cur.year, cur.month)
    if window == "financial_year":
        return financial_year_start(d) == financial_year_start(cur)
    if isinstance(window, dict) and "days" in window:
        days = int(window["days"])
        return cur - timedelta(days=days - 1) <= d <= cur
    raise RuleDSLError(f"Unknown window {window!r}")


def _match_simple(node: dict[str, Any], row: dict[str, Any], ctx: EvalContext) -> bool:
    if "all" in node:
        return all(_match_simple(c, row, ctx) for c in node["all"])
    if "any" in node:
        return any(_match_simple(c, row, ctx) for c in node["any"])
    if "not" in node:
        return not _match_simple(node["not"], row, ctx)
    return _compare(node["op"], row.get(node["field"]), ctx.resolve(node.get("value")), ctx.resolve(node.get("band")))


def evaluate(node: dict[str, Any], ctx: EvalContext) -> bool:
    if "all" in node:
        return all([evaluate(c, ctx) for c in node["all"]])  # evaluate all for complete evidence
    if "any" in node:
        return any([evaluate(c, ctx) for c in node["any"]])
    if "not" in node:
        return not evaluate(node["not"], ctx)

    expected = ctx.resolve(node.get("value"))
    band = ctx.resolve(node.get("band"))
    if "agg" in node:
        window = ctx.resolve(node["window"])
        cur = ctx.current
        rows = [
            r for r in ctx.history
            if _in_window(window, cur["timestamp"], r["timestamp"])
            and all(r.get(m) == cur.get(m) for m in node.get("match", []))
            and all(_match_simple(w, r, ctx) for w in node.get("where", []))
        ]
        if node["agg"] == "count":
            actual: Any = len(rows)
        elif node["agg"] == "sum":
            actual = round(sum(float(r.get(node["field"]) or 0) for r in rows), 2)
        else:
            actual = max((float(r.get(node["field"]) or 0) for r in rows), default=0.0)
        result = _compare(node["op"], actual, expected, band)
        label_window = window if isinstance(window, str) else f"{window['days']}d"
        ctx.evidence.append({
            "kind": "aggregate", "expr": f"{node['agg']}({node.get('field', '*')}) over {label_window}",
            "op": node["op"], "expected": expected, "actual": actual, "matched_txns": [r["id"] for r in rows],
            "result": result,
        })
        return result

    actual = ctx.current.get(node["field"])
    result = _compare(node["op"], actual, expected, band)
    ctx.evidence.append({
        "kind": "field", "expr": node["field"], "op": node["op"], "expected": expected, "actual": actual,
        "result": result,
    })
    return result
