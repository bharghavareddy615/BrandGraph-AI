"""Ingestion module for loading, chunking, and indexing approved brand sources."""

from typing import Any, Dict, List
import re
from brandgraph.schemas import EvidenceSource, SearchResult
from brandgraph.sample_data import get_sample_evidence_sources


class DocumentChunk:
    """Represents a chunked passage from an approved evidence source."""

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


class SourceIngestionPipeline:
    """Chunks and indexes evidence sources with provenance metadata."""

    def __init__(self, max_chunk_chars: int = 250, chunk_overlap_chars: int = 40):
        self.max_chunk_chars = max_chunk_chars
        self.chunk_overlap_chars = chunk_overlap_chars
        self.chunks: List[DocumentChunk] = []

    def chunk_text(self, text: str, source: EvidenceSource) -> List[DocumentChunk]:
        """Splits long text into overlapping chunks, preserving sentence boundaries where possible."""
        cleaned = re.sub(r"\s+", " ", text).strip()
        if len(cleaned) <= self.max_chunk_chars:
            return [
                DocumentChunk(
                    chunk_id=f"{source.id}-chunk-1",
                    source_id=source.id,
                    source_title=source.title,
                    text=cleaned,
                    provenance=source.provenance,
                    section=source.metadata.get("section", "Main Findings"),
                    metadata=source.metadata,
                )
            ]

        # Sentence-aware chunking
        sentences = re.split(r"(?<=[.!?]) +", cleaned)
        chunks = []
        current_chunk = []
        current_length = 0
        chunk_idx = 1

        for sentence in sentences:
            if current_length + len(sentence) > self.max_chunk_chars and current_chunk:
                chunk_str = " ".join(current_chunk)
                chunks.append(
                    DocumentChunk(
                        chunk_id=f"{source.id}-chunk-{chunk_idx}",
                        source_id=source.id,
                        source_title=source.title,
                        text=chunk_str,
                        provenance=source.provenance,
                        section=source.metadata.get("section", f"Section {chunk_idx}"),
                        metadata=source.metadata,
                    )
                )
                chunk_idx += 1
                # Retain overlap if possible
                current_chunk = [sentence]
                current_length = len(sentence)
            else:
                current_chunk.append(sentence)
                current_length += len(sentence) + 1

        if current_chunk:
            chunks.append(
                DocumentChunk(
                    chunk_id=f"{source.id}-chunk-{chunk_idx}",
                    source_id=source.id,
                    source_title=source.title,
                    text=" ".join(current_chunk),
                    provenance=source.provenance,
                    section=source.metadata.get("section", f"Section {chunk_idx}"),
                    metadata=source.metadata,
                )
            )

        return chunks

    def ingest_sources(self, sources: List[EvidenceSource]) -> List[DocumentChunk]:
        """Ingests a list of EvidenceSource objects and creates indexed chunks."""
        self.chunks = []
        for src in sources:
            src_chunks = self.chunk_text(src.excerpt, src)
            self.chunks.extend(src_chunks)
        return self.chunks

    def load_sample_pipeline(self) -> List[DocumentChunk]:
        """Loads and indexes all sample approved evidence sources."""
        sources = get_sample_evidence_sources()
        return self.ingest_sources(sources)
