"""Retrieval module for BrandGraph AI: Keyword search & Graph-linked evidence."""

import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from brandgraph.schemas import (
    SearchResult,
    EvidenceStatus,
)
from brandgraph.ingestion import DocumentChunk, SourceIngestionPipeline
from brandgraph.graph_store import BrandGraphStore


class EvidenceRetriever:
    """Performs deterministic keyword and token-overlap retrieval on indexed source chunks."""

    def __init__(self, ingestion_pipeline: SourceIngestionPipeline, graph_store: Optional[BrandGraphStore] = None):
        self.pipeline = ingestion_pipeline
        self.graph_store = graph_store
        self._stopwords = {
            "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "with",
            "is", "are", "was", "were", "it", "this", "that", "of", "by", "from",
            "our", "your", "their", "we", "you", "all", "can", "will", "be", "as"
        }

    def _tokenize(self, text: str) -> List[str]:
        """Extracts lowercase alphanumeric tokens, filtering short words and stopwords."""
        tokens = re.findall(r"\b[a-zA-Z0-9_\-\.]{2,}\b", text.lower())
        return [t for t in tokens if t not in self._stopwords]

    def search(
        self,
        query: str,
        top_k: int = 3,
        min_score: float = 0.15,
    ) -> List[SearchResult]:
        """Searches indexed source chunks using token overlap and term weighting."""
        query_tokens = self._tokenize(query)
        if not query_tokens:
            return []

        results: List[Tuple[float, DocumentChunk]] = []
        chunks = self.pipeline.chunks

        # Calculate IDF-like frequency across chunks
        chunk_token_sets = [set(self._tokenize(c.text)) for c in chunks]
        doc_count = max(len(chunks), 1)

        token_weights = {}
        for token in set(query_tokens):
            match_docs = sum(1 for cts in chunk_token_sets if token in cts)
            # Standard smoothed IDF
            token_weights[token] = math.log(1.0 + (doc_count - match_docs + 0.5) / (match_docs + 0.5))

        for idx, chunk in enumerate(chunks):
            cts = chunk_token_sets[idx]
            overlap = [t for t in query_tokens if t in cts]
            if not overlap:
                continue

            # Base score from weighted token match
            weighted_score = sum(token_weights.get(t, 1.0) for t in overlap)

            # Bonus for exact sequence or multi-token match
            raw_text_lower = chunk.text.lower()
            query_lower = query.lower().strip()

            if query_lower in raw_text_lower:
                weighted_score += 2.0
            elif len(overlap) >= 3:
                weighted_score += 1.0

            normalized_score = min(round(weighted_score / (len(query_tokens) + 1.0), 3), 1.0)

            if normalized_score >= min_score:
                results.append((normalized_score, chunk))

        # Sort by score descending
        results.sort(key=lambda x: x[0], reverse=True)

        return [
            SearchResult(
                source_id=chunk.source_id,
                source_title=chunk.source_title,
                chunk_id=chunk.chunk_id,
                score=score,
                text=chunk.text,
                provenance=chunk.provenance,
                section=chunk.section,
            )
            for score, chunk in results[:top_k]
        ]

    def retrieve_with_graph_context(
        self,
        query: str,
        top_k: int = 3,
    ) -> Dict[str, Any]:
        """Retrieves source chunks and follows graph edges to fetch linked claims, rules, and disclaimers."""
        search_results = self.search(query, top_k=top_k)
        linked_claims = []
        linked_rules = []
        linked_disclaimers = []

        if self.graph_store:
            seen_sources = {r.source_id for r in search_results}
            for src_id in seen_sources:
                # Find claims supported by this source
                for _, target, edge_data in self.graph_store.graph.out_edges(src_id, data=True):
                    if edge_data.get("edge_type") == "SUPPORTS":
                        node_data = self.graph_store.graph.nodes[target]
                        linked_claims.append(node_data)

            # Check if query matches any disclaimer triggers
            for node_id, data in self.graph_store.graph.nodes(data=True):
                if data.get("node_type") == "Disclaimer":
                    keywords = data.get("trigger_keywords", [])
                    if any(kw in query.lower() for kw in keywords):
                        linked_disclaimers.append(data)

        # If no sources found above threshold, flag as Needs verification
        evidence_status = EvidenceStatus.SUPPORTED if search_results else EvidenceStatus.NEEDS_VERIFICATION

        return {
            "query": query,
            "evidence_status": evidence_status,
            "search_results": search_results,
            "linked_claims": linked_claims,
            "linked_rules": linked_rules,
            "linked_disclaimers": linked_disclaimers,
        }
