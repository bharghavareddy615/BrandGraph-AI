"""Retrieval module for BrandGraph AI: Evidence chunking & keyword search."""

import math
import re
from typing import Any, Dict, List, Optional, Tuple

from backend.schemas import EvidenceSource, SearchResult, EvidenceStatus
from backend.sample_data import get_sample_evidence_sources
from backend.graph_store import BrandGraphStore


class DocumentChunk:
    def __init__(
        self,
        chunk_id: str,
        source_id: str,
        source_title: str,
        text: str,
        provenance: str,
        section: str = "General",
        metadata: Dict[str, Any] = None,
    ):
        self.chunk_id = chunk_id
        self.source_id = source_id
        self.source_title = source_title
        self.text = text
        self.provenance = provenance
        self.section = section
        self.metadata = metadata or {}


class EvidenceRetriever:
    """Chunks approved sources and provides grounded retrieval."""

    def __init__(self, graph_store: Optional[BrandGraphStore] = None):
        self.graph_store = graph_store
        self.chunks: List[DocumentChunk] = []
        self._stopwords = {
            "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "with",
            "is", "are", "was", "were", "it", "this", "that", "of", "by", "from",
            "our", "your", "their", "we", "you", "all", "can", "will", "be", "as",
            "inkloom", "platform", "software", "system"
        }
        self._ingest_sample_sources()

    def _ingest_sample_sources(self):
        sources = get_sample_evidence_sources()
        self.chunks = []
        for src in sources:
            cleaned = re.sub(r"\s+", " ", src.excerpt).strip()
            self.chunks.append(
                DocumentChunk(
                    chunk_id=f"{src.id}-chunk-1",
                    source_id=src.id,
                    source_title=src.title,
                    text=cleaned,
                    provenance=src.provenance,
                    section=src.metadata.get("section", "Findings"),
                    metadata=src.metadata,
                )
            )

    def _tokenize(self, text: str) -> List[str]:
        tokens = re.findall(r"\b[a-zA-Z0-9_\-\.]{2,}\b", text.lower())
        return [t for t in tokens if t not in self._stopwords]

    def search(
        self,
        query: str,
        top_k: int = 3,
        min_score: float = 0.20,
    ) -> List[SearchResult]:
        query_tokens = self._tokenize(query)
        if not query_tokens:
            return []

        results: List[Tuple[float, DocumentChunk]] = []
        doc_count = max(len(self.chunks), 1)
        chunk_token_sets = [set(self._tokenize(c.text)) for c in self.chunks]

        token_weights = {}
        for token in set(query_tokens):
            match_docs = sum(1 for cts in chunk_token_sets if token in cts)
            token_weights[token] = math.log(1.0 + (doc_count - match_docs + 0.5) / (match_docs + 0.5))

        query_lower = query.lower().strip()
        for idx, chunk in enumerate(self.chunks):
            cts = chunk_token_sets[idx]
            overlap = [t for t in query_tokens if t in cts]
            if not overlap:
                continue

            score = sum(token_weights.get(t, 1.0) for t in overlap)
            if query_lower in chunk.text.lower():
                score += 2.0
            elif len(overlap) >= 3:
                score += 1.0

            normalized = min(round(score / (len(query_tokens) + 1.0), 3), 1.0)
            if normalized >= min_score:
                results.append((normalized, chunk))

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

    def retrieve_with_context(self, query: str, top_k: int = 3) -> Dict[str, Any]:
        results = self.search(query, top_k=top_k)
        linked_claims = []

        if self.graph_store:
            seen_sources = {r.source_id for r in results}
            for src_id in seen_sources:
                for _, target, edge_data in self.graph_store.graph.out_edges(src_id, data=True):
                    if edge_data.get("edge_type") == "SUPPORTS":
                        linked_claims.append(self.graph_store.graph.nodes[target])

        status = EvidenceStatus.SUPPORTED if results else EvidenceStatus.NEEDS_VERIFICATION
        return {
            "query": query,
            "evidence_status": status,
            "results": results,
            "linked_claims": linked_claims,
        }
