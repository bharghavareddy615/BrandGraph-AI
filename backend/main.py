"""FastAPI backend application for BrandGraph AI."""

from contextlib import asynccontextmanager
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.schemas import (
    ReviewRequest,
    CreateDraftRequest,
    AddCommentRequest,
    UpdateStatusRequest,
    ApplyRewriteRequest,
    DismissFindingRequest,
    ReviewComment,
    ReviewState,
)
from backend.sample_data import get_all_sample_data
from backend.graph_store import BrandGraphStore
from backend.database import DatabaseManager
from backend.review_service import ReviewService
from backend.evaluation import EvaluationRunner
from backend.ai_review import AIReviewService

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

# Global Singletons
db_manager = DatabaseManager()
graph_store = BrandGraphStore()
review_service = ReviewService(graph_store=graph_store, db_manager=db_manager)
eval_runner = EvaluationRunner(review_service=review_service, db_manager=db_manager)
ai_service = AIReviewService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run initial synthetic evaluation if none exists
    latest = db_manager.get_latest_evaluation_run()
    if not latest:
        eval_runner.run_suite()
    yield


app = FastAPI(
    title="BrandGraph AI — Evidence-Linked Brand Governance",
    description="Explainable brand intelligence and governance platform.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for open local API communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# REST API Endpoints
# -----------------------------------------------------------------------------

@app.get("/api/health", tags=["System"])
def get_health() -> Dict[str, Any]:
    """Health check endpoint confirming backend and graph readiness."""
    return {
        "status": "healthy",
        "service": "BrandGraph AI Backend",
        "version": "1.0.0",
        "graph_nodes": len(graph_store.graph.nodes),
        "graph_edges": len(graph_store.graph.edges),
        "ai_provider": ai_service.get_provider_status(),
        "database": "sqlite_connected",
    }


@app.get("/api/dashboard", tags=["Dashboard"])
def get_dashboard_metrics() -> Dict[str, Any]:
    """Returns aggregated real-time metrics and latest evaluation summary."""
    metrics = db_manager.get_dashboard_metrics()
    recent_drafts = db_manager.list_drafts()[:5]
    return {
        "metrics": metrics,
        "recent_drafts": recent_drafts,
        "is_synthetic_demo": True,
    }


@app.get("/api/brand/rules", tags=["Brand Knowledge"])
def get_brand_knowledge() -> Dict[str, Any]:
    """Returns all approved brand rules, products, terms, sources, and disclaimers."""
    return get_all_sample_data()


@app.get("/api/brand/graph", tags=["Brand Knowledge"])
def get_brand_graph(product_id: Optional[str] = None) -> Dict[str, Any]:
    """Returns interactive graph visualization data (nodes, coordinates, colors, edges)."""
    return graph_store.get_graph_data()


@app.post("/api/review", tags=["Content Review"])
def review_content(request: ReviewRequest) -> Dict[str, Any]:
    """Runs deterministic rule checks, RAG evidence retrieval, and optional AI review."""
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty.")

    draft = review_service.review_draft(
        content=request.content,
        title=request.title or "Untitled Draft",
        author=request.author or "Content Creator",
        product_id=request.product_id or "PROD-COPILOT",
        draft_id=request.draft_id,
        save_to_db=True,
    )
    return draft.model_dump()


@app.get("/api/drafts", tags=["Workflow"])
def list_drafts() -> List[Dict[str, Any]]:
    """Lists all stored drafts with status and finding counts."""
    return db_manager.list_drafts()


@app.get("/api/drafts/{draft_id}", tags=["Workflow"])
def get_draft_details(draft_id: str) -> Dict[str, Any]:
    """Retrieves full draft content, findings, reviewer comments, and audit decisions."""
    draft = db_manager.get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found.")

    comments = db_manager.get_comments(draft_id)
    decisions = db_manager.get_decisions(draft_id)

    res = draft.model_dump()
    res["comments"] = [c.model_dump() for c in comments]
    res["decisions"] = [d.model_dump() for d in decisions]
    return res


@app.post("/api/drafts", tags=["Workflow"])
def create_draft(request: CreateDraftRequest) -> Dict[str, Any]:
    """Creates a draft directly in the workflow."""
    draft = review_service.review_draft(
        content=request.content,
        title=request.title,
        author=request.author,
        product_id=request.product_id,
        save_to_db=True,
    )
    return draft.model_dump()


@app.post("/api/drafts/{draft_id}/comments", tags=["Workflow"])
def add_draft_comment(draft_id: str, request: AddCommentRequest) -> Dict[str, Any]:
    """Adds a human reviewer comment to a draft."""
    draft = db_manager.get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found.")

    comment = ReviewComment(
        id=f"COMM-{os.urandom(4).hex()}",
        draft_id=draft_id,
        author=request.author,
        comment_text=request.comment_text,
        finding_id=request.finding_id,
    )
    db_manager.add_comment(comment)
    return comment.model_dump()


@app.patch("/api/drafts/{draft_id}/status", tags=["Workflow"])
def update_draft_status(draft_id: str, request: UpdateStatusRequest) -> Dict[str, Any]:
    """Transitions a draft review status (Draft, Needs Revision, Submitted, Approved, Rejected)."""
    success = review_service.update_review_status(
        draft_id=draft_id,
        new_state=request.new_state,
        reviewer=request.reviewer,
        notes=request.decision_notes or "",
    )
    if not success:
        raise HTTPException(status_code=404, detail="Draft not found or transition failed.")

    return {
        "draft_id": draft_id,
        "new_state": request.new_state.value,
        "reviewer": request.reviewer,
        "timestamp": db_manager.get_draft(draft_id).updated_at.isoformat(),
    }


@app.post("/api/drafts/{draft_id}/rewrite", tags=["Content Review"])
def apply_rewrite(draft_id: str, request: ApplyRewriteRequest) -> Dict[str, Any]:
    """Applies an approved suggested correction to the draft text."""
    draft = review_service.apply_suggested_rewrite(draft_id, request.finding_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft or finding not found.")
    return draft.model_dump()


@app.post("/api/drafts/{draft_id}/dismiss", tags=["Content Review"])
def dismiss_finding(draft_id: str, request: DismissFindingRequest) -> Dict[str, Any]:
    """Dismisses a flagged finding with reviewer justification."""
    draft = review_service.dismiss_finding(draft_id, request.finding_id, request.reason or "Dismissed by reviewer")
    if not draft:
        raise HTTPException(status_code=404, detail="Draft or finding not found.")
    return draft.model_dump()


@app.get("/api/evaluation", tags=["Stress Tester"])
def get_evaluation_summary() -> Dict[str, Any]:
    """Returns the latest synthetic stress test evaluation run."""
    run = db_manager.get_latest_evaluation_run()
    if not run:
        summary = eval_runner.run_suite()
        return summary.model_dump()
    return run.get("summary", run)


@app.post("/api/evaluation/run", tags=["Stress Tester"])
def execute_evaluation_suite() -> Dict[str, Any]:
    """Executes the live 10-case evaluation suite and records actual results."""
    summary = eval_runner.run_suite()
    return summary.model_dump()


@app.get("/api/settings", tags=["Settings & Disclosures"])
def get_settings_and_disclosures() -> Dict[str, Any]:
    """Returns system configuration, privacy disclaimers, and synthetic data notices."""
    return {
        "application_name": "BrandGraph AI — Inkloom AI Brand Governance Platform",
        "version": "1.0.0",
        "team": "ProjectX (Amrita Vishwa Vidyapeetham)",
        "ai_provider_status": ai_service.get_provider_status(),
        "synthetic_data_notice": (
            "All brands, products, benchmark figures, and audit certifications used in this demonstration "
            "are explicitly synthetic and created for the Inkloom AI Brand Governance Platform Challenge."
        ),
        "privacy_policy": (
            "Content submitted in local offline mode is never transmitted to external third-party servers. "
            "All embeddings, keyword searches, and rule verifications run on local memory and SQLite."
        ),
        "governance_rule": (
            "Human-in-the-Loop: BrandGraph AI never automatically publishes content. Final publication "
            "and approval decisions rest solely with authorized human reviewers."
        ),
        "limitations": [
            "Keyword retrieval does not substitute for a full semantic vector database on out-of-vocabulary queries.",
            "Local NetworkX graph is stored in memory and synchronized with SQLite, suitable for hackathon scale.",
            "Missing evidence is strictly categorized as 'Needs verification', never presumed false automatically.",
        ],
    }


# -----------------------------------------------------------------------------
# Static Frontend Serving
# -----------------------------------------------------------------------------
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
