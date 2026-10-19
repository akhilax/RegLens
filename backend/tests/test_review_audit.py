from datetime import date

import pytest
from sqlalchemy import select, text

from reglens.audit.chain import simulate_tamper, verify_chain
from reglens.core.models import AuditEntry, Decision
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


def test_audit_chain_valid_and_tamper_detected(session):
    report = verify_chain(session)
    assert report.valid and report.checked > 100
    target = session.scalars(select(AuditEntry).order_by(AuditEntry.id).offset(10).limit(1)).first()

    sim = simulate_tamper(session, target.id)
    assert not sim.valid and sim.broken_at == target.id
    assert verify_chain(session).valid  # simulation never touches the stored log

    session.execute(text("UPDATE audit_log SET payload = :p WHERE id = :i"), {"p": '{"forged":true}', "i": target.id})
    broken = verify_chain(session)
    assert not broken.valid and broken.broken_at == target.id
    assert all(not b.valid for b in broken.blocks if b.id >= target.id)
    session.rollback()


def test_review_actions_are_audited(session):
    approved = session.scalars(select(Decision).where(Decision.status == "approved")).first()
    events = session.scalars(select(AuditEntry.event_type).where(AuditEntry.entity_id == str(approved.id))).all()
    assert "REVIEW_APPROVE" in events
