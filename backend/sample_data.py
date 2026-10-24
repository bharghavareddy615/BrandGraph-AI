"""Approved synthetic brand knowledge base for Inkloom AI.

All entities, sources, claims, and rules are explicitly synthetic and curated
for the Inkloom AI Brand Governance Platform Challenge.
"""

from typing import Dict, List
from backend.schemas import (
    Brand,
    Product,
    PreferredTerm,
    ProhibitedTerm,
    Disclaimer,
    EvidenceSource,
    Claim,
    Rule,
    FindingCategory,
    Severity,
    RuleStatus,
    EvidenceStatus,
)


def get_sample_brand() -> Brand:
    return Brand(
        id="BRAND-INKLOOM",
        name="Inkloom AI",
        industry="Enterprise AI Brand Governance & Cloud Platforms",
        description="Fictional enterprise platform providing evidence-linked AI governance and verification.",
        voice_and_tone="Professional, transparent, measured, and evidence-grounded. Avoid hyperbolic superlatives and unsubstantiated absolute claims.",
    )


def get_sample_products() -> List[Product]:
    return [
        Product(
            id="PROD-COPILOT",
            brand_id="BRAND-INKLOOM",
            name="Inkloom Copilot",
            category="Generative Brand Assistant",
            description="Enterprise drafting assistant with real-time brand guidance.",
            approved_aliases=["Inkloom Copilot", "Copilot"],
            unapproved_aliases=["Inkloom Bot", "Inkloom Assistant", "InkloomGPT", "InkloomBot"],
        ),
        Product(
            id="PROD-SENTINEL",
            brand_id="BRAND-INKLOOM",
            name="Inkloom Sentinel",
            category="Continuous Compliance Scanner",
            description="Automated brand policy, trademark, and factual claim verification engine.",
            approved_aliases=["Inkloom Sentinel", "Sentinel"],
            unapproved_aliases=["Sentinel Shield", "Inkloom Protector", "SentinelBot"],
        ),
        Product(
            id="PROD-CORE",
            brand_id="BRAND-INKLOOM",
            name="Inkloom Knowledge Core",
            category="Graph & RAG Knowledge Store",
            description="Underlying graph-rag repository linking brand rules to verified evidence.",
            approved_aliases=["Inkloom Knowledge Core", "Knowledge Core"],
            unapproved_aliases=["Inkloom DB", "Core Graph"],
        ),
    ]


def get_sample_preferred_terms() -> List[PreferredTerm]:
    return [
        PreferredTerm(
            id="TERM-PREF-01",
            brand_id="BRAND-INKLOOM",
            term="autonomous workflow guidance",
            preferred_for="magic AI",
            context="Describe systems as guided rather than mythical or magic.",
        ),
        PreferredTerm(
            id="TERM-PREF-02",
            brand_id="BRAND-INKLOOM",
            term="explainable AI reasoning",
            preferred_for="black box intelligence",
            context="Emphasize transparent and traceable reasoning.",
        ),
        PreferredTerm(
            id="TERM-PREF-03",
            brand_id="BRAND-INKLOOM",
            term="human-in-the-loop governance",
            preferred_for="fully autonomous replacement",
            context="Ensure marketing reinforces human decision-making and oversight.",
        ),
    ]


def get_sample_prohibited_terms() -> List[ProhibitedTerm]:
    return [
        ProhibitedTerm(
            id="TERM-PROH-01",
            brand_id="BRAND-INKLOOM",
            term="100% bug-free",
            reason="Absolute zero-defect claims violate software disclosure policy and induce false security.",
            recommended_alternative="rigorously tested with 99.9% uptime architecture",
            severity=Severity.CRITICAL,
        ),
        ProhibitedTerm(
            id="TERM-PROH-02",
            brand_id="BRAND-INKLOOM",
            term="hack-proof",
            reason="Security claims must never promise absolute invulnerability.",
            recommended_alternative="enterprise-grade security with continuous monitoring",
            severity=Severity.CRITICAL,
        ),
        ProhibitedTerm(
            id="TERM-PROH-03",
            brand_id="BRAND-INKLOOM",
            term="guaranteed returns",
            reason="Guaranteed ROI or financial outcome claims violate regulatory marketing standards.",
            recommended_alternative="projected efficiency gains based on benchmark pilots",
            severity=Severity.HIGH,
        ),
        ProhibitedTerm(
            id="TERM-PROH-04",
            brand_id="BRAND-INKLOOM",
            term="revolutionary miracle",
            reason="Unsubstantiated hyperbole conflicts with Inkloom's measured, professional voice.",
            recommended_alternative="innovative governance architecture",
            severity=Severity.MEDIUM,
        ),
    ]


def get_sample_disclaimers() -> List[Disclaimer]:
    return [
        Disclaimer(
            id="DISC-001",
            brand_id="BRAND-INKLOOM",
            name="Performance & Benchmark Disclaimer",
            required_text="Performance figures depend on workload characteristics, configuration, and cluster capacity. Individual outcomes may vary.",
            trigger_keywords=["latency", "throughput", "benchmark", "benchmarks", "45ms"],
            trigger_rule_id="RULE-003",
        ),
        Disclaimer(
            id="DISC-002",
            brand_id="BRAND-INKLOOM",
            name="Advisory & Compliance Disclaimer",
            required_text="Inkloom AI does not provide legal, clinical, or financial advice. All recommendations require verification by authorized personnel.",
            trigger_keywords=["audit guarantee", "regulatory proof", "guaranteed compliance", "legal advice", "financial advice"],
            trigger_rule_id="RULE-004",
        ),
    ]


def get_sample_evidence_sources() -> List[EvidenceSource]:
    return [
        EvidenceSource(
            id="SRC-001",
            title="Inkloom Q4 Benchmark Report (2025)",
            source_type="Benchmark Study",
            publication_date="2025-11-20",
            excerpt="Inkloom Sentinel scans enterprise repositories with an observed latency of under 45ms per 1,000 code lines under standard load. It achieved 99.4% detection on the OWASP Top 10 synthetic test suite.",
            provenance="Engineering Performance Lab — Internal Synthetic Benchmark",
            is_synthetic=True,
            metadata={"sample_size": 50000, "environment": "AWS us-east-1 c6i.4xlarge"},
        ),
        EvidenceSource(
            id="SRC-002",
            title="Inkloom Architecture Whitepaper v3.2",
            source_type="Technical Whitepaper",
            publication_date="2025-08-14",
            excerpt="Inkloom Copilot integrates with enterprise LLMs via role-based access control and maintains customer data boundary isolation. It does not store plaintext prompts in public training clusters.",
            provenance="Architecture Review Board — Approved Technical Specification",
            is_synthetic=True,
            metadata={"version": "3.2", "clearance": "Public"},
        ),
        EvidenceSource(
            id="SRC-003",
            title="SOC2 Type II & ISO 27001 Audit Summary (2025)",
            source_type="Compliance Audit Summary",
            publication_date="2025-10-01",
            excerpt="All network traffic in Inkloom Cloud uses TLS 1.3 in transit and AES-256 at rest. Zero unplanned outages were recorded across the multi-tenant cluster over 180 continuous operating days.",
            provenance="Synthetic Compliance Certification Summary",
            is_synthetic=True,
            metadata={"auditor": "SynthoAudit Global", "standard": "SOC2-Type-II"},
        ),
        EvidenceSource(
            id="SRC-004",
            title="Third-Party Comparative Analysis by TechVerify",
            source_type="Third-Party Evaluation",
            publication_date="2025-12-05",
            excerpt="Inkloom Sentinel reduced false positives by 42% compared to standard regex-only scanners in enterprise trial deployments.",
            provenance="Independent Evaluator Trial Report (Synthetic)",
            is_synthetic=True,
            metadata={"trial_participants": 12, "duration_weeks": 6},
        ),
    ]


def get_sample_claims() -> List[Claim]:
    return [
        Claim(
            id="CLM-001",
            brand_id="BRAND-INKLOOM",
            statement="Inkloom Sentinel scans enterprise repositories with under 45ms latency per 1,000 lines under standard load.",
            claim_type="performance",
            evidence_source_id="SRC-001",
            status=EvidenceStatus.SUPPORTED,
            allowed_wording="under 45ms latency per 1,000 lines under standard load",
            forbidden_wording="instantaneous zero-millisecond processing",
        ),
        Claim(
            id="CLM-002",
            brand_id="BRAND-INKLOOM",
            statement="Inkloom Cloud encrypts data using TLS 1.3 in transit and AES-256 at rest.",
            claim_type="security",
            evidence_source_id="SRC-003",
            status=EvidenceStatus.SUPPORTED,
            allowed_wording="TLS 1.3 in transit and AES-256 at rest",
            forbidden_wording="unhackable quantum impenetrable shield",
        ),
        Claim(
            id="CLM-003",
            brand_id="BRAND-INKLOOM",
            statement="Inkloom Sentinel reduced false positives by 42% in enterprise trials.",
            claim_type="accuracy",
            evidence_source_id="SRC-004",
            status=EvidenceStatus.SUPPORTED,
            allowed_wording="reduced false positives by up to 42% in enterprise trials",
            forbidden_wording="eliminates 100% of all false alarms",
        ),
    ]


def get_sample_rules() -> List[Rule]:
    return [
        Rule(
            id="RULE-001",
            brand_id="BRAND-INKLOOM",
            title="Prohibit Absolute Security and Zero-Defect Claims",
            description="Content must not claim software is '100% bug-free', 'hack-proof', or impervious to failures.",
            category=FindingCategory.PROHIBITED_TERM,
            severity=Severity.CRITICAL,
            status=RuleStatus.ACTIVE,
            effective_date="2025-01-01",
        ),
        Rule(
            id="RULE-002",
            brand_id="BRAND-INKLOOM",
            title="Enforce Approved Product Naming Conventions",
            description="Use 'Inkloom Copilot' or 'Inkloom Sentinel'. Never use deprecated or colloquial aliases like 'Inkloom Bot' or 'InkloomGPT'.",
            category=FindingCategory.UNAPPROVED_NAME,
            severity=Severity.HIGH,
            status=RuleStatus.ACTIVE,
            applies_to_product_id="PROD-COPILOT",
            effective_date="2025-01-01",
        ),
        Rule(
            id="RULE-003",
            brand_id="BRAND-INKLOOM",
            title="Mandatory Performance Disclaimer Requirement",
            description="Any benchmark, latency (e.g. 45ms), or throughput citation must append DISC-001.",
            category=FindingCategory.MISSING_DISCLAIMER,
            severity=Severity.HIGH,
            status=RuleStatus.ACTIVE,
            disclaimer_id="DISC-001",
            effective_date="2025-01-01",
        ),
        Rule(
            id="RULE-004",
            brand_id="BRAND-INKLOOM",
            title="Mandatory Advisory & Compliance Disclaimer Requirement",
            description="Any reference to regulatory proof or compliance audit guarantees must append DISC-002.",
            category=FindingCategory.MISSING_DISCLAIMER,
            severity=Severity.MEDIUM,
            status=RuleStatus.ACTIVE,
            disclaimer_id="DISC-002",
            effective_date="2025-01-01",
        ),
        Rule(
            id="RULE-005",
            brand_id="BRAND-INKLOOM",
            title="Brand Tone Standard: Prohibit Unsubstantiated Hyperbole",
            description="Avoid phrases like 'revolutionary miracle' or 'magic AI'. Maintain a professional and evidence-based tone.",
            category=FindingCategory.TONE_VOICE,
            severity=Severity.MEDIUM,
            status=RuleStatus.ACTIVE,
            effective_date="2025-01-01",
        ),
        Rule(
            id="RULE-006",
            brand_id="BRAND-INKLOOM",
            title="Superseded Guideline: 2023 Informal Assistant Naming",
            description="Legacy guideline permitting the colloquial name 'Inkloom Assistant'. Superseded by RULE-002.",
            category=FindingCategory.UNAPPROVED_NAME,
            severity=Severity.LOW,
            status=RuleStatus.SUPERSEDED,
            superseded_by="RULE-002",
            effective_date="2023-06-01",
        ),
        Rule(
            id="RULE-007",
            brand_id="BRAND-INKLOOM",
            title="Conflicting Guideline Alpha: Commercial Brand Reference",
            description="Internal memo requiring marketing to refer to the product suite as 'Inkloom Suite'.",
            category=FindingCategory.RULE_CONFLICT,
            severity=Severity.MEDIUM,
            status=RuleStatus.CONFLICTING,
            conflicts_with="RULE-008",
            effective_date="2025-02-01",
        ),
        Rule(
            id="RULE-008",
            brand_id="BRAND-INKLOOM",
            title="Conflicting Guideline Beta: Technical Brand Reference",
            description="Handbook guideline instructing developers to refer to the ecosystem as 'Inkloom AI Cloud'.",
            category=FindingCategory.RULE_CONFLICT,
            severity=Severity.MEDIUM,
            status=RuleStatus.CONFLICTING,
            conflicts_with="RULE-007",
            effective_date="2025-02-15",
        ),
    ]


def get_all_sample_data() -> Dict[str, list]:
    return {
        "brand": [get_sample_brand()],
        "products": get_sample_products(),
        "preferred_terms": get_sample_preferred_terms(),
        "prohibited_terms": get_sample_prohibited_terms(),
        "disclaimers": get_sample_disclaimers(),
        "evidence_sources": get_sample_evidence_sources(),
        "claims": get_sample_claims(),
        "rules": get_sample_rules(),
    }
