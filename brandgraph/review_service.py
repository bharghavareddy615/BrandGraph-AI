"""Core Review Service orchestrating Deterministic Checks, RAG, Graph Traversal, and Persistence."""

from datetime import datetime
from typing import Dict, List, Optional
import re
import uuid

from brandgraph.schemas import (
    ContentDraft,
    Finding,
    FindingCategory,
    ReviewState,
    ReviewComment,
    ReviewDecision,
    EvidenceStatus,
    NodeType,
    EdgeType,
)
from brandgraph.graph_store import BrandGraphStore
from brandgraph.ingestion import SourceIngestionPipeline
from brandgraph.retrieval import EvidenceRetriever
from brandgraph.rule_engine import DeterministicRuleEngine
from brandgraph.ai_review import AIReviewService
from brandgraph.storage import StorageManager


class ReviewService:
    """Coordinates brand governance review workflows."""

    def __init__(
        self,
        graph_store: Optional[BrandGraphStore] = None,
        storage_manager: Optional[StorageManager] = None,
    ):
        self.graph_store = graph_store or BrandGraphStore()
        # Initialize graph with sample data if empty
        if len(self.graph_store.graph.nodes) == 0:
            self.graph_store.load_sample_knowledge_base()

        self.pipeline = SourceIngestionPipeline()
        self.pipeline.load_sample_pipeline()

        self.retriever = EvidenceRetriever(self.pipeline, self.graph_store)
        self.rule_engine = DeterministicRuleEngine(self.graph_store, self.retriever)
        self.ai_review_service = AIReviewService()
        self.storage = storage_manager or StorageManager()

    def review_draft(
        self,
        content: str,
        title: str = "New Content Draft",
        author: str = "Content Creator",
        product_id: Optional[str] = "PROD-COPILOT",
        save_to_db: bool = True,
    ) -> ContentDraft:
        """Runs the full evidence-grounded review pipeline on submitted text."""
        draft_id = f"DRAFT-{uuid.uuid4().hex[:8].upper()}"

        if not content or not content.strip():
            # Empty content handling
            draft = ContentDraft(
                id=draft_id,
                title=title,
                content="",
                product_id=product_id,
                author=author,
                current_state=ReviewState.NEEDS_REVISION,
                findings=[],
            )
            if save_to_db:
                self.storage.save_draft(draft)
            return draft

        # 1. Deterministic Rule Engine checks
        deterministic_findings = self.rule_engine.evaluate(content)

        # 2. RAG Retrieval for evidence grounding
        retrieval_context = self.retriever.retrieve_with_graph_context(content, top_k=3)
        retrieved_sources = retrieval_context["search_results"]

        # Link evidence to claim findings if not already explicitly linked
        for f in deterministic_findings:
            if f.category in (FindingCategory.UNSUPPORTED_CLAIM, FindingCategory.CONTRADICTED_CLAIM):
                if not f.evidence_source_id and retrieved_sources:
                    snippet_matches = self.retriever.search(f.matched_text, top_k=1)
                    if snippet_matches:
                        f.evidence_source_id = snippet_matches[0].source_id
                        f.evidence_excerpt = snippet_matches[0].text

        all_findings = list(deterministic_findings)

        # 3. Optional AI-Assisted Review (if provider enabled)
        ai_response = self.ai_review_service.review(content, retrieved_sources)
        if ai_response:
            ai_findings = self.ai_review_service.convert_ai_findings_to_findings(ai_response)
            all_findings.extend(ai_findings)

        # 4. Determine initial review state
        initial_state = ReviewState.NEEDS_REVISION if all_findings else ReviewState.DRAFT

        # 5. Construct ContentDraft
        draft = ContentDraft(
            id=draft_id,
            title=title,
            content=content,
            product_id=product_id,
            author=author,
            current_state=initial_state,
            findings=all_findings,
            version=1,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        # 6. Persist in SQLite
        if save_to_db:
            self.storage.save_draft(draft)

        # 7. Add ContentDraft & Findings to local Knowledge Graph
        try:
            self.graph_store.add_node(
                node_id=draft.id,
                node_type=NodeType.CONTENT_DRAFT,
                label=f"Draft: {draft.title[:20]}",
                properties={"author": draft.author, "current_state": draft.current_state.value},
            )
            for f in draft.findings:
                self.graph_store.add_node(
                    node_id=f.id,
                    node_type=NodeType.FINDING,
                    label=f"Finding: {f.category.value}",
                    properties={
                        "category": f.category.value,
                        "matched_text": f.matched_text,
                        "severity": f.severity.value,
                    },
                )
                # Edge: Finding APPLIES_TO ContentDraft
                self.graph_store.add_edge(f.id, draft.id, EdgeType.APPLIES_TO)

                # Edge: Finding TRIGGERED_BY Rule
                if f.rule_id and self.graph_store.graph.has_node(f.rule_id):
                    self.graph_store.add_edge(f.id, f.rule_id, EdgeType.TRIGGERED_BY)

                # Edge: Finding SUPPORTED_BY EvidenceSource
                if f.evidence_source_id and self.graph_store.graph.has_node(f.evidence_source_id):
                    self.graph_store.add_edge(f.id, f.evidence_source_id, EdgeType.SUPPORTED_BY)
        except Exception:
            # Graph additions are non-blocking
            pass

        return draft

    def apply_suggested_rewrite(self, draft_id: str, finding_id: str) -> Optional[ContentDraft]:
        """Applies a suggested rewrite for a finding and updates the draft."""
        draft = self.storage.get_draft(draft_id)
        if not draft:
            return None

        for f in draft.findings:
            if f.id == finding_id and f.suggested_rewrite:
                # Replace matched text in content
                pattern = re.escape(f.matched_text)
                draft.content = re.sub(pattern, f.suggested_rewrite, draft.content, count=1, flags=re.IGNORECASE)
                f.dismissed = True
                f.dismissed_reason = f"Applied suggested rewrite: '{f.suggested_rewrite}'"
                draft.version += 1
                draft.updated_at = datetime.utcnow()
                self.storage.save_draft(draft)
                return draft
        return draft

    def dismiss_finding(self, draft_id: str, finding_id: str, reason: str = "Dismissed by reviewer") -> Optional[ContentDraft]:
        """Marks a finding as dismissed without modifying draft text."""
        draft = self.storage.get_draft(draft_id)
        if not draft:
            return None

        for f in draft.findings:
            if f.id == finding_id:
                f.dismissed = True
                f.dismissed_reason = reason
                self.storage.save_draft(draft)
                return draft
        return draft

    def update_review_status(
        self,
        draft_id: str,
        new_state: ReviewState,
        reviewer: str,
        notes: str = "",
    ) -> bool:
        """Transitions a draft review status with audit logging."""
        return self.storage.update_draft_state(draft_id, new_state, reviewer, notes)
