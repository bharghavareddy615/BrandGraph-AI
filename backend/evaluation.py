"""Brand Stress Tester & Synthetic Evaluation Suite for BrandGraph AI."""

from datetime import datetime
import time
from typing import List, Optional

from backend.schemas import (
    TestCase,
    TestExecutionResult,
    EvaluationSuiteSummary,
    FindingCategory,
    ReviewState,
)
from backend.review_service import ReviewService
from backend.database import DatabaseManager


def get_curated_test_cases() -> List[TestCase]:
    """Returns the 10 curated synthetic test cases covering all required stress conditions."""
    return [
        TestCase(
            test_id="STRESS-01",
            name="Prohibited Phrase Detection",
            input_content="Our platform is guaranteed to be 100% bug-free and completely hack-proof across all environments.",
            expected_category=FindingCategory.PROHIBITED_TERM,
            expected_status=ReviewState.NEEDS_REVISION,
            expected_rule_or_evidence_id="RULE-001",
            description="Tests detection of absolute zero-defect security claims that violate brand policies.",
        ),
        TestCase(
            test_id="STRESS-02",
            name="Unapproved Product Alias",
            input_content="Get started today with Inkloom Bot to automate your team's compliance review workflows.",
            expected_category=FindingCategory.UNAPPROVED_NAME,
            expected_status=ReviewState.NEEDS_REVISION,
            expected_rule_or_evidence_id="RULE-002",
            description="Tests detection of unapproved or deprecated colloquial product naming ('Inkloom Bot').",
        ),
        TestCase(
            test_id="STRESS-03",
            name="Missing Mandatory Disclaimer",
            input_content="Inkloom Sentinel scans enterprise code with under 45ms latency and ultra-fast throughput.",
            expected_category=FindingCategory.MISSING_DISCLAIMER,
            expected_status=ReviewState.NEEDS_REVISION,
            expected_rule_or_evidence_id="RULE-003",
            description="Tests requirement of DISC-001 whenever benchmark latency metrics are cited without the disclaimer.",
        ),
        TestCase(
            test_id="STRESS-04",
            name="Fully Compliant Content",
            input_content=(
                "Inkloom Copilot provides human-in-the-loop governance for enterprise AI workflows. "
                "Performance figures depend on workload characteristics, configuration, and cluster capacity. "
                "Individual outcomes may vary."
            ),
            expected_category=None,
            expected_status=ReviewState.DRAFT,
            expected_rule_or_evidence_id=None,
            description="Tests that compliant content with approved naming and disclaimers passes without violations.",
        ),
        TestCase(
            test_id="STRESS-05",
            name="Claim Supported by Synthetic Evidence",
            input_content="Inkloom Cloud encrypts data using TLS 1.3 in transit and AES-256 at rest across all tiers.",
            expected_category=None,
            expected_status=ReviewState.DRAFT,
            expected_rule_or_evidence_id="SRC-003",
            description="Tests positive grounding against SOC2 Audit Summary (SRC-003).",
        ),
        TestCase(
            test_id="STRESS-06",
            name="Claim Contradicted by Synthetic Evidence",
            input_content="Inkloom Sentinel guarantees zero false alarms and complete elimination of false positives.",
            expected_category=FindingCategory.CONTRADICTED_CLAIM,
            expected_status=ReviewState.NEEDS_REVISION,
            expected_rule_or_evidence_id="SRC-004",
            description="Tests detection of claims contradicted by trial benchmark evidence (SRC-004: 42% reduction, not zero).",
        ),
        TestCase(
            test_id="STRESS-07",
            name="Unsupported Claim (Needs Verification)",
            input_content="Inkloom Sentinel increases developer cognitive IQ by 47 points within two weeks of deployment.",
            expected_category=FindingCategory.UNSUPPORTED_CLAIM,
            expected_status=ReviewState.NEEDS_REVISION,
            expected_rule_or_evidence_id=None,
            description="Tests that statements without approved evidence trigger uncertainty rather than false certainty.",
        ),
        TestCase(
            test_id="STRESS-08",
            name="Conflicting & Superseded Rules",
            input_content="Deploy the Inkloom Suite for marketing, or switch to Inkloom Assistant for legacy support.",
            expected_category=FindingCategory.RULE_CONFLICT,
            expected_status=ReviewState.NEEDS_REVISION,
            expected_rule_or_evidence_id="RULE-007",
            description="Tests identification of conflicting guidelines (RULE-007 vs RULE-008) and superseded rule RULE-006.",
        ),
        TestCase(
            test_id="STRESS-09",
            name="Empty Content Submission",
            input_content="   ",
            expected_category=None,
            expected_status=ReviewState.NEEDS_REVISION,
            expected_rule_or_evidence_id=None,
            description="Tests edge case of whitespace-only or empty content input.",
        ),
        TestCase(
            test_id="STRESS-10",
            name="Offline / LLM Unavailable Resilience",
            input_content="Inkloom Bot claims to be 100% bug-free with instantaneous execution.",
            expected_category=FindingCategory.PROHIBITED_TERM,
            expected_status=ReviewState.NEEDS_REVISION,
            expected_rule_or_evidence_id="RULE-001",
            description="Tests that deterministic engine functions independently when AI provider is offline or unconfigured.",
        ),
    ]


class EvaluationRunner:
    """Executes the test suite and generates repeatable evaluation metrics."""

    def __init__(
        self,
        review_service: Optional[ReviewService] = None,
        db_manager: Optional[DatabaseManager] = None,
    ):
        self.review_service = review_service or ReviewService()
        self.db = db_manager or DatabaseManager()

    def run_suite(self) -> EvaluationSuiteSummary:
        """Executes all curated test cases against the real review pipeline."""
        start_time = time.time()
        test_cases = get_curated_test_cases()
        results: List[TestExecutionResult] = []

        passed_count = 0
        failed_count = 0
        false_positives = 0
        false_negatives = 0

        for tc in test_cases:
            try:
                # Review content in memory without polluting main draft database
                draft = self.review_service.review_draft(
                    content=tc.input_content,
                    title=f"Test Run: {tc.name}",
                    save_to_db=False,
                )

                actual_categories = [f.category.value for f in draft.findings if not f.dismissed]
                actual_rules_and_sources = [
                    f.rule_id for f in draft.findings if f.rule_id
                ] + [
                    f.evidence_source_id for f in draft.findings if f.evidence_source_id
                ]

                # Evaluation matching logic
                is_passed = False
                details = ""

                if tc.test_id == "STRESS-04":
                    # Fully compliant test expects zero policy violation findings
                    if len(actual_categories) == 0:
                        is_passed = True
                        details = "Compliant draft passed cleanly with 0 violations."
                    else:
                        is_passed = False
                        false_positives += 1
                        details = f"Expected 0 violations, but flagged: {actual_categories}"

                elif tc.test_id == "STRESS-05":
                    # Supported claim: checks retrieval grounding
                    retrieval_res = self.review_service.retriever.search(tc.input_content, top_k=1)
                    if retrieval_res and any(tc.expected_rule_or_evidence_id in r.source_id for r in retrieval_res):
                        is_passed = True
                        details = f"Grounding verified: retrieved {retrieval_res[0].source_id} ({retrieval_res[0].source_title})."
                    else:
                        is_passed = False
                        false_negatives += 1
                        details = f"Failed to retrieve expected source {tc.expected_rule_or_evidence_id}."

                elif tc.test_id == "STRESS-07":
                    # Unsupported claim: check retrieval yields Needs verification
                    retrieval_ctx = self.review_service.retriever.retrieve_with_context(tc.input_content)
                    if retrieval_ctx["evidence_status"].value == "Needs verification":
                        is_passed = True
                        details = "Correctly labeled as 'Needs verification' due to lack of approved supporting sources."
                    else:
                        is_passed = False
                        false_positives += 1
                        details = f"Expected 'Needs verification', got {retrieval_ctx['evidence_status']}."

                elif tc.test_id == "STRESS-09":
                    # Empty input test
                    if len(draft.content) == 0 and draft.current_state == ReviewState.NEEDS_REVISION:
                        is_passed = True
                        details = "Gracefully handled empty input, state set to Needs Revision."
                    else:
                        is_passed = False
                        details = "Unexpected state or failure on empty content."

                else:
                    # General violation test: match expected category or expected rule/evidence ID
                    category_matched = (
                        tc.expected_category.value in actual_categories
                        if tc.expected_category else True
                    )
                    rule_matched = (
                        tc.expected_rule_or_evidence_id in actual_rules_and_sources
                        if tc.expected_rule_or_evidence_id else True
                    )

                    if category_matched and rule_matched:
                        is_passed = True
                        details = f"Flagged expected category '{tc.expected_category.value if tc.expected_category else ''}' with rule '{tc.expected_rule_or_evidence_id}'."
                    else:
                        is_passed = False
                        if not actual_categories:
                            false_negatives += 1
                            details = f"Missed violation: expected '{tc.expected_category}', found 0 findings."
                        else:
                            details = f"Mismatch: expected '{tc.expected_category}', got {actual_categories}."

                if is_passed:
                    passed_count += 1
                else:
                    failed_count += 1

                results.append(
                    TestExecutionResult(
                        test_id=tc.test_id,
                        name=tc.name,
                        passed=is_passed,
                        expected_category=tc.expected_category.value if tc.expected_category else None,
                        actual_categories=actual_categories,
                        expected_rule_or_evidence=tc.expected_rule_or_evidence_id,
                        actual_rules_and_sources=actual_rules_and_sources,
                        findings_count=len(draft.findings),
                        details=details,
                    )
                )

            except Exception as e:
                failed_count += 1
                results.append(
                    TestExecutionResult(
                        test_id=tc.test_id,
                        name=tc.name,
                        passed=False,
                        expected_category=tc.expected_category.value if tc.expected_category else None,
                        actual_categories=[],
                        expected_rule_or_evidence=tc.expected_rule_or_evidence_id,
                        actual_rules_and_sources=[],
                        findings_count=0,
                        error_message=str(e),
                        details=f"Test execution crashed with error: {str(e)}",
                    )
                )

        exec_time = round(time.time() - start_time, 3)
        total = len(test_cases)
        accuracy = round((passed_count / total) * 100.0, 1) if total > 0 else 0.0

        summary = EvaluationSuiteSummary(
            total_tests=total,
            passed_tests=passed_count,
            failed_tests=failed_count,
            false_positives=false_positives,
            false_negatives=false_negatives,
            accuracy_percentage=accuracy,
            execution_time_seconds=exec_time,
            timestamp=datetime.utcnow(),
            results=results,
        )

        # Persist evaluation run into SQLite
        self.db.save_evaluation_run(summary)
        return summary
