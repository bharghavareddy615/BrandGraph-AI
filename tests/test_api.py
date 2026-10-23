"""Integration tests for the BrandGraph AI FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["graph_nodes"] > 0
    assert data["ai_provider"]["status"] in ("Disabled (Local Mode)", "Ready", "Unconfigured (No API Key)")


def test_brand_rules_endpoint():
    res = client.get("/api/brand/rules")
    assert res.status_code == 200
    data = res.json()
    assert "rules" in data
    assert "products" in data
    assert "prohibited_terms" in data
    assert len(data["rules"]) == 8


def test_brand_graph_endpoint():
    res = client.get("/api/brand/graph")
    assert res.status_code == 200
    data = res.json()
    assert data["node_count"] > 0
    assert data["edge_count"] > 0
    assert len(data["nodes"]) == data["node_count"]


def test_review_endpoint_violations():
    payload = {
        "content": "Inkloom Bot is 100% bug-free with under 45ms latency.",
        "title": "API Test Draft",
        "author": "Automated Tester",
    }
    res = client.post("/api/review", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["current_state"] == "Needs Revision"
    assert len(data["findings"]) >= 3

    categories = [f["category"] for f in data["findings"]]
    assert "prohibited_term" in categories
    assert "unapproved_name" in categories
    assert "missing_disclaimer" in categories


def test_draft_lifecycle_and_workflow():
    # 1. Create Draft
    create_res = client.post("/api/drafts", json={
        "title": "Workflow Lifecycle Test",
        "content": "Get started with Inkloom Copilot today.",
        "author": "Auditor",
    })
    assert create_res.status_code == 200
    draft = create_res.json()
    draft_id = draft["id"]

    # 2. Add Reviewer Comment
    comm_res = client.post(f"/api/drafts/{draft_id}/comments", json={
        "author": "Compliance Lead",
        "comment_text": "Looks ready for final review.",
    })
    assert comm_res.status_code == 200

    # 3. Transition Status to Approved
    status_res = client.patch(f"/api/drafts/{draft_id}/status", json={
        "new_state": "Approved",
        "reviewer": "Brand Director",
        "decision_notes": "Reviewed and cleared.",
    })
    assert status_res.status_code == 200
    assert status_res.json()["new_state"] == "Approved"

    # 4. Fetch Full Details
    detail_res = client.get(f"/api/drafts/{draft_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["current_state"] == "Approved"
    assert len(detail["comments"]) >= 1
    assert len(detail["decisions"]) >= 1


def test_evaluation_run_endpoint():
    res = client.post("/api/evaluation/run")
    assert res.status_code == 200
    summary = res.json()
    assert summary["total_tests"] == 10
    assert summary["passed_tests"] > 0
    assert summary["accuracy_percentage"] >= 80.0
    assert len(summary["results"]) == 10


def test_settings_endpoint():
    res = client.get("/api/settings")
    assert res.status_code == 200
    settings = res.json()
    assert "ai_provider_status" in settings
    assert "privacy_policy" in settings
    assert "synthetic_data_notice" in settings
