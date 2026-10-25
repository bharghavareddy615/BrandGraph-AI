"""Knowledge Graph store implementation using NetworkX for BrandGraph AI."""

from typing import Any, Dict, List, Optional, Set, Tuple
import networkx as nx
# pyrefly: ignore[missing-import]
import plotly.graph_objects as go

from brandgraph.schemas import (
    NodeType,
    EdgeType,
    RuleStatus,
    EvidenceStatus,
)
from brandgraph.sample_data import get_all_sample_data


class BrandGraphStore:
    """Manages the in-memory directed knowledge graph using NetworkX."""

    def __init__(self):
        self.graph = nx.MultiDiGraph()

    def clear(self):
        """Clears all nodes and edges."""
        self.graph.clear()

    def add_node(
        self,
        node_id: str,
        node_type: NodeType,
        label: str,
        properties: Optional[Dict[str, Any]] = None,
    ):
        """Adds or updates a node in the graph."""
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
        """Adds a directed edge between two existing nodes."""
        if not self.graph.has_node(source_id):
            raise ValueError(f"Source node '{source_id}' does not exist in graph.")
        if not self.graph.has_node(target_id):
            raise ValueError(f"Target node '{target_id}' does not exist in graph.")

        props = properties.copy() if properties else {}
        props["edge_type"] = edge_type.value if isinstance(edge_type, EdgeType) else edge_type
        self.graph.add_edge(source_id, target_id, key=props["edge_type"], **props)

    def load_sample_knowledge_base(self):
        """Builds the complete knowledge graph from the curated sample data."""
        self.clear()
        data = get_all_sample_data()

        # 1. Add Brands
        for b in data["brand"]:
            self.add_node(
                node_id=b.id,
                node_type=NodeType.BRAND,
                label=b.name,
                properties={"description": b.description, "voice_and_tone": b.voice_and_tone},
            )

        # 2. Add Products
        for p in data["products"]:
            self.add_node(
                node_id=p.id,
                node_type=NodeType.PRODUCT,
                label=p.name,
                properties={
                    "category": p.category,
                    "description": p.description,
                    "approved_aliases": p.approved_aliases,
                    "unapproved_aliases": p.unapproved_aliases,
                },
            )
            # Edge: Brand APPLIES_TO Product
            self.add_edge(b.id, p.id, EdgeType.APPLIES_TO)

        # 3. Add Preferred Terms
        for pt in data["preferred_terms"]:
            self.add_node(
                node_id=pt.id,
                node_type=NodeType.PREFERRED_TERM,
                label=pt.term,
                properties={"preferred_for": pt.preferred_for, "context": pt.context},
            )
            # Edge: Brand HAS_APPROVED_NAME PreferredTerm
            self.add_edge(pt.brand_id, pt.id, EdgeType.HAS_APPROVED_NAME)

        # 4. Add Prohibited Terms
        for prt in data["prohibited_terms"]:
            self.add_node(
                node_id=prt.id,
                node_type=NodeType.PROHIBITED_TERM,
                label=prt.term,
                properties={
                    "reason": prt.reason,
                    "recommended_alternative": prt.recommended_alternative,
                    "severity": prt.severity.value,
                },
            )
            # Edge: Brand PROHIBITS ProhibitedTerm
            self.add_edge(prt.brand_id, prt.id, EdgeType.PROHIBITS)

        # 5. Add Disclaimers
        for disc in data["disclaimers"]:
            self.add_node(
                node_id=disc.id,
                node_type=NodeType.DISCLAIMER,
                label=disc.name,
                properties={
                    "required_text": disc.required_text,
                    "trigger_keywords": disc.trigger_keywords,
                },
            )

        # 6. Add Evidence Sources
        for src in data["evidence_sources"]:
            self.add_node(
                node_id=src.id,
                node_type=NodeType.EVIDENCE_SOURCE,
                label=src.title,
                properties={
                    "source_type": src.source_type,
                    "publication_date": src.publication_date,
                    "excerpt": src.excerpt,
                    "provenance": src.provenance,
                    "is_synthetic": src.is_synthetic,
                    "metadata": src.metadata,
                },
            )

        # 7. Add Claims
        for clm in data["claims"]:
            self.add_node(
                node_id=clm.id,
                node_type=NodeType.CLAIM,
                label=clm.statement[:40] + ("..." if len(clm.statement) > 40 else ""),
                properties={
                    "statement": clm.statement,
                    "claim_type": clm.claim_type,
                    "allowed_wording": clm.allowed_wording,
                    "forbidden_wording": clm.forbidden_wording,
                    "status": clm.status.value,
                },
            )
            if clm.evidence_source_id and self.graph.has_node(clm.evidence_source_id):
                self.add_edge(clm.evidence_source_id, clm.id, EdgeType.SUPPORTS)

        # 8. Add Rules
        for r in data["rules"]:
            self.add_node(
                node_id=r.id,
                node_type=NodeType.RULE,
                label=r.title,
                properties={
                    "description": r.description,
                    "category": r.category.value,
                    "severity": r.severity.value,
                    "status": r.status.value,
                    "effective_date": r.effective_date,
                    "conflicts_with": r.conflicts_with,
                    "superseded_by": r.superseded_by,
                },
            )

            # Rule -> Disclaimer (REQUIRES)
            if r.disclaimer_id and self.graph.has_node(r.disclaimer_id):
                self.add_edge(r.id, r.disclaimer_id, EdgeType.REQUIRES)

            # Rule -> Product (APPLIES_TO)
            if r.applies_to_product_id and self.graph.has_node(r.applies_to_product_id):
                self.add_edge(r.id, r.applies_to_product_id, EdgeType.APPLIES_TO)

            # Rule -> Rule (SUPERSEDES)
            if r.superseded_by and self.graph.has_node(r.superseded_by):
                self.add_edge(r.superseded_by, r.id, EdgeType.SUPERSEDES)

            # Rule -> Rule (CONTRADICTS) for conflicting rules
            if r.conflicts_with and self.graph.has_node(r.conflicts_with):
                if not self.graph.has_edge(r.id, r.conflicts_with, key=EdgeType.CONTRADICTS.value):
                    self.add_edge(r.id, r.conflicts_with, EdgeType.CONTRADICTS)

        # Connect Rules to Prohibited Terms
        if self.graph.has_node("RULE-001"):
            for prt in data["prohibited_terms"]:
                if prt.id in ("TERM-PROH-01", "TERM-PROH-02"):
                    self.add_edge("RULE-001", prt.id, EdgeType.PROHIBITS)

        # Connect Rule-002 to Copilot approved/unapproved names
        if self.graph.has_node("RULE-002") and self.graph.has_node("PROD-COPILOT"):
            self.add_edge("RULE-002", "PROD-COPILOT", EdgeType.APPLIES_TO)

    # -------------------------------------------------------------------------
    # Graph Traversal & Query Methods
    # -------------------------------------------------------------------------

    def get_rules_for_product(self, product_id: str) -> List[Dict[str, Any]]:
        """Finds all rules applicable to a specific product or globally."""
        rules = []
        for node_id, data in self.graph.nodes(data=True):
            if data.get("node_type") == NodeType.RULE.value:
                # Check direct APPLIES_TO edge or global
                has_product_edge = False
                for _, target, edge_data in self.graph.out_edges(node_id, data=True):
                    if target == product_id and edge_data.get("edge_type") == EdgeType.APPLIES_TO.value:
                        has_product_edge = True
                        break
                if has_product_edge or not data.get("applies_to_product_id"):
                    rules.append(data)
        return rules

    def get_evidence_for_claim(self, claim_id: str) -> List[Dict[str, Any]]:
        """Returns all evidence sources connected to a claim."""
        sources = []
        for src, dst, edge_data in self.graph.in_edges(claim_id, data=True):
            if edge_data.get("edge_type") == EdgeType.SUPPORTS.value:
                src_data = self.graph.nodes[src]
                if src_data.get("node_type") == NodeType.EVIDENCE_SOURCE.value:
                    sources.append(src_data)
        return sources

    def get_disclaimers_for_rule(self, rule_id: str) -> List[Dict[str, Any]]:
        """Returns disclaimers required by a rule."""
        disclaimers = []
        for _, dst, edge_data in self.graph.out_edges(rule_id, data=True):
            if edge_data.get("edge_type") == EdgeType.REQUIRES.value:
                dst_data = self.graph.nodes[dst]
                if dst_data.get("node_type") == NodeType.DISCLAIMER.value:
                    disclaimers.append(dst_data)
        return disclaimers

    def get_conflicting_or_superseded_rules(self) -> Dict[str, List[Dict[str, Any]]]:
        """Identifies conflicting or superseded rules for governance audit."""
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

    def get_finding_lineage(self, finding_id: str) -> Dict[str, Any]:
        """Traces the graph relationships behind a specific finding."""
        if not self.graph.has_node(finding_id):
            return {"finding_id": finding_id, "found": False, "relationships": []}

        relationships = []
        for src, dst, data in self.graph.in_edges(finding_id, data=True):
            relationships.append({
                "from": src,
                "to": dst,
                "type": data.get("edge_type"),
                "direction": "incoming",
            })
        for src, dst, data in self.graph.out_edges(finding_id, data=True):
            relationships.append({
                "from": src,
                "to": dst,
                "type": data.get("edge_type"),
                "direction": "outgoing",
            })
        return {
            "finding_id": finding_id,
            "found": True,
            "node_data": self.graph.nodes[finding_id],
            "relationships": relationships,
        }

    # -------------------------------------------------------------------------
    # Visualization Exporter (Plotly Network Graph)
    # -------------------------------------------------------------------------

    def create_plotly_visualization(
        self,
        filter_types: Optional[List[str]] = None,
        highlight_node_id: Optional[str] = None,
    ) -> go.Figure:
        """Renders an interactive, aesthetic 2D network diagram using Plotly."""
        # Subgraph if filtered
        if filter_types:
            nodes_to_keep = [
                n for n, d in self.graph.nodes(data=True)
                if d.get("node_type") in filter_types
            ]
            subg = self.graph.subgraph(nodes_to_keep)
        else:
            subg = self.graph

        if len(subg.nodes) == 0:
            fig = go.Figure()
            fig.update_layout(title="No nodes match current filter.")
            return fig

        # Spring layout computation
        pos = nx.spring_layout(subg, seed=42, k=0.8, iterations=60)

        # Distinct modern color palette for entity types
        color_map = {
            NodeType.BRAND.value: "#8055E8",           # Violet
            NodeType.PRODUCT.value: "#06B6D4",         # Cyan
            NodeType.RULE.value: "#EF4444",            # Red
            NodeType.PREFERRED_TERM.value: "#10B981",  # Emerald
            NodeType.PROHIBITED_TERM.value: "#F59E0B", # Amber
            NodeType.CLAIM.value: "#8B5CF6",           # Purple
            NodeType.EVIDENCE_SOURCE.value: "#3B82F6", # Blue
            NodeType.DISCLAIMER.value: "#EC4899",      # Pink
            NodeType.CONTENT_DRAFT.value: "#64748B",   # Slate
            NodeType.FINDING.value: "#DC2626",         # Dark Red
            NodeType.REVIEW_DECISION.value: "#14B8A6", # Teal
        }

        # Edges traces
        edge_x = []
        edge_y = []
        edge_text = []

        for u, v, data in subg.edges(data=True):
            if u in pos and v in pos:
                x0, y0 = pos[u]
                x1, y1 = pos[v]
                edge_x.extend([x0, x1, None])
                edge_y.extend([y0, y1, None])
                edge_text.append(data.get("edge_type", ""))

        edge_trace = go.Scatter(
            x=edge_x,
            y=edge_y,
            line=dict(width=1.2, color="#94A3B8"),
            hoverinfo="none",
            mode="lines",
        )

        # Nodes trace
        node_x = []
        node_y = []
        node_text = []
        node_colors = []
        node_sizes = []
        node_symbols = []

        for node in subg.nodes():
            x, y = pos[node]
            node_x.append(x)
            node_y.append(y)
            d = subg.nodes[node]
            ntype = d.get("node_type", "Unknown")
            label = d.get("label", node)
            color = color_map.get(ntype, "#64748B")
            size = 22

            if highlight_node_id and node == highlight_node_id:
                size = 34
                color = "#FACC15"  # Bright yellow highlight

            # Hover text
            hover = f"<b>{label}</b><br>ID: {node}<br>Type: {ntype}"
            if "description" in d:
                hover += f"<br>Desc: {d['description'][:80]}..."
            elif "excerpt" in d:
                hover += f"<br>Excerpt: {d['excerpt'][:80]}..."
            elif "statement" in d:
                hover += f"<br>Statement: {d['statement'][:80]}..."

            node_text.append(hover)
            node_colors.append(color)
            node_sizes.append(size)

        node_trace = go.Scatter(
            x=node_x,
            y=node_y,
            mode="markers+text",
            hoverinfo="text",
            text=[subg.nodes[n].get("label", n)[:16] for n in subg.nodes()],
            textposition="top center",
            textfont=dict(size=10, color="#1E293B"),
            marker=dict(
                color=node_colors,
                size=node_sizes,
                line=dict(width=2, color="#FFFFFF"),
            ),
            hovertext=node_text,
        )

        fig = go.Figure(
            data=[edge_trace, node_trace],
            layout=go.Layout(
                title=dict(
                    text="<b>BrandGraph Knowledge Graph Explorer</b>",
                    font=dict(size=16, color="#0F172A"),
                ),
                showlegend=False,
                hovermode="closest",
                margin=dict(b=20, l=20, r=20, t=50),
                xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                plot_bgcolor="#F8FAFC",
                paper_bgcolor="#FFFFFF",
                height=520,
            ),
        )
        return fig
