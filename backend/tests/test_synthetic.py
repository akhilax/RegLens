from collections import Counter

from reglens.core.synthetic import generate


def test_generator_is_reproducible():
    a, b = generate(), generate()
    assert [t.id for t in a.transactions] == [t.id for t in b.transactions]
    assert [t.amount_inr for t in a.transactions] == [t.amount_inr for t in b.transactions]


def test_dataset_shape_and_planted_scenarios():
    ds = generate()
    assert len(ds.customers) == 50
    assert 60 <= len(ds.accounts) <= 75
    assert len(ds.transactions) == 600
    scenarios = Counter(t.scenario for t in ds.truth)
    for s in ["large_cash", "monthly_cash_aggregate", "structuring_pan_threshold", "structuring_ctr_threshold",
              "cross_border_wire", "high_risk_jurisdiction", "pep", "npo_large_receipt", "cash_without_pan",
              "cash_receipt_limit", "lrs_cumulative_breach", "kyc_overdue"]:
        assert scenarios[s] > 0, s
    ids = {t.id for t in ds.transactions}
    assert all(t.transaction_id in ids for t in ds.truth)
