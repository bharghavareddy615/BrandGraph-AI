"""Unit tests for the NetworkX Knowledge Graph Store."""

import pytest
from backend.graph_store import BrandGraphStore
from backend.schemas import NodeType, EdgeType


@pytest.fixture
def graph_store():
    return BrandGraphStore()


def test_graph_initialization(graph_store):
    assert len(graph_store.graph.nodes) > 0
    assert len(graph_store.graph.edges) > 0
    assert graph_store.graph.has_node("BRAND-INKLOOM")
    assert graph_store.graph.has_node("PROD-COPILOT")
    assert graph_store.graph.has_node("RULE-001")


def test_rules_for_product(graph_store):
    rules = graph_store.get_rules_for_product("PROD-COPILOT")
    assert len(rules) > 0
    rule_ids = [r["id"] for r in rules]
    assert "RULE-002" in rule_ids


def test_evidence_for_claim(graph_store):
    sources = graph_store.get_evidence_for_claim("CLM-001")
    assert len(sources) > 0
    assert sources[0]["id"] == "SRC-001"


def test_conflicting_and_superseded_rules(graph_store):
    res = graph_store.get_conflicting_or_superseded_rules()
    superseded_ids = [r["id"] for r in res["superseded"]]
    conflicting_ids = [r["id"] for r in res["conflicting"]]

    assert "RULE-006" in superseded_ids
    assert "RULE-007" in conflicting_ids
    assert "RULE-008" in conflicting_ids


def test_graph_export_for_visualizer(graph_store):
    data = graph_store.get_graph_data()
    assert "nodes" in data
    assert "edges" in data
    assert data["node_count"] == len(graph_store.graph.nodes)
    assert data["edge_count"] == len(graph_store.graph.edges)

    # Verify nodes have coordinate and color attributes
    first_node = data["nodes"][0]
    assert "x" in first_node
    assert "y" in first_node
    assert "color" in first_node
