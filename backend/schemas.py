"""Pydantic schemas and domain models for BrandGraph AI."""

from __future__ import annotations
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# -----------------------------------------------------------------------------
# Enums
# -----------------------------------------------------------------------------

class NodeType(str, Enum):
    BRAND = "Brand"
    PRODUCT = "Product"
    RULE = "Rule"
    PREFERRED_TERM = "PreferredTerm"
    PROHIBITED_TERM = "ProhibitedTerm"
    CLAIM = "Claim"
    EVIDENCE_SOURCE = "EvidenceSource"
    DISCLAIMER = "Disclaimer"
    CONTENT_DRAFT = "ContentDraft"
    FINDING = "Finding"
    REVIEW_DECISION = "ReviewDecision"


class EdgeType(str, Enum):
    HAS_APPROVED_NAME = "HAS_APPROVED_NAME"
    PROHIBITS = "PROHIBITS"
    REQUIRES = "REQUIRES"
    SUPPORTS = "SUPPORTS"
    CONTRADICTS = "CONTRADICTS"
    APPLIES_TO = "APPLIES_TO"
    SUPERSEDES = "SUPERSEDES"
    TRIGGERED_BY = "TRIGGERED_BY"
    SUPPORTED_BY = "SUPPORTED_BY"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class FindingCategory(str, Enum):
    PROHIBITED_TERM = "prohibited_term"
    UNAPPROVED_NAME = "unapproved_name"
    MISSING_DISCLAIMER = "missing_disclaimer"
    CONTRADICTED_CLAIM = "contradicted_claim"
    UNSUPPORTED_CLAIM = "unsupported_claim"
    RULE_CONFLICT = "rule_conflict"
    TONE_VOICE = "tone_voice"
    POLICY_VIOLATION = "policy_violation"


class EvidenceStatus(str, Enum):
    SUPPORTED = "supported"
    CONTRADICTED = "contradicted"
    NEEDS_VERIFICATION = "Needs verification"
    NOT_APPLICABLE = "not_applicable"


class ReviewState(str, Enum):
    DRAFT = "Draft"
    NEEDS_REVISION = "Needs Revision"
    SUBMITTED_FOR_REVIEW = "Submitted for Review"
    APPROVED = "Approved"
    REJECTED = "Rejected"


class RuleStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    CONFLICTING = "conflicting"
    DEPRECATED = "deprecated"


# -----------------------------------------------------------------------------
# Entities
# -----------------------------------------------------------------------------

class Brand(BaseModel):
    id: str
    name: str
    industry: str
    description: str
    voice_and_tone: str


class Product(BaseModel):
    id: str
    brand_id: str
    name: str
    category: str
    description: str
    approved_aliases: List[str] = Field(default_factory=list)
    unapproved_aliases: List[str] = Field(default_factory=list)


class PreferredTerm(BaseModel):
    id: str
    brand_id: str
    term: str
    preferred_for: str
    context: str = ""


class ProhibitedTerm(BaseModel):
    id: str
    brand_id: str
    term: str
    reason: str
    recommended_alternative: Optional[str] = None
    severity: Severity = Severity.HIGH


class Disclaimer(BaseModel):
    id: str
    brand_id: str
    name: str
    required_text: str
    trigger_keywords: List[str] = Field(default_factory=list)
    trigger_rule_id: Optional[str] = None


class EvidenceSource(BaseModel):
    id: str
    title: str
    source_type: str
    publication_date: str
    excerpt: str
    provenance: str
    is_synthetic: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)


class Claim(BaseModel):
    id: str
    brand_id: str
    statement: str
    claim_type: str
    evidence_source_id: Optional[str] = None
    status: EvidenceStatus = EvidenceStatus.SUPPORTED
    allowed_wording: Optional[str] = None
    forbidden_wording: Optional[str] = None


class Rule(BaseModel):
    id: str
    brand_id: str
    title: str
    description: str
    category: FindingCategory
    severity: Severity = Severity.MEDIUM
    status: RuleStatus = RuleStatus.ACTIVE
    superseded_by: Optional[str] = None
    conflicts_with: Optional[str] = None
    applies_to_product_id: Optional[str] = None
    disclaimer_id: Optional[str] = None
    effective_date: str = "2025-01-01"


# -----------------------------------------------------------------------------
# Findings & Content Drafts
# -----------------------------------------------------------------------------

class Finding(BaseModel):
    id: str
    category: FindingCategory
    matched_text: str
    rule_id: Optional[str] = None
    rule_description: Optional[str] = None
    severity: Severity = Severity.MEDIUM
    explanation: str
    suggested_action: str
    suggested_rewrite: Optional[str] = None
    evidence_source_id: Optional[str] = None
    evidence_excerpt: Optional[str] = None
    evidence_status: EvidenceStatus = EvidenceStatus.NOT_APPLICABLE
    is_ai_assisted: bool = False
    dismissed: bool = False
    dismissed_reason: Optional[str] = None


class ContentDraft(BaseModel):
    id: str
    title: str = "Untitled Draft"
    content: str
    product_id: Optional[str] = None
    author: str = "Content Creator"
    current_state: ReviewState = ReviewState.DRAFT
    findings: List[Finding] = Field(default_factory=list)
    version: int = 1
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReviewComment(BaseModel):
    id: str
    draft_id: str
    author: str
    comment_text: str
    finding_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReviewDecision(BaseModel):
    id: str
    draft_id: str
    reviewer: str
    from_state: ReviewState
    to_state: ReviewState
    decision_notes: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SearchResult(BaseModel):
    source_id: str
    source_title: str
    chunk_id: str
    score: float
    text: str
    provenance: str
    section: Optional[str] = None


# -----------------------------------------------------------------------------
# API Request / Response Schemas
# -----------------------------------------------------------------------------

class ReviewRequest(BaseModel):
    content: str
    title: Optional[str] = "Untitled Marketing Draft"
    author: Optional[str] = "Content Creator"
    product_id: Optional[str] = "PROD-COPILOT"
    draft_id: Optional[str] = None


class CreateDraftRequest(BaseModel):
    title: str
    content: str
    author: str = "Content Creator"
    product_id: Optional[str] = "PROD-COPILOT"


class AddCommentRequest(BaseModel):
    author: str
    comment_text: str
    finding_id: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    new_state: ReviewState
    reviewer: str
    decision_notes: Optional[str] = ""


class ApplyRewriteRequest(BaseModel):
    finding_id: str


class DismissFindingRequest(BaseModel):
    finding_id: str
    reason: Optional[str] = "Dismissed by reviewer"


# -----------------------------------------------------------------------------
# Stress Test Models
# -----------------------------------------------------------------------------

class TestCase(BaseModel):
    test_id: str
    name: str
    input_content: str
    expected_category: Optional[FindingCategory] = None
    expected_status: ReviewState = ReviewState.NEEDS_REVISION
    expected_rule_or_evidence_id: Optional[str] = None
    description: str


class TestExecutionResult(BaseModel):
    test_id: str
    name: str
    passed: bool
    expected_category: Optional[str]
    actual_categories: List[str]
    expected_rule_or_evidence: Optional[str]
    actual_rules_and_sources: List[str]
    findings_count: int
    error_message: Optional[str] = None
    details: str = ""


class EvaluationSuiteSummary(BaseModel):
    total_tests: int
    passed_tests: int
    failed_tests: int
    false_positives: int
    false_negatives: int
    accuracy_percentage: float
    execution_time_seconds: float
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    results: List[TestExecutionResult] = Field(default_factory=list)


# -----------------------------------------------------------------------------
# AI Schemas
# -----------------------------------------------------------------------------

class AIReviewFinding(BaseModel):
    category: FindingCategory
    matched_text: str
    explanation: str
    suggested_action: str
    suggested_rewrite: Optional[str] = None
    evidence_source_id: Optional[str] = None
    evidence_status: EvidenceStatus = EvidenceStatus.NEEDS_VERIFICATION
    confidence_score: float = 0.85


class AIReviewResponse(BaseModel):
    tone_and_voice_assessment: str
    findings: List[AIReviewFinding] = Field(default_factory=list)
    overall_recommendation: str
