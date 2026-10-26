import json

import pytest
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture(scope="module")
def client(seeded):
    with TestClient(app) as c:
        yield c


def test_health_meta_stats(client):
    assert client.get("/api/health").json()["status"] == "ok"
    meta = client.get("/api/meta").json()
    assert meta["llm_provider"] == "mock" and len(meta["rules"]) == 10
    stats = client.get("/api/stats").json()
    assert stats["transactions"] == 600 and stats["flagged"] > 20 and stats["pending_review"] > 0
    assert stats["daily"] and stats["by_rule"]["R-CBWTR"] >= 1


def test_transactions_pagination_and_filters(client):
    page = client.get("/api/transactions", params={"page_size": 25}).json()
    assert page["total"] == 600 and len(page["items"]) == 25
    assert page["items"][0]["account_masked"].startswith("X")
    cash = client.get("/api/transactions", params={"channel": "cash", "flagged": True}).json()
    assert cash["items"] and all(t["channel"] == "cash" and t["rules"] for t in cash["items"])


def test_decision_trace(client):
    queue = client.get("/api/review/queue").json()
    assert queue
    detail = client.get(f"/api/decisions/{queue[0]['id']}").json()
    for key in ("features", "rules_fired", "retrieved", "output", "model_name", "prompt_version", "reviews"):
        assert key in detail


def test_review_flow_and_reports(client):
    queue = client.get("/api/review/queue").json()
    d = next(x for x in queue if "CTR" in [o["type"] for o in x["obligations"]] and not x["requires_four_eyes"])
    r = client.post(f"/api/review/{d['id']}/actions", json={"reviewer": "asha", "action": "reject"})
    assert r.status_code == 422
    r = client.post(f"/api/review/{d['id']}/actions", json={"reviewer": "asha", "action": "approve"})
    assert r.status_code == 200 and r.json()["status"] == "approved"
    reports = {x["type"]: x["approved_count"] for x in client.get("/api/reports").json()}
    assert reports["CTR"] >= 1
    csv = client.get("/api/reports/CTR.csv")
    assert csv.status_code == 200 and "DRAFT" in csv.text and d["transaction_id"] in csv.text
    assert "X" in csv.text.split("\n")[2]  # masked account


def test_batch_run_streams_events(client):
    run = client.post("/api/analysis/runs", json={"pace_ms": 0}).json()
    with client.stream("GET", f"/api/analysis/runs/{run['id']}/events") as r:
        events = [json.loads(line[6:]) for line in r.iter_lines() if line.startswith("data: ")]
    types = [e["type"] for e in events]
    assert types[0] == "started" and types[-1] == "done" and "decision" in types


def test_csv_upload(client):
    csv = ("id,account_id,timestamp,amount_inr,channel,direction,counterparty_country\n"
           "UP1,A0020,2026-10-17T10:00:00,1150000,cash,credit,IN\n"
           "UP2,NOPE,2026-10-17T10:00:00,100,cash,credit,IN\n")
    r = client.post("/api/analysis/upload", files={"file": ("t.csv", csv, "text/csv")}).json()
    assert r["inserted"] == 1 and len(r["errors"]) == 1 and r["run_id"]
    with client.stream("GET", f"/api/analysis/runs/{r['run_id']}/events") as s:  # wait for the background run
        events = [json.loads(line[6:]) for line in s.iter_lines() if line.startswith("data: ")]
    flagged = [e for e in events if e["type"] == "decision"]
    assert flagged and "R-CTR" in flagged[0]["rules"]


def test_search(client):
    hits = client.get("/api/search", params={"q": "T0001"}).json()
    assert any(h["kind"] == "transaction" for h in hits)
