"""Deterministic Brand Rule Engine for BrandGraph AI."""

from datetime import datetime
import re
from typing import Dict, List, Optional, Set
import uuid

from brandgraph.schemas import (
    Finding,
    FindingCategory,
    Severity,
    EvidenceStatus,
    ProhibitedTerm,
    Product,
    Disclaimer,
    Rule,
    PreferredTerm,
)
from brandgraph.sample_data import (
    get_sample_prohibited_terms,
    get_sample_products,
    get_sample_disclaimers,
    get_sample_rules,
    get_sample_preferred_terms,
    get_sample_evidence_sources,
)
from brandgraph.retrieval import EvidenceRetriever


class DeterministicRuleEngine:
    """Executes reliable, offline brand policy checks without requiring an LLM."""

    def __init__(self, retriever: Optional[EvidenceRetriever] = None):
        self.prohibited_terms = get_sample_prohibited_terms()
        self.products = get_sample_products()
        self.disclaimers = get_sample_disclaimers()
        self.rules = {r.id: r for r in get_sample_rules()}
        self.preferred_terms = get_sample_preferred_terms()
        self.evidence_sources = {s.id: s for s in get_sample_evidence_sources()}
        self.retriever = retriever or EvidenceRetriever()

    def evaluate(self, content: str) -> List[Finding]:
        """Evaluates content against brand rules, naming standards, disclaimers, and evidence."""
        if not content or not content.strip():
            return []

        findings: List[Finding] = []
        normalized = content.strip()

        # 1. Prohibited terms (with variations)
        findings.extend(self._check_prohibited_terms(normalized))

        # 2. Unapproved product names (with alias variations)
        findings.extend(self._check_unapproved_product_names(normalized))

        # 3. Missing mandatory disclaimers (with robust presence detection)
        findings.extend(self._check_missing_disclaimers(normalized))

        # 4. Preferred terminology
        findings.extend(self._check_preferred_terminology(normalized))

        # 5. Contradicted claims (evidence-grounded)
        findings.extend(self._check_contradicted_claims(normalized))

        # 6. Rule conflicts and superseded rules
        findings.extend(self._check_rule_conflicts_and_superseded(normalized))

        # 7. Unsupported claims & missing evidence (assertive claims lacking approved grounding)
        findings.extend(self._check_unsupported_claims(normalized))

        # Deduplicate findings by (category, matched_text_lower, rule_id)
        deduped: List[Finding] = []
        seen: Set[tuple] = set()
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
            patterns: List[str] = []
            term_lower = pt.term.lower()

            if "bug-free" in term_lower:
                patterns.append(r"\b100%\s*(?:bug[- ]?free|defect[- ]?free)\b")
                patterns.append(r"\b(?:zero[- ]defects?)\b")
            elif "hack-proof" in term_lower:
                patterns.append(r"\b(?:hack[- ]?proof|unhackable)\b")
            elif "guaranteed returns" in term_lower:
                patterns.append(r"\bguaranteed\s+(?:returns?|roi|profits?)\b")
            elif "revolutionary miracle" in term_lower:
                patterns.append(r"\brevolutionary\s+(?:miracles?|magic)\b")
            else:
                escaped = re.escape(pt.term)
                flexible = re.sub(r"(\\ )|(\\-)", r"[-\\s]+", escaped)
                patterns.append(rf"\b{flexible}s?\b")

            for pat in patterns:
                for match in re.finditer(pat, content, flags=re.IGNORECASE):
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

        approved_names: Set[str] = set()
        for prod in self.products:
            approved_names.add(prod.name.lower())
            for alias in prod.approved_aliases:
                approved_names.add(alias.lower())

        for prod in self.products:
            for alias in prod.unapproved_aliases:
                words = re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\b)", alias)
                if len(words) >= 2:
                    flexible_alias = r"[-\s]?".join(re.escape(w) for w in words)
                    pattern = rf"\b{flexible_alias}\b"
                else:
                    pattern = rf"\b{re.escape(alias)}\b"

                for match in re.finditer(pattern, content, flags=re.IGNORECASE):
                    matched = match.group(0)
                    matched_lower = matched.lower()

                    if matched_lower in approved_names:
                        continue

                    start = match.start()
                    preceding = content[max(0, start - 15):start].strip().lower()
                    if f"{preceding} {matched_lower}".strip() in approved_names:
                        continue

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
        content_lower = content.lower()

        for disc in self.disclaimers:
            triggered = False
            matched_keywords = []

            if disc.id == "DISC-001":
                bench_patterns = [
                    r"\b(?:benchmark|benchmarks|benchmarking)\b",
                    r"\blatency\b",
                    r"\bthroughput\b",
                    r"\b\d+\s*ms\b",
                    r"\b\d+x\s+faster\b",
                    r"\b\d+%\s+(?:speedup|reduction\s+in\s+latency|faster)\b",
                ]
                for pat in bench_patterns:
                    m = re.search(pat, content, flags=re.IGNORECASE)
                    if m:
                        triggered = True
                        matched_keywords.append(m.group(0))

                if triggered:
                    has_clause1 = (
                        "performance figures depend" in content_lower
                        or "workload characteristics" in content_lower
                    )
                    has_clause2 = (
                        "outcomes may vary" in content_lower
                        or "results may vary" in content_lower
                    )
                    is_present = (has_clause1 and has_clause2) or (
                        re.sub(r"\s+", " ", disc.required_text.lower()).strip() in content_lower
                    )
                    if not is_present:
                        rule = self.rules.get(disc.trigger_rule_id or "RULE-003")
                        findings.append(
                            Finding(
                                id=f"FIND-DISC-{uuid.uuid4().hex[:6]}",
                                category=FindingCategory.MISSING_DISCLAIMER,
                                matched_text=", ".join(matched_keywords[:3]),
                                rule_id=disc.trigger_rule_id or "RULE-003",
                                rule_description=rule.description if rule else f"Requires {disc.name}",
                                severity=rule.severity if rule else Severity.HIGH,
                                explanation=(
                                    f"Draft cites performance benchmark metrics ({', '.join(matched_keywords[:3])}) "
                                    f"without including mandatory disclaimer '{disc.name}'."
                                ),
                                suggested_action=f"Append the required disclaimer '{disc.name}' to the draft.",
                                suggested_rewrite=f"\n\n[Disclaimer: {disc.required_text}]",
                                evidence_source_id="SRC-001",
                                evidence_excerpt=disc.required_text,
                                evidence_status=EvidenceStatus.SUPPORTED,
                                is_ai_assisted=False,
                            )
                        )

            elif disc.id == "DISC-002":
                advisory_patterns = [
                    r"\b(?:audit\s+guarantee|regulatory\s+proof|guaranteed\s+compliance)\b",
                    r"\b(?:legal\s+compliance\s+guarantee|compliance\s+audit\s+guarantee)\b",
                    r"\b(?:legal\s+advice|financial\s+advice|clinical\s+advice)\b",
                ]
                for pat in advisory_patterns:
                    m = re.search(pat, content, flags=re.IGNORECASE)
                    if m:
                        triggered = True
                        matched_keywords.append(m.group(0))

                if triggered:
                    has_advice_clause = (
                        "does not provide legal" in content_lower
                        or "does not provide financial advice" in content_lower
                    )
                    has_verif_clause = (
                        "recommendations require verification" in content_lower
                        or "authorized personnel" in content_lower
                    )
                    is_present = (has_advice_clause and has_verif_clause) or (
                        re.sub(r"\s+", " ", disc.required_text.lower()).strip() in content_lower
                    )
                    if not is_present:
                        rule = self.rules.get(disc.trigger_rule_id or "RULE-004")
                        findings.append(
                            Finding(
                                id=f"FIND-DISC-{uuid.uuid4().hex[:6]}",
                                category=FindingCategory.MISSING_DISCLAIMER,
                                matched_text=", ".join(matched_keywords[:3]),
                                rule_id=disc.trigger_rule_id or "RULE-004",
                                rule_description=rule.description if rule else f"Requires {disc.name}",
                                severity=rule.severity if rule else Severity.MEDIUM,
                                explanation=(
                                    f"Draft references regulatory proof or compliance audit guarantees ({', '.join(matched_keywords[:3])}) "
                                    f"without including mandatory advisory disclaimer '{disc.name}'."
                                ),
                                suggested_action=f"Append the required disclaimer '{disc.name}' to the draft.",
                                suggested_rewrite=f"\n\n[Disclaimer: {disc.required_text}]",
                                evidence_source_id="SRC-003",
                                evidence_excerpt=disc.required_text,
                                evidence_status=EvidenceStatus.SUPPORTED,
                                is_ai_assisted=False,
                            )
                        )

        return findings

    def _check_preferred_terminology(self, content: str) -> List[Finding]:
        findings = []
        for pt in self.preferred_terms:
            escaped = re.escape(pt.preferred_for)
            flexible = re.sub(r"(\\ )|(\\-)", r"[-\\s]+", escaped)
            pattern = rf"\b{flexible}\b"
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

        zero_false_pat = (
            r"\b(?:zero|no|0|0%)\s+false\s+(?:positives?|alarms?)\b|"
            r"\b(?:eliminat(?:es?|ing)|elimination\s+of)\s+(?:all\s+|100%\s+of\s+)?false\s+(?:positives?|alarms?)\b|"
            r"\b100%\s+precision\b|"
            r"\bnever\s+(?:flags?|creates?|generates?)\s+false\s+(?:positives?|alarms?)\b"
        )
        match_false = re.search(zero_false_pat, content, flags=re.IGNORECASE)
        if match_false:
            src = self.evidence_sources.get("SRC-004")
            findings.append(
                Finding(
                    id=f"FIND-CONTRA-{uuid.uuid4().hex[:6]}",
                    category=FindingCategory.CONTRADICTED_CLAIM,
                    matched_text=match_false.group(0),
                    rule_id="RULE-001",
                    rule_description="Evidence-Grounded Accuracy Verification",
                    severity=Severity.HIGH,
                    explanation=(
                        "Claiming complete elimination of false alarms is contradicted by benchmark evidence. "
                        "SRC-004 establishes a 42% reduction in false positives in enterprise trials, not complete elimination."
                    ),
                    suggested_action="Amend claim to reflect validated benchmark reduction of 42%.",
                    suggested_rewrite="reduced false positives by up to 42% in enterprise trials",
                    evidence_source_id="SRC-004",
                    evidence_excerpt=src.excerpt if src else "Reduced false positives by 42%.",
                    evidence_status=EvidenceStatus.CONTRADICTED,
                    is_ai_assisted=False,
                )
            )

        latency_contra_pat = (
            r"\b(?:under|less\s+than|sub[- ]?)\s*(?:[0-9]|10)\s*ms\b|"
            r"\binstantaneous\s+(?:latency|execution|scanning|processing)\b|"
            r"\binstantaneous\b|"
            r"\bzero[- ]latency\b"
        )
        match_lat = re.search(latency_contra_pat, content, flags=re.IGNORECASE)
        if match_lat:
            src = self.evidence_sources.get("SRC-001")
            findings.append(
                Finding(
                    id=f"FIND-CONTRA-{uuid.uuid4().hex[:6]}",
                    category=FindingCategory.CONTRADICTED_CLAIM,
                    matched_text=match_lat.group(0),
                    rule_id="RULE-003",
                    rule_description="Evidence-Grounded Performance Verification",
                    severity=Severity.HIGH,
                    explanation=(
                        f"Claim '{match_lat.group(0)}' contradicts official benchmark report SRC-001, "
                        "which records an observed latency of under 45ms per 1,000 code lines under standard load."
                    ),
                    suggested_action="Align latency claim with official benchmark figure (under 45ms per 1,000 lines).",
                    suggested_rewrite="under 45ms per 1,000 lines under standard load",
                    evidence_source_id="SRC-001",
                    evidence_excerpt=src.excerpt if src else "Observed latency of under 45ms per 1,000 code lines.",
                    evidence_status=EvidenceStatus.CONTRADICTED,
                    is_ai_assisted=False,
                )
            )

        uptime_contra_pat = (
            r"\b(?:100%|zero)\s+(?:uptime|downtime)\s+guarantee[sd]?\b|"
            r"\bzero\s+unplanned\s+outages\s+forever\b|"
            r"\b100%\s+availability\s+guarantee\b"
        )
        match_uptime = re.search(uptime_contra_pat, content, flags=re.IGNORECASE)
        if match_uptime:
            src = self.evidence_sources.get("SRC-003")
            findings.append(
                Finding(
                    id=f"FIND-CONTRA-{uuid.uuid4().hex[:6]}",
                    category=FindingCategory.CONTRADICTED_CLAIM,
                    matched_text=match_uptime.group(0),
                    rule_id="RULE-001",
                    rule_description="Evidence-Grounded Uptime Verification",
                    severity=Severity.HIGH,
                    explanation=(
                        "Absolute 100% uptime guarantees violate disclosure policy. "
                        "SRC-003 documents zero unplanned outages across 180 continuous operating days in a certified multi-tenant cluster."
                    ),
                    suggested_action="Amend to reflect 180 continuous operating days without unplanned outages.",
                    suggested_rewrite="zero unplanned outages across 180 continuous operating days",
                    evidence_source_id="SRC-003",
                    evidence_excerpt=src.excerpt if src else "Zero unplanned outages over 180 operating days.",
                    evidence_status=EvidenceStatus.CONTRADICTED,
                    is_ai_assisted=False,
                )
            )

        return findings

    def _check_unsupported_claims(self, content: str) -> List[Finding]:
        """Identifies assertive factual or quantitative claims lacking approved evidence grounding."""
        findings = []

        unsupported_patterns = [
            r"\b(?:increases?|improves?|boosts?|accelerates?|reduces?|cuts?)\s+[^.!?\n]{3,50}?\s+by\s+(?:\d+(?:\.\d+)?%|\d+\s*(?:points?|x|fold))\b",
            r"\b(?:cures?|prevents?)\s+[a-zA-Z]{3,20}\b",
            r"\bcertified\s+by\s+(?:NATO|FDA|NSA|DoD|United\s+Nations)\b|\bFDA\s+approved\b",
        ]

        for pat in unsupported_patterns:
            for match in re.finditer(pat, content, flags=re.IGNORECASE):
                assertion = match.group(0).strip()

                if "false positive" in assertion.lower() or "false alarm" in assertion.lower():
                    continue

                results = self.retriever.search(assertion, top_k=1, min_score=0.20)
                if not results:
                    findings.append(
                        Finding(
                            id=f"FIND-UNSUP-{uuid.uuid4().hex[:6]}",
                            category=FindingCategory.UNSUPPORTED_CLAIM,
                            matched_text=assertion,
                            rule_id=None,
                            rule_description="Evidence Grounding Required",
                            severity=Severity.MEDIUM,
                            explanation=(
                                f"Draft asserts '{assertion}', which lacks supporting evidence in approved brand documentation. "
                                "All quantitative performance or capability claims require evidence verification."
                            ),
                            suggested_action="Provide verified source documentation (e.g. benchmark study or audit report) or remove the unverified claim.",
                            suggested_rewrite=None,
                            evidence_source_id=None,
                            evidence_excerpt=None,
                            evidence_status=EvidenceStatus.NEEDS_VERIFICATION,
                            is_ai_assisted=False,
                        )
                    )

        return findings

    def _check_rule_conflicts_and_superseded(self, content: str) -> List[Finding]:
        findings = []

        if re.search(r"\binkloom[- ]?suite\b", content, flags=re.IGNORECASE) or re.search(
            r"\binkloom[- ]?ai[- ]?cloud\b", content, flags=re.IGNORECASE
        ):
            matched = "Inkloom Suite" if "suite" in content.lower() else "Inkloom AI Cloud"
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

        if re.search(r"\binkloom[- ]?assistant\b", content, flags=re.IGNORECASE):
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
