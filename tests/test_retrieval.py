"""Unit tests for the Retrieval and Evidence Grounding Module."""

import pytest
from backend.retrieval import EvidenceRetriever
from backend.graph_store import BrandGraphStore
from backend.schemas import EvidenceStatus


@pytest.fixture
def retriever():
    graph_store = BrandGraphStore()
    return EvidenceRetriever(graph_store=graph_store)


def test_retrieval_grounded_source(retriever):
    results = retriever.search("under 45ms latency benchmark report", top_k=2)
    assert len(results) > 0
    assert results[0].source_id == "SRC-001"
    assert "45ms" in results[0].text
    assert results[0].score > 0.0


def test_retrieval_security_audit(retriever):
    results = retriever.search("TLS 1.3 AES-256 encryption at rest", top_k=1)
    assert len(results) == 1
    assert results[0].source_id == "SRC-003"
    assert "SOC2" in results[0].source_title


def test_unsupported_claim_needs_verification(retriever):
    # Factual claim not in approved sources
    res = retriever.retrieve_with_context("Inkloom increases user memory retention by 89% in brain scans.")
    assert res["evidence_status"] == EvidenceStatus.NEEDS_VERIFICATION
    assert len(res["results"]) == 0


def test_empty_query_handling(retriever):
    assert retriever.search("") == []
    assert retriever.search("   ") == []
