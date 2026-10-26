from datetime import date

import pytest

from reglens.review.service import ReviewError, act, queue


def _first(session, **kw):
    for d in queue(session):
        if all(getattr(d, k) == v for k, v in kw.items()):
            return d
    raise AssertionError(f"no queued decision with {kw}")


def test_queue_sorted_by_risk(session):
    q = queue(session)
    order = {"high": 0, "medium": 1, "low": 2}
    assert [order[d.risk_level] for d in q] == sorted(order[d.risk_level] for d in q)


def test_reject_and_modify_require_comment(session):
    d = _first(session, requires_four_eyes=False)
    with pytest.raises(ReviewError) as e:
        act(session, d.id, "asha", "reject")
    assert e.value.status_code == 422
    with pytest.raises(ReviewError):
        act(session, d.id, "asha", "modify", comment="  ")


def test_simple_approval(session):
    d = _first(session, requires_four_eyes=False)
    d = act(session, d.id, "asha", "start_review")
    assert d.status == "in_review"
    d = act(session, d.id, "asha", "approve")
    assert d.status == "approved"
    with pytest.raises(ReviewError) as e:
        act(session, d.id, "ravi", "approve")
    assert e.value.status_code == 409
    session.commit()


def test_four_eyes_for_str(session):
    d = _first(session, requires_four_eyes=True)
    d = act(session, d.id, "asha", "approve", today=date(2026, 10, 19))
    assert d.status == "awaiting_second_approval"
    with pytest.raises(ReviewError) as e:
        act(session, d.id, "asha", "approve")
    assert "different reviewer" in e.value.message
    d = act(session, d.id, "ravi", "approve", today=date(2026, 10, 19))
    assert d.status == "approved"
    str_ob = next(o for o in d.obligations if o["type"] == "STR")
    assert str_ob["deadline"] == "2026-10-28" and str_ob["determined_on"] == "2026-10-19"  # 7 working days
    session.commit()
