"""NetworkX Knowledge Graph store implementation for BrandGraph AI."""

from typing import Any, Dict, List, Optional
import networkx as nx

from backend.schemas import (
    NodeType,
    EdgeType,
    RuleStatus,
)
from backend.sample_data import get_all_sample_data


class BrandGraphStore:
    """Manages the in-memory directed knowledge graph using NetworkX."""

    def __init__(self):
        self.graph = nx.MultiDiGraph()
        self.load_sample_knowledge_base()

    def clear(self):
        self.graph.clear()

    def add_node(
        self,
        node_id: str,
        node_type: NodeType,
        label: str,
        properties: Optional[Dict[str, Any]] = None,
    ):
        props = properties.copy() if properties else {}
        props["node_type"] = node_type.value if isinstance(node_type, NodeType) else node_type
        props["label"] = label
        props["id"] = node_id
        self.graph.add_node(node_id, **props)

    def add_edge(
        self,
        source_id: str,
        target_id: str,
        edge_type: EdgeType,
        properties: Optional[Dict[str, Any]] = None,
    ):
        if not self.graph.has_node(source_id):
            raise ValueError(f"Source node '{source_id}' does not exist in graph.")
        if not self.graph.has_node(target_id):
            raise ValueError(f"Target node '{target_id}' does not exist in graph.")

        props = properties.copy() if properties else {}
        props["edge_type"] = edge_type.value if isinstance(edge_type, EdgeType) else edge_type
        self.graph.add_edge(source_id, target_id, key=props["edge_type"], **props)

    def load_sample_knowledge_base(self):
        self.clear()
        data = get_all_sample_data()

        # 1. Brands
        for b in data["brand"]:
            self.add_node(b.id, NodeType.BRAND, b.name, {
                "description": b.description,
                "voice_and_tone": b.voice_and_tone,
            })

        # 2. Products
        for p in data["products"]:
            self.add_node(p.id, NodeType.PRODUCT, p.name, {
                "category": p.category,
                "description": p.description,
                "approved_aliases": p.approved_aliases,
                "unapproved_aliases": p.unapproved_aliases,
            })
            self.add_edge("BRAND-INKLOOM", p.id, EdgeType.APPLIES_TO)

        # 3. Preferred Terms
        for pt in data["preferred_terms"]:
            self.add_node(pt.id, NodeType.PREFERRED_TERM, pt.term, {
                "preferred_for": pt.preferred_for,
                "context": pt.context,
            })
            self.add_edge(pt.brand_id, pt.id, EdgeType.HAS_APPROVED_NAME)

        # 4. Prohibited Terms
        for prt in data["prohibited_terms"]:
            self.add_node(prt.id, NodeType.PROHIBITED_TERM, prt.term, {
                "reason": prt.reason,
                "recommended_alternative": prt.recommended_alternative,
                "severity": prt.severity.value,
            })
            self.add_edge(prt.brand_id, prt.id, EdgeType.PROHIBITS)

        # 5. Disclaimers
        for disc in data["disclaimers"]:
            self.add_node(disc.id, NodeType.DISCLAIMER, disc.name, {
                "required_text": disc.required_text,
                "trigger_keywords": disc.trigger_keywords,
            })

        # 6. Evidence Sources
        for src in data["evidence_sources"]:
            self.add_node(src.id, NodeType.EVIDENCE_SOURCE, src.title, {
                "source_type": src.source_type,
                "publication_date": src.publication_date,
                "excerpt": src.excerpt,
                "provenance": src.provenance,
                "is_synthetic": src.is_synthetic,
            })

        # 7. Claims
        for clm in data["claims"]:
            self.add_node(clm.id, NodeType.CLAIM, clm.statement[:40] + "...", {
                "statement": clm.statement,
                "claim_type": clm.claim_type,
                "allowed_wording": clm.allowed_wording,
                "forbidden_wording": clm.forbidden_wording,
                "status": clm.status.value,
            })
            if clm.evidence_source_id and self.graph.has_node(clm.evidence_source_id):
                self.add_edge(clm.evidence_source_id, clm.id, EdgeType.SUPPORTS)

        # 8. Rules
        for r in data["rules"]:
            self.add_node(r.id, NodeType.RULE, r.title, {
                "description": r.description,
                "category": r.category.value,
                "severity": r.severity.value,
                "status": r.status.value,
                "effective_date": r.effective_date,
                "conflicts_with": r.conflicts_with,
                "superseded_by": r.superseded_by,
            })

            if r.disclaimer_id and self.graph.has_node(r.disclaimer_id):
                self.add_edge(r.id, r.disclaimer_id, EdgeType.REQUIRES)

            if r.applies_to_product_id and self.graph.has_node(r.applies_to_product_id):
                self.add_edge(r.id, r.applies_to_product_id, EdgeType.APPLIES_TO)

            if r.superseded_by and self.graph.has_node(r.superseded_by):
                self.add_edge(r.superseded_by, r.id, EdgeType.SUPERSEDES)

            if r.conflicts_with and self.graph.has_node(r.conflicts_with):
                if not self.graph.has_edge(r.id, r.conflicts_with, key=EdgeType.CONTRADICTS.value):
                    self.add_edge(r.id, r.conflicts_with, EdgeType.CONTRADICTS)

        # Link Rule 1 to prohibited terms
        if self.graph.has_node("RULE-001"):
            for prt in data["prohibited_terms"]:
                if prt.id in ("TERM-PROH-01", "TERM-PROH-02"):
                    self.add_edge("RULE-001", prt.id, EdgeType.PROHIBITS)

    # -------------------------------------------------------------------------
    # Traversal & Queries
    # -------------------------------------------------------------------------

    def get_rules_for_product(self, product_id: str) -> List[Dict[str, Any]]:
        rules = []
        for node_id, data in self.graph.nodes(data=True):
            if data.get("node_type") == NodeType.RULE.value:
                has_product_edge = any(
                    target == product_id and edge_data.get("edge_type") == EdgeType.APPLIES_TO.value
                    for _, target, edge_data in self.graph.out_edges(node_id, data=True)
                )
                if has_product_edge or not data.get("applies_to_product_id"):
                    rules.append(data)
        return rules

    def get_evidence_for_claim(self, claim_id: str) -> List[Dict[str, Any]]:
        sources = []
        for src, _, edge_data in self.graph.in_edges(claim_id, data=True):
            if edge_data.get("edge_type") == EdgeType.SUPPORTS.value:
                sources.append(self.graph.nodes[src])
        return sources

    def get_disclaimers_for_rule(self, rule_id: str) -> List[Dict[str, Any]]:
        disclaimers = []
        for _, dst, edge_data in self.graph.out_edges(rule_id, data=True):
            if edge_data.get("edge_type") == EdgeType.REQUIRES.value:
                disclaimers.append(self.graph.nodes[dst])
        return disclaimers

    def get_conflicting_or_superseded_rules(self) -> Dict[str, List[Dict[str, Any]]]:
        superseded = []
        conflicting = []
        for node_id, data in self.graph.nodes(data=True):
            if data.get("node_type") == NodeType.RULE.value:
                status = data.get("status")
                if status == RuleStatus.SUPERSEDED.value:
                    superseded.append(data)
                elif status == RuleStatus.CONFLICTING.value:
                    conflicting.append(data)
        return {"superseded": superseded, "conflicting": conflicting}

    def get_graph_data(self, product_id: Optional[str] = None) -> Dict[str, Any]:
        """Exports graph nodes and edges with coordinates and colors for frontend visualizer."""
        target_graph = self.graph
        if product_id and product_id != "ALL" and self.graph.has_node(product_id):
            sub_nodes = {product_id, "BRAND-INKLOOM"}
            for neighbor in self.graph.neighbors(product_id):
                sub_nodes.add(neighbor)
                for n2 in self.graph.neighbors(neighbor):
                    sub_nodes.add(n2)
            for pred in self.graph.predecessors(product_id):
                sub_nodes.add(pred)
            target_graph = self.graph.subgraph(sub_nodes)

        # Calculate spring layout positions normalized to a canvas (2D & 3D)
        pos_2d = nx.spring_layout(target_graph, dim=2, seed=42, k=0.9, iterations=50)
        pos_3d = nx.spring_layout(target_graph, dim=3, seed=42, k=0.9, iterations=60)

        color_map = {
            NodeType.BRAND.value: "#8055E8",           # Violet
            NodeType.PRODUCT.value: "#06B6D4",         # Cyan
            NodeType.RULE.value: "#EF4444",            # Red
            NodeType.PREFERRED_TERM.value: "#10B981",  # Emerald
            NodeType.PROHIBITED_TERM.value: "#F59E0B", # Amber
            NodeType.CLAIM.value: "#A855F7",           # Light Purple
            NodeType.EVIDENCE_SOURCE.value: "#3B82F6", # Blue
            NodeType.DISCLAIMER.value: "#EC4899",      # Pink
            NodeType.CONTENT_DRAFT.value: "#94A3B8",   # Slate
            NodeType.FINDING.value: "#F43F5E",         # Rose
            NodeType.REVIEW_DECISION.value: "#14B8A6", # Teal
        }

        nodes = []
        for node_id, d in target_graph.nodes(data=True):
            p2 = pos_2d.get(node_id, (0, 0))
            p3 = pos_3d.get(node_id, (0, 0, 0))
            ntype = d.get("node_type", "Unknown")
            nodes.append({
                "id": node_id,
                "label": d.get("label", node_id),
                "type": ntype,
                "color": color_map.get(ntype, "#64748B"),
                "x": round(float(p2[0]) * 350 + 400, 1),
                "y": round(float(p2[1]) * 250 + 300, 1),
                "x3d": round(float(p3[0]) * 220, 1),
                "y3d": round(float(p3[1]) * 220, 1),
                "z3d": round(float(p3[2]) * 220, 1),
                "properties": {k: v for k, v in d.items() if k not in ("label", "node_type", "id")},
            })

        edges = []
        for u, v, k, d in target_graph.edges(keys=True, data=True):
            edges.append({
                "source": u,
                "target": v,
                "type": d.get("edge_type", k),
            })

        return {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "nodes": nodes,
            "edges": edges,
        }
