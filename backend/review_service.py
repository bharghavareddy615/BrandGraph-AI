"""Core Review Service orchestrating Deterministic Checks, RAG, Graph Traversal, and Persistence."""

from datetime import datetime, timezone
import re
from typing import Dict, List, Optional
import uuid

from backend.schemas import (
    ContentDraft,
    Finding,
    FindingCategory,
    ReviewState,
    EvidenceStatus,
    NodeType,
    EdgeType,
)
from backend.graph_store import BrandGraphStore
from backend.retrieval import EvidenceRetriever
from backend.rule_engine import DeterministicRuleEngine
from backend.ai_review import AIReviewService
from backend.database import DatabaseManager


class ReviewService:
    """Coordinates brand governance review workflows."""

    def __init__(
        self,
        graph_store: Optional[BrandGraphStore] = None,
        db_manager: Optional[DatabaseManager] = None,
    ):
        self.graph_store = graph_store or BrandGraphStore()
        self.retriever = EvidenceRetriever(self.graph_store)
        self.rule_engine = DeterministicRuleEngine(retriever=self.retriever)
        self.ai_review_service = AIReviewService()
        self.db = db_manager or DatabaseManager()

    def review_draft(
        self,
        content: str,
        title: str = "New Content Draft",
        author: str = "Content Creator",
        product_id: Optional[str] = "PROD-COPILOT",
        draft_id: Optional[str] = None,
        save_to_db: bool = True,
    ) -> ContentDraft:
        """Executes the complete evidence-linked review pipeline."""
        final_draft_id = draft_id or f"DRAFT-{uuid.uuid4().hex[:8].upper()}"

        if not content or not content.strip():
            draft = ContentDraft(
                id=final_draft_id,
                title=title,
                content="",
                product_id=product_id,
                author=author,
                current_state=ReviewState.NEEDS_REVISION,
                findings=[],
            )
            if save_to_db:
                self.db.save_draft(draft)
            return draft

        # 1. Deterministic Rule Engine checks
        deterministic_findings = self.rule_engine.evaluate(content)

        # 2. RAG Retrieval for evidence grounding
        retrieval_context = self.retriever.retrieve_with_context(content, top_k=3)
        retrieved_sources = retrieval_context["results"]

        # Link evidence to claim findings if not already explicitly linked
        for f in deterministic_findings:
            if f.category in (FindingCategory.UNSUPPORTED_CLAIM, FindingCategory.CONTRADICTED_CLAIM):
                if not f.evidence_source_id and retrieved_sources:
                    snippet_matches = self.retriever.search(f.matched_text, top_k=1)
                    if snippet_matches:
                        f.evidence_source_id = snippet_matches[0].source_id
                        f.evidence_excerpt = snippet_matches[0].text

        all_findings = list(deterministic_findings)

        # 3. Optional AI-Assisted Review (if configured)
        ai_response = self.ai_review_service.review(content, retrieved_sources)
        if ai_response:
            ai_findings = self.ai_review_service.convert_ai_findings_to_findings(ai_response)
            all_findings.extend(ai_findings)

        # 4. Determine review state
        initial_state = ReviewState.NEEDS_REVISION if all_findings else ReviewState.DRAFT

        # 5. Build ContentDraft
        existing = self.db.get_draft(final_draft_id) if draft_id else None
        version = (existing.version + 1) if existing else 1

        draft = ContentDraft(
            id=final_draft_id,
            title=title,
            content=content,
            product_id=product_id,
            author=author,
            current_state=initial_state,
            findings=all_findings,
            version=version,
            created_at=existing.created_at if existing else datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        # 6. Persist to SQLite
        if save_to_db:
            self.db.save_draft(draft)

        # 7. Add ContentDraft & Findings to local Knowledge Graph
        try:
            self.graph_store.add_node(
                draft.id,
                NodeType.CONTENT_DRAFT,
                f"Draft: {draft.title[:20]}",
                {"author": draft.author, "current_state": draft.current_state.value},
            )
            for f in draft.findings:
                self.graph_store.add_node(
                    f.id,
                    NodeType.FINDING,
                    f"Finding: {f.category.value}",
                    {
                        "category": f.category.value,
                        "matched_text": f.matched_text,
                        "severity": f.severity.value,
                    },
                )
                self.graph_store.add_edge(f.id, draft.id, EdgeType.APPLIES_TO)
                if f.rule_id and self.graph_store.graph.has_node(f.rule_id):
                    self.graph_store.add_edge(f.id, f.rule_id, EdgeType.TRIGGERED_BY)
                if f.evidence_source_id and self.graph_store.graph.has_node(f.evidence_source_id):
                    self.graph_store.add_edge(f.id, f.evidence_source_id, EdgeType.SUPPORTED_BY)
        except Exception:
            pass

        return draft

    def apply_suggested_rewrite(self, draft_id: str, finding_id: str) -> Optional[ContentDraft]:
        draft = self.db.get_draft(draft_id)
        if not draft:
            return None

        for f in draft.findings:
            if f.id == finding_id and f.suggested_rewrite:
                pattern = re.escape(f.matched_text)
                draft.content = re.sub(pattern, f.suggested_rewrite, draft.content, count=1, flags=re.IGNORECASE)
                f.dismissed = True
                f.dismissed_reason = f"Applied suggested correction: '{f.suggested_rewrite}'"
                draft.version += 1
                draft.updated_at = datetime.now(timezone.utc)
                self.db.save_draft(draft)
                return draft
        return draft

    def dismiss_finding(self, draft_id: str, finding_id: str, reason: str = "Dismissed by reviewer") -> Optional[ContentDraft]:
        draft = self.db.get_draft(draft_id)
        if not draft:
            return None

        for f in draft.findings:
            if f.id == finding_id:
                f.dismissed = True
                f.dismissed_reason = reason
                self.db.save_draft(draft)
                return draft
        return draft

    def update_review_status(
        self,
        draft_id: str,
        new_state: ReviewState,
        reviewer: str,
        notes: str = "",
    ) -> bool:
        return self.db.update_draft_state(draft_id, new_state, reviewer, notes)
