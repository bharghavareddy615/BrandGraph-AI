"""Unit tests for the Deterministic Brand Rule Engine."""

import pytest
from backend.rule_engine import DeterministicRuleEngine
from backend.schemas import FindingCategory, Severity, EvidenceStatus


@pytest.fixture
def engine():
    return DeterministicRuleEngine()


def test_prohibited_terms_detection(engine):
    text = "Our platform is 100% bug-free and completely hack-proof."
    findings = engine.evaluate(text)

    categories = [f.category for f in findings]
    assert FindingCategory.PROHIBITED_TERM in categories

    matched = [f.matched_text.lower() for f in findings]
    assert "100% bug-free" in matched
    assert "hack-proof" in matched

    # Verify severity
    for f in findings:
        if f.matched_text.lower() in ("100% bug-free", "hack-proof"):
            assert f.severity == Severity.CRITICAL
            assert f.suggested_rewrite is not None


def test_unapproved_product_name(engine):
    text = "Try Inkloom Bot for all your enterprise needs."
    findings = engine.evaluate(text)

    alias_findings = [f for f in findings if f.category == FindingCategory.UNAPPROVED_NAME]
    assert len(alias_findings) == 1
    assert alias_findings[0].matched_text == "Inkloom Bot"
    assert alias_findings[0].suggested_rewrite == "Inkloom Copilot"
    assert alias_findings[0].rule_id == "RULE-002"


def test_missing_disclaimer_detection(engine):
    # Benchmark latency cited without disclaimer
    text = "Inkloom Sentinel scans code with under 45ms latency under standard load."
    findings = engine.evaluate(text)

    disc_findings = [f for f in findings if f.category == FindingCategory.MISSING_DISCLAIMER]
    assert len(disc_findings) >= 1
    assert disc_findings[0].rule_id == "RULE-003"
    assert "Performance figures depend on workload" in disc_findings[0].suggested_rewrite


def test_compliant_content_no_violations(engine):
    text = (
        "Inkloom Copilot provides human-in-the-loop governance for enterprise AI workflows. "
        "Performance figures depend on workload characteristics, configuration, and cluster capacity. "
        "Individual outcomes may vary."
    )
    findings = engine.evaluate(text)
    assert len(findings) == 0


def test_contradicted_claims_detection(engine):
    text = "Inkloom Sentinel guarantees zero false alarms across all runs."
    findings = engine.evaluate(text)

    contra_findings = [f for f in findings if f.category == FindingCategory.CONTRADICTED_CLAIM]
    assert len(contra_findings) == 1
    assert contra_findings[0].evidence_source_id == "SRC-004"
    assert contra_findings[0].evidence_status == EvidenceStatus.CONTRADICTED


def test_rule_conflict_and_superseded_detection(engine):
    text = "Switch to Inkloom Assistant for legacy systems."
    findings = engine.evaluate(text)

    super_findings = [f for f in findings if f.rule_id == "RULE-006"]
    assert len(super_findings) == 1
    assert "superseded" in super_findings[0].explanation.lower()


def test_empty_content_handling(engine):
    assert engine.evaluate("") == []
    assert engine.evaluate("   \n\t  ") == []
