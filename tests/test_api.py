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


def test_evidence_search_endpoint():
    # 1. Grounded query
    res = client.get("/api/evidence/search?q=TLS%201.3%20AES-256")
    assert res.status_code == 200
    data = res.json()
    assert data["evidence_status"] == "supported"
    assert len(data["results"]) >= 1
    assert data["results"][0]["source_id"] == "SRC-003"

    # 2. Ungrounded query -> Needs verification
    res_unsub = client.get("/api/evidence/search?q=increases%20developer%20cognitive%20IQ%20by%2047%20points")
    assert res_unsub.status_code == 200
    data_unsub = res_unsub.json()
    assert data_unsub["evidence_status"] == "Needs verification"
    assert len(data_unsub["results"]) == 0


def test_brand_graph_product_filter():
    res = client.get("/api/brand/graph?product_id=PROD-COPILOT")
    assert res.status_code == 200
    data = res.json()
    assert data["node_count"] > 0
    node_ids = [n["id"] for n in data["nodes"]]
    assert "PROD-COPILOT" in node_ids


def test_empty_content_and_search_resilience():
    # Empty review content should return 200 with Needs Revision rather than crashing
    rev_res = client.post("/api/review", json={"content": "", "title": "Empty Draft"})
    assert rev_res.status_code == 200
    assert rev_res.json()["current_state"] == "Needs Revision"

    # Empty search query should return 200 with empty results rather than crashing
    search_res = client.get("/api/evidence/search?q=")
    assert search_res.status_code == 200
    assert len(search_res.json()["results"]) == 0


def test_dismiss_and_rewrite_endpoints():
    # Create draft with violations
    rev_res = client.post("/api/review", json={
        "content": "Inkloom Bot is 100% bug-free.",
        "title": "Rewrite Test",
    })
    assert rev_res.status_code == 200
    draft = rev_res.json()
    draft_id = draft["id"]
    findings = draft["findings"]
    assert len(findings) > 0

    # Dismiss first finding
    dis_res = client.post(f"/api/drafts/{draft_id}/dismiss", json={
        "finding_id": findings[0]["id"],
        "reason": "Auditor waiver",
    })
    assert dis_res.status_code == 200

    # Case-insensitive status transition
    stat_res = client.patch(f"/api/drafts/{draft_id}/status", json={
        "new_state": "approved",
        "reviewer": "QA Lead",
    })
    assert stat_res.status_code == 200
    assert stat_res.json()["new_state"] == "Approved"


def test_dashboard_active_violations_filter_approved_drafts():
    """Regression test ensuring approved drafts do not count towards active policy violations."""
    dash_before = client.get("/api/dashboard").json()["metrics"]
    initial_total_issues = sum(dash_before.get("category_counts", {}).values())

    # Create new draft with known violations
    rev_res = client.post("/api/review", json={
        "content": "Inkloom Bot is guaranteed 100% bug-free.",
        "title": "Active Violation Regression Test",
        "author": "QA Tester",
    })
    assert rev_res.status_code == 200
    draft = rev_res.json()
    draft_id = draft["id"]
    assert draft["current_state"] == "Needs Revision"
    new_violations_count = len(draft["findings"])
    assert new_violations_count > 0

    dash_mid = client.get("/api/dashboard").json()["metrics"]
    mid_total_issues = sum(dash_mid.get("category_counts", {}).values())
    assert mid_total_issues == initial_total_issues + new_violations_count

    # Approve draft
    approve_res = client.patch(f"/api/drafts/{draft_id}/status", json={
        "new_state": "Approved",
        "reviewer": "Compliance Auditor",
    })
    assert approve_res.status_code == 200

    dash_after = client.get("/api/dashboard").json()["metrics"]
    after_total_issues = sum(dash_after.get("category_counts", {}).values())
    # The active issues should now exclude the approved draft
    assert after_total_issues == initial_total_issues



