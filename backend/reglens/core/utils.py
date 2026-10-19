"""Shared helpers: hashing, masking, INR formatting, working-day maths."""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timedelta
from typing import Any


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def canonical_json(data: Any) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def mask_account(number: str) -> str:
    """Keep the last 4 digits only: 123456789012 -> XXXXXXXX9012."""
    digits = str(number)
    if len(digits) <= 4:
        return "X" * len(digits)
    return "X" * (len(digits) - 4) + digits[-4:]


def format_inr(amount: float) -> str:
    """Indian digit grouping: 1234567.5 -> ₹12,34,567.50."""
    negative = amount < 0
    whole, frac = f"{abs(amount):.2f}".split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups) + "," + tail
    sign = "-" if negative else ""
    return f"{sign}₹{whole}" + ("" if frac == "00" else f".{frac}")


def add_working_days(start: date, days: int) -> date:
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current


def fifteenth_of_next_month(d: date) -> date:
    year, month = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    return date(year, month, 15)


def financial_year_start(d: date | datetime) -> date:
    """Indian FY runs 1 April – 31 March."""
    year = d.year if d.month >= 4 else d.year - 1
    return date(year, 4, 1)


def to_date(value: date | datetime | str) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return datetime.fromisoformat(str(value)).date()
