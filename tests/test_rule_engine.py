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


def test_prohibited_terms_variations(engine):
    """Test that spelling, hyphen, and plural variations in prohibited terms are caught."""
    text = (
        "Our engine is 100% bug free, completely hackproof, offers a guaranteed return on investment, "
        "and produces revolutionary miracles."
    )
    findings = engine.evaluate(text)
    proh = [f for f in findings if f.category == FindingCategory.PROHIBITED_TERM]
    matched = [f.matched_text.lower() for f in proh]

    assert any("100% bug free" in m for m in matched)
    assert any("hackproof" in m for m in matched)
    assert any("guaranteed return" in m for m in matched)
    assert any("revolutionary miracles" in m for m in matched)


def test_unapproved_product_name_variations(engine):
    """Test that hyphenated and unspaced product aliases are reliably detected."""
    text = "Deploy Inkloom-Bot or Sentinel-Shield or SentinelShield for monitoring."
    findings = engine.evaluate(text)
    alias_findings = [f for f in findings if f.category == FindingCategory.UNAPPROVED_NAME]
    matched = [f.matched_text for f in alias_findings]

    assert "Inkloom-Bot" in matched
    assert "Sentinel-Shield" in matched or "SentinelShield" in matched


def test_approved_product_names_no_false_positives(engine):
    """Test that approved product names never trigger false unapproved alias violations."""
    text = (
        "Inkloom Copilot and Inkloom Sentinel provide enterprise brand governance. "
        "Copilot and Sentinel integrate directly into CI/CD pipelines."
    )
    findings = engine.evaluate(text)
    alias_findings = [f for f in findings if f.category == FindingCategory.UNAPPROVED_NAME]
    assert len(alias_findings) == 0


def test_disclaimer_false_positive_prevention(engine):
    """Test that general adjectives ('faster', 'speed') and present disclaimers do not trigger false alarms."""
    # 1. Conversational speed references without benchmark citations
    text1 = "Our brand platform enables faster team collaboration and improved review speed."
    findings1 = engine.evaluate(text1)
    disc1 = [f for f in findings1 if f.category == FindingCategory.MISSING_DISCLAIMER]
    assert len(disc1) == 0

    # 2. Benchmark cited WITH disclaimer present (even in brackets or varied punctuation)
    text2 = (
        "Inkloom Sentinel scans with under 45ms latency. "
        "[Performance figures depend on workload characteristics. Individual outcomes may vary.]"
    )
    findings2 = engine.evaluate(text2)
    disc2 = [f for f in findings2 if f.category == FindingCategory.MISSING_DISCLAIMER]
    assert len(disc2) == 0


def test_contradicted_claims_variations(engine):
    """Test that varied wording for contradicted claims is reliably captured."""
    text = (
        "Inkloom Sentinel can eliminate 100% of false positives with sub-5ms latency "
        "and a 100% uptime guarantee."
    )
    findings = engine.evaluate(text)
    contra = [f for f in findings if f.category == FindingCategory.CONTRADICTED_CLAIM]
    assert len(contra) >= 2

    contra_rules = [f.rule_id for f in contra]
    assert "RULE-001" in contra_rules  # Accuracy or Uptime
    assert "RULE-003" in contra_rules  # Latency benchmark contradiction


def test_unsupported_claim_detection(engine):
    """Test that factual assertions lacking evidence in approved sources are flagged as unsupported."""
    text = "Inkloom Sentinel increases developer cognitive IQ by 47 points within two weeks of deployment."
    findings = engine.evaluate(text)
    unsup = [f for f in findings if f.category == FindingCategory.UNSUPPORTED_CLAIM]
    assert len(unsup) == 1
    assert unsup[0].evidence_status == EvidenceStatus.NEEDS_VERIFICATION
    assert "47 points" in unsup[0].matched_text

