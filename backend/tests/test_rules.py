"""Positive and negative tests for every seed rule, plus DSL safety."""

from datetime import date, datetime, timedelta
from types import SimpleNamespace

import pytest

from reglens.rules.dsl import RuleDSLError, validate
from reglens.rules.engine import evaluate_rules, flatten, get_ruleset, load_ruleset

RS = get_ruleset()


def cust(**kw):
    base = dict(id="C1", type="individual", risk="low", is_pep=False, has_pan=True, country="IN",
                kyc_last_updated=date(2026, 1, 1))
    return SimpleNamespace(**{**base, **kw})


ACC = SimpleNamespace(id="A1", type="savings")
_seq = iter(range(1, 10_000))


def txn(amount, channel="cash", direction="credit", when="2026-09-10T11:00", country="IN", cp=None, purpose=None):
    return SimpleNamespace(id=f"T{next(_seq)}", account_id="A1", timestamp=datetime.fromisoformat(when),
                           amount_inr=amount, currency="INR", channel=channel, direction=direction,
                           counterparty_id=cp, counterparty_country=country, purpose_code=purpose)


def fired(txns, customer=None):
    """Evaluate the LAST transaction against the full chronological history."""
    customer = customer or cust()
    flats = [flatten(t, customer, ACC, RS.params) for t in txns]
    return {h.rule_id for h in evaluate_rules(flats[-1], flats, RS)}


def test_ruleset_loads_and_links_sources():
    assert {r.id for r in RS.rules} == {"R-CTR", "R-STRUCT", "R-CBWTR", "R-NPO", "R-CASH-RECEIPT", "R-PAN", "R-LRS",
                                         "R-HRJ", "R-PEP", "R-KYC-DUE"}
    assert all(r.source_refs for r in RS.rules)
    assert "KP" in RS.lists["high_risk_jurisdictions"]


# R-CTR
def test_ctr_single_large_cash():
    assert "R-CTR" in fired([txn(10_50_000)])


def test_ctr_monthly_aggregate():
    days = ["2026-08-01", "2026-08-08", "2026-08-15", "2026-08-22"]
    assert "R-CTR" in fired([txn(2_60_000, when=f"{d}T10:00") for d in days])


def test_ctr_negative_below_threshold_and_cross_month():
    assert "R-CTR" not in fired([txn(10_00_000)])  # must be MORE than ₹10 lakh
    assert "R-CTR" not in fired([txn(6_00_000, when="2026-08-30T10:00"), txn(6_00_000, when="2026-09-02T10:00")])
    assert "R-CTR" not in fired([txn(12_00_000, channel="NEFT")])


# R-STRUCT
def test_structuring_positive():
    seq = [txn(48_000, when=f"2026-09-0{d}T10:00") for d in (1, 3, 5)]
    assert "R-STRUCT" in fired(seq)


def test_structuring_negative_spread_or_outside_band():
    spread = [txn(48_000, when=f"2026-09-{d:02d}T10:00") for d in (1, 9, 18)]
    assert "R-STRUCT" not in fired(spread)
    small = [txn(30_000, when=f"2026-09-0{d}T10:00") for d in (1, 2, 3)]
    assert "R-STRUCT" not in fired(small)
    two = [txn(49_000, when=f"2026-09-0{d}T10:00") for d in (1, 2)]
    assert "R-STRUCT" not in fired(two)


# R-CBWTR
def test_cbwtr():
    assert "R-CBWTR" in fired([txn(5_00_001, channel="SWIFT", country="US")])
    assert "R-CBWTR" not in fired([txn(5_00_000, channel="SWIFT", country="US")])
    assert "R-CBWTR" not in fired([txn(9_00_000, channel="RTGS")])


# R-NPO
def test_npo():
    npo = cust(type="npo")
    assert "R-NPO" in fired([txn(10_00_001, channel="NEFT")], npo)
    assert "R-NPO" not in fired([txn(9_99_999, channel="NEFT")], npo)
    assert "R-NPO" not in fired([txn(20_00_000, channel="NEFT", direction="debit")], npo)
    assert "R-NPO" not in fired([txn(20_00_000, channel="NEFT")])


# R-CASH-RECEIPT
def test_cash_receipt_same_person_same_day():
    co = cust(type="company")
    seq = [txn(1_20_000, cp="P1", when="2026-09-16T10:00"), txn(90_000, cp="P1", when="2026-09-16T15:00")]
    assert "R-CASH-RECEIPT" in fired(seq, co)


def test_cash_receipt_negative():
    co = cust(type="company")
    different_people = [txn(1_20_000, cp="P1", when="2026-09-16T10:00"), txn(90_000, cp="P2", when="2026-09-16T15:00")]
    assert "R-CASH-RECEIPT" not in fired(different_people, co)
    different_days = [txn(1_20_000, cp="P1", when="2026-09-15T10:00"), txn(90_000, cp="P1", when="2026-09-16T15:00")]
    assert "R-CASH-RECEIPT" not in fired(different_days, co)
    assert "R-CASH-RECEIPT" not in fired([txn(2_50_000, cp="P1")])  # individual account


# R-PAN
def test_pan():
    assert "R-PAN" in fired([txn(60_000)], cust(has_pan=False))
    assert "R-PAN" not in fired([txn(60_000)], cust(has_pan=True))
    assert "R-PAN" not in fired([txn(50_000)], cust(has_pan=False))


# R-LRS
def test_lrs_cumulative_breach():
    rate = RS.params["usd_inr_rate"]
    seq = [txn(usd * rate, channel="SWIFT", direction="debit", country="US", when=w)
           for usd, w in [(1_20_000, "2026-05-01T10:00"), (1_40_000, "2026-09-01T10:00")]]
    assert "R-LRS" in fired(seq)


def test_lrs_negative_new_financial_year():
    rate = RS.params["usd_inr_rate"]
    seq = [txn(usd * rate, channel="SWIFT", direction="debit", country="US", when=w)
           for usd, w in [(1_50_000, "2026-03-20T10:00"), (1_50_000, "2026-04-05T10:00")]]
    assert "R-LRS" not in fired(seq)


# R-HRJ
def test_hrj():
    assert "R-HRJ" in fired([txn(10_000, channel="SWIFT", country="IR")])
    assert "R-HRJ" not in fired([txn(10_000, channel="SWIFT", country="SG")])


# R-PEP
def test_pep():
    assert "R-PEP" in fired([txn(1_00_000, channel="NEFT")], cust(is_pep=True))
    assert "R-PEP" not in fired([txn(99_999, channel="NEFT")], cust(is_pep=True))
    assert "R-PEP" not in fired([txn(5_00_000, channel="NEFT")])


# R-KYC-DUE
def test_kyc_due_by_risk_category():
    when = "2026-09-10T10:00"
    assert "R-KYC-DUE" in fired([txn(1_000, channel="UPI", when=when)], cust(risk="high", kyc_last_updated=date(2024, 9, 1)))
    assert "R-KYC-DUE" not in fired([txn(1_000, channel="UPI", when=when)], cust(risk="low", kyc_last_updated=date(2024, 9, 1)))
    old = date(2026, 9, 10) - timedelta(days=365 * 9)
    assert "R-KYC-DUE" in fired([txn(1_000, channel="UPI", when=when)], cust(risk="medium", kyc_last_updated=old))


def test_rule_hit_carries_deadline_and_evidence():
    flats = [flatten(txn(12_00_000, when="2026-09-03T10:00"), cust(), ACC, RS.params)]
    hit = next(h for h in evaluate_rules(flats[-1], flats, RS) if h.rule_id == "R-CTR")
    assert hit.deadline == "2026-10-15"
    assert any(e["kind"] == "aggregate" for e in hit.evidence)


@pytest.mark.parametrize("node", [
    {"field": "amount_inr", "op": "__import__", "value": 1},
    {"field": "__class__.__mro__", "op": "eq", "value": 1},
    {"field": "amount_inr; drop table", "op": "eq", "value": 1},
    {"agg": "eval", "field": "amount_inr", "window": "day", "op": "gt", "value": 1},
    {"all": []},
])
def test_dsl_rejects_unsafe_or_malformed(node):
    with pytest.raises(RuleDSLError):
        validate(node)


def test_unknown_param_reference_fails(tmp_path):
    bad = (tmp_path / "rules.yaml")
    bad.write_text("""version: 1
params: {}
lists: {}
rules:
  - id: R-X
    name: x
    description: x
    severity: low
    obligation: {type: X, reporting: false, description: x}
    deadline_rule: immediate
    source_refs: ["A#b"]
    condition: {field: amount_inr, op: gt, value: $params.missing}
""", encoding="utf-8")
    rs = load_ruleset(bad)
    flats = [flatten(txn(1), cust(), ACC, {})]
    with pytest.raises(RuleDSLError):
        evaluate_rules(flats[0], flats, rs)
