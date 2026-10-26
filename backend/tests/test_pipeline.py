from sqlalchemy import select

from reglens.config import get_settings
from reglens.core.models import Decision
from reglens.core.synthetic import read_ground_truth
from reglens.kb.retriever import get_retriever
from reglens.llm.providers import MockLLMProvider
from reglens.llm.schema import parse_analysis
from reglens.pipeline.analyze import analyze_one
from reglens.pipeline.guardrails import apply_guardrails


def _current(session):
    return {d.transaction_id: d for d in session.scalars(select(Decision).where(Decision.is_current)).all()}


def test_every_planted_scenario_detected(session):
    truth = read_ground_truth(get_settings().synthetic_dir / "ground_truth.csv")
    decisions = _current(session)
    for tid, row in truth.items():
        expected = {r for r in row.expected_rules.split(";") if r}
        assert {h["rule_id"] for h in decisions[tid].rules_fired} == expected, (tid, row.scenario)


def test_normal_traffic_is_clean(session):
    truth = read_ground_truth(get_settings().synthetic_dir / "ground_truth.csv")
    noisy = [d for tid, d in _current(session).items() if tid not in truth and d.rules_fired]
    assert noisy == []


def test_trace_is_complete(session):
    d = next(d for d in _current(session).values() if any(h["rule_id"] == "R-CTR" for h in d.rules_fired))
    assert d.features["channel"] == "cash"
    assert d.rules_fired and d.rules_fired[0]["source_refs"]
    assert all({"chunk_id", "version", "section", "content_hash"} <= set(c) for c in d.retrieved)
    assert d.model_name.startswith("mock:") and d.prompt_version.startswith("analyze@")
    assert d.output["obligations"] and d.status == "pending_review"
    assert "customer.id" not in d.features  # PII stays out of the LLM payload


def test_hallucinated_citations_are_stripped_and_routed(session):
    flagged = [d for d in _current(session).values() if d.invalid_citations]
    assert flagged, "mock provider should hallucinate on structuring cases"
    retrieved_ok = True
    for d in flagged:
        retrieved = {c["chunk_id"] for c in d.retrieved}
        for reg in d.output["applicable_regulations"]:
            retrieved_ok &= set(reg["citation_chunk_ids"]) <= retrieved
        assert d.citation_issue and "citation_issue" in d.routing_reasons and d.requires_review
    assert retrieved_ok


def test_guardrail_unit():
    raw = '{"applicable_regulations":[{"reg_id":"A","section":"s","reason":"r","citation_chunk_ids":["A@v1#s","A@v1#fake"]},' \
          '{"reg_id":"B","section":"s","reason":"r","citation_chunk_ids":["B@v9#nope"]}],' \
          '"obligations":[{"type":"CTR","deadline":"2099-01-01","description":"x","source_rule_id":"R-CTR"},' \
          '{"type":"STR","deadline":null,"description":"x","source_rule_id":"R-MADE-UP"}],' \
          '"risk_level":"low","confidence":0.9,"summary":"s"}'
    analysis = parse_analysis(raw)
    retrieved = [{"chunk_id": "A@v1#s", "reg_id": "A"}]
    rules = [{"rule_id": "R-CTR", "obligation": {"type": "CTR", "reporting": True, "description": "File CTR"},
              "deadline": "2026-10-15", "deadline_basis": "15th"}]
    g = apply_guardrails(analysis, retrieved, rules)
    assert [r["reg_id"] for r in g.output["applicable_regulations"]] == ["A"]
    assert g.output["applicable_regulations"][0]["citation_chunk_ids"] == ["A@v1#s"]
    assert {c["chunk_id"] for c in g.invalid_citations} == {"A@v1#fake", "B@v9#nope"}
    assert g.output["obligations"] == [{"type": "CTR", "reporting": True, "deadline": "2026-10-15",
                                        "deadline_basis": "15th", "description": "File CTR",
                                        "source_rule_id": "R-CTR"}]  # deadline from rules, made-up rule dropped
    assert g.citation_issue


class AlwaysBroken(MockLLMProvider):
    name, model = "broken", "broken-1"

    def complete(self, req):
        return "I think this is fine, no JSON for you"


def test_invalid_json_falls_back_to_rules_and_routes(session):
    tid = next(d.transaction_id for d in _current(session).values() if d.rules_fired)
    d = analyze_one(session, tid, provider=AlwaysBroken(), retriever=get_retriever(session))
    assert d.fallback_used and "llm_fallback" in d.routing_reasons and d.requires_review
    assert d.obligations and d.confidence == 0.3
    assert len(d.output["llm_errors"]) == 2  # retried once
    session.rollback()


def test_mock_retry_recovers(session):
    retried = [d for d in _current(session).values() if d.output.get("llm_errors")]
    assert retried, "some transactions should exercise the retry path"
    assert all(not d.fallback_used for d in retried)
