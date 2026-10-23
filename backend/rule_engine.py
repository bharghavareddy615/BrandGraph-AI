"""Deterministic Brand Rule Engine for BrandGraph AI."""

import re
from typing import Dict, List, Optional
import uuid

from backend.schemas import (
    Finding,
    FindingCategory,
    Severity,
    EvidenceStatus,
)
from backend.sample_data import (
    get_sample_prohibited_terms,
    get_sample_products,
    get_sample_disclaimers,
    get_sample_rules,
    get_sample_preferred_terms,
    get_sample_evidence_sources,
)


class DeterministicRuleEngine:
    """Executes reliable, offline brand policy checks without requiring an LLM."""

    def __init__(self):
        self.prohibited_terms = get_sample_prohibited_terms()
        self.products = get_sample_products()
        self.disclaimers = get_sample_disclaimers()
        self.rules = {r.id: r for r in get_sample_rules()}
        self.preferred_terms = get_sample_preferred_terms()
        self.evidence_sources = {s.id: s for s in get_sample_evidence_sources()}

    def evaluate(self, content: str) -> List[Finding]:
        if not content or not content.strip():
            return []

        findings: List[Finding] = []
        normalized = content.strip()

        # 1. Prohibited terms
        findings.extend(self._check_prohibited_terms(normalized))

        # 2. Unapproved product names
        findings.extend(self._check_unapproved_product_names(normalized))

        # 3. Missing mandatory disclaimers
        findings.extend(self._check_missing_disclaimers(normalized))

        # 4. Preferred terminology
        findings.extend(self._check_preferred_terminology(normalized))

        # 5. Contradicted claims
        findings.extend(self._check_contradicted_claims(normalized))

        # 6. Rule conflicts and superseded rules
        findings.extend(self._check_rule_conflicts_and_superseded(normalized))

        # Deduplicate
        deduped = []
        seen = set()
        for f in findings:
            key = (f.category, f.matched_text.lower(), f.rule_id)
            if key not in seen:
                seen.add(key)
                deduped.append(f)

        return deduped

    def _check_prohibited_terms(self, content: str) -> List[Finding]:
        findings = []
        rule = self.rules.get("RULE-001")
        for pt in self.prohibited_terms:
            pattern = rf"\b{re.escape(pt.term)}\b"
            for match in re.finditer(pattern, content, flags=re.IGNORECASE):
                matched = match.group(0)
                findings.append(
                    Finding(
                        id=f"FIND-PROH-{uuid.uuid4().hex[:6]}",
                        category=FindingCategory.PROHIBITED_TERM,
                        matched_text=matched,
                        rule_id=rule.id if rule else "RULE-001",
                        rule_description=rule.description if rule else "Prohibited Term",
                        severity=pt.severity,
                        explanation=f"Use of prohibited term '{matched}'. {pt.reason}",
                        suggested_action=f"Replace '{matched}' with an approved alternative.",
                        suggested_rewrite=pt.recommended_alternative,
                        evidence_status=EvidenceStatus.CONTRADICTED,
                        is_ai_assisted=False,
                    )
                )
        return findings

    def _check_unapproved_product_names(self, content: str) -> List[Finding]:
        findings = []
        rule = self.rules.get("RULE-002")
        for prod in self.products:
            for alias in prod.unapproved_aliases:
                pattern = rf"\b{re.escape(alias)}\b"
                for match in re.finditer(pattern, content, flags=re.IGNORECASE):
                    matched = match.group(0)
                    findings.append(
                        Finding(
                            id=f"FIND-NAME-{uuid.uuid4().hex[:6]}",
                            category=FindingCategory.UNAPPROVED_NAME,
                            matched_text=matched,
                            rule_id=rule.id if rule else "RULE-002",
                            rule_description=rule.description if rule else "Approved Product Naming Required",
                            severity=Severity.HIGH,
                            explanation=f"'{matched}' is an unapproved or deprecated alias for '{prod.name}'.",
                            suggested_action=f"Update product name to approved '{prod.name}'.",
                            suggested_rewrite=prod.name,
                            evidence_status=EvidenceStatus.NOT_APPLICABLE,
                            is_ai_assisted=False,
                        )
                    )
        return findings

    def _check_missing_disclaimers(self, content: str) -> List[Finding]:
        findings = []
        for disc in self.disclaimers:
            matched_keywords = [
                kw for kw in disc.trigger_keywords
                if re.search(rf"\b{re.escape(kw)}\b", content, flags=re.IGNORECASE)
            ]
            if matched_keywords:
                clean_disc = re.sub(r"\s+", " ", disc.required_text.lower()).strip()
                clean_content = re.sub(r"\s+", " ", content.lower()).strip()
                if clean_disc not in clean_content:
                    rule_id = disc.trigger_rule_id or "RULE-003"
                    rule = self.rules.get(rule_id)
                    findings.append(
                        Finding(
                            id=f"FIND-DISC-{uuid.uuid4().hex[:6]}",
                            category=FindingCategory.MISSING_DISCLAIMER,
                            matched_text=", ".join(matched_keywords),
                            rule_id=rule_id,
                            rule_description=rule.description if rule else f"Requires {disc.name}",
                            severity=rule.severity if rule else Severity.HIGH,
                            explanation=(
                                f"Draft cites benchmark/performance or advisory metrics ({', '.join(matched_keywords)}) "
                                f"without including mandatory disclaimer '{disc.name}'."
                            ),
                            suggested_action=f"Append the required disclaimer '{disc.name}' to the draft.",
                            suggested_rewrite=f"\n\n[Disclaimer: {disc.required_text}]",
                            evidence_source_id="SRC-001" if disc.id == "DISC-001" else "SRC-003",
                            evidence_excerpt=disc.required_text,
                            evidence_status=EvidenceStatus.SUPPORTED,
                            is_ai_assisted=False,
                        )
                    )
        return findings

    def _check_preferred_terminology(self, content: str) -> List[Finding]:
        findings = []
        for pt in self.preferred_terms:
            pattern = rf"\b{re.escape(pt.preferred_for)}\b"
            for match in re.finditer(pattern, content, flags=re.IGNORECASE):
                matched = match.group(0)
                findings.append(
                    Finding(
                        id=f"FIND-TERM-{uuid.uuid4().hex[:6]}",
                        category=FindingCategory.TONE_VOICE,
                        matched_text=matched,
                        rule_id="RULE-005",
                        rule_description="Brand Voice and Preferred Terminology Standard",
                        severity=Severity.LOW,
                        explanation=f"'{matched}' conflicts with preferred terminology. {pt.context}",
                        suggested_action=f"Consider using '{pt.term}' instead of '{matched}'.",
                        suggested_rewrite=pt.term,
                        evidence_status=EvidenceStatus.NOT_APPLICABLE,
                        is_ai_assisted=False,
                    )
                )
        return findings

    def _check_contradicted_claims(self, content: str) -> List[Finding]:
        findings = []
        if re.search(r"\b(zero|no)\s+false\s+(positives|alarms)\b", content, flags=re.IGNORECASE):
            src = self.evidence_sources.get("SRC-004")
            findings.append(
                Finding(
                    id=f"FIND-CONTRA-{uuid.uuid4().hex[:6]}",
                    category=FindingCategory.CONTRADICTED_CLAIM,
                    matched_text="zero false alarms / false positives",
                    rule_id="RULE-001",
                    rule_description="Evidence-Grounded Accuracy Verification",
                    severity=Severity.HIGH,
                    explanation=(
                        "Claiming complete elimination of false alarms is contradicted by benchmark evidence. "
                        "SRC-004 establishes a 42% reduction in false positives, not zero."
                    ),
                    suggested_action="Amend claim to reflect validated benchmark reduction of 42%.",
                    suggested_rewrite="reduced false positives by up to 42% in enterprise trials",
                    evidence_source_id="SRC-004",
                    evidence_excerpt=src.excerpt if src else "Reduced false positives by 42%.",
                    evidence_status=EvidenceStatus.CONTRADICTED,
                    is_ai_assisted=False,
                )
            )

        if re.search(r"\b(under|less than)\s+(5|1)\s*ms\b|instantaneous\b", content, flags=re.IGNORECASE):
            src = self.evidence_sources.get("SRC-001")
            findings.append(
                Finding(
                    id=f"FIND-CONTRA-{uuid.uuid4().hex[:6]}",
                    category=FindingCategory.CONTRADICTED_CLAIM,
                    matched_text="under 5ms / instantaneous",
                    rule_id="RULE-003",
                    rule_description="Evidence-Grounded Performance Verification",
                    severity=Severity.HIGH,
                    explanation=(
                        "Sub-5ms or instantaneous latency claims contradict official benchmark report SRC-001, "
                        "which records latency of under 45ms per 1,000 lines under standard load."
                    ),
                    suggested_action="Align latency claim with official benchmark figure (under 45ms per 1,000 lines).",
                    suggested_rewrite="under 45ms per 1,000 lines under standard load",
                    evidence_source_id="SRC-001",
                    evidence_excerpt=src.excerpt if src else "Observed latency of under 45ms per 1,000 code lines.",
                    evidence_status=EvidenceStatus.CONTRADICTED,
                    is_ai_assisted=False,
                )
            )

        return findings

    def _check_rule_conflicts_and_superseded(self, content: str) -> List[Finding]:
        findings = []
        if re.search(r"\binkloom suite\b", content, flags=re.IGNORECASE) or re.search(r"\binkloom ai cloud\b", content, flags=re.IGNORECASE):
            matched = "Inkloom Suite" if "inkloom suite" in content.lower() else "Inkloom AI Cloud"
            findings.append(
                Finding(
                    id=f"FIND-CONF-{uuid.uuid4().hex[:6]}",
                    category=FindingCategory.RULE_CONFLICT,
                    matched_text=matched,
                    rule_id="RULE-007",
                    rule_description="Conflicting Brand Guidelines Flagged",
                    severity=Severity.MEDIUM,
                    explanation=(
                        f"Found reference to '{matched}', which is subject to conflicting rules RULE-007 (Commercial reference) "
                        "and RULE-008 (Technical reference). Human editorial clarification is required."
                    ),
                    suggested_action="Consult the brand governing committee to resolve naming conflict between RULE-007 and RULE-008.",
                    suggested_rewrite="Inkloom AI Platform",
                    evidence_status=EvidenceStatus.NEEDS_VERIFICATION,
                    is_ai_assisted=False,
                )
            )

        if re.search(r"\binkloom assistant\b", content, flags=re.IGNORECASE):
            findings.append(
                Finding(
                    id=f"FIND-SUPER-{uuid.uuid4().hex[:6]}",
                    category=FindingCategory.POLICY_VIOLATION,
                    matched_text="Inkloom Assistant",
                    rule_id="RULE-006",
                    rule_description="Superseded Rule Applied",
                    severity=Severity.MEDIUM,
                    explanation=(
                        "'Inkloom Assistant' was permitted under legacy rule RULE-006 (2023), but has been superseded by "
                        "RULE-002 requiring 'Inkloom Copilot'."
                    ),
                    suggested_action="Replace superseded term 'Inkloom Assistant' with approved name 'Inkloom Copilot'.",
                    suggested_rewrite="Inkloom Copilot",
                    evidence_status=EvidenceStatus.CONTRADICTED,
                    is_ai_assisted=False,
                )
            )

        return findings
