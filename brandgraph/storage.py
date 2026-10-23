"""SQLite persistence layer for BrandGraph AI drafts, reviews, findings, and evaluation history."""

import json
import sqlite3
from typing import Any, Dict, List, Optional
from datetime import datetime

from brandgraph.config import config
from brandgraph.schemas import (
    ContentDraft,
    Finding,
    FindingCategory,
    Severity,
    EvidenceStatus,
    ReviewState,
    ReviewComment,
    ReviewDecision,
    EvaluationSuiteSummary,
)


class StorageManager:
    """Manages SQLite database schema and operations."""

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or config.db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Initializes tables if they do not already exist."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Drafts table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS drafts (
                id TEXT PRIMARY KEY,
                title TEXT,
                content TEXT,
                product_id TEXT,
                author TEXT,
                current_state TEXT,
                version INTEGER,
                created_at TEXT,
                updated_at TEXT
            );
            """)

            # Findings table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS findings (
                id TEXT PRIMARY KEY,
                draft_id TEXT,
                category TEXT,
                matched_text TEXT,
                rule_id TEXT,
                rule_description TEXT,
                severity TEXT,
                explanation TEXT,
                suggested_action TEXT,
                suggested_rewrite TEXT,
                evidence_source_id TEXT,
                evidence_status TEXT,
                is_ai_assisted INTEGER,
                dismissed INTEGER,
                dismissed_reason TEXT,
                FOREIGN KEY (draft_id) REFERENCES drafts(id)
            );
            """)

            # Review comments table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS review_comments (
                id TEXT PRIMARY KEY,
                draft_id TEXT,
                author TEXT,
                comment_text TEXT,
                finding_id TEXT,
                created_at TEXT,
                FOREIGN KEY (draft_id) REFERENCES drafts(id)
            );
            """)

            # Review decisions (state transition audit log)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS review_decisions (
                id TEXT PRIMARY KEY,
                draft_id TEXT,
                reviewer TEXT,
                from_state TEXT,
                to_state TEXT,
                decision_notes TEXT,
                timestamp TEXT,
                FOREIGN KEY (draft_id) REFERENCES drafts(id)
            );
            """)

            # Stress test evaluation history
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS evaluation_runs (
                id TEXT PRIMARY KEY,
                total_tests INTEGER,
                passed_tests INTEGER,
                failed_tests INTEGER,
                false_positives INTEGER,
                false_negatives INTEGER,
                execution_time_seconds REAL,
                timestamp TEXT,
                summary_json TEXT
            );
            """)
            conn.commit()

    # -------------------------------------------------------------------------
    # Drafts & Findings Operations
    # -------------------------------------------------------------------------

    def save_draft(self, draft: ContentDraft):
        """Inserts or updates a content draft along with its findings."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT OR REPLACE INTO drafts (
                id, title, content, product_id, author, current_state, version, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                draft.id,
                draft.title,
                draft.content,
                draft.product_id,
                draft.author,
                draft.current_state.value if isinstance(draft.current_state, ReviewState) else draft.current_state,
                draft.version,
                draft.created_at.isoformat(),
                draft.updated_at.isoformat(),
            ))

            # Replace findings for this draft
            cursor.execute("DELETE FROM findings WHERE draft_id = ?;", (draft.id,))
            for f in draft.findings:
                cursor.execute("""
                INSERT INTO findings (
                    id, draft_id, category, matched_text, rule_id, rule_description, severity,
                    explanation, suggested_action, suggested_rewrite, evidence_source_id,
                    evidence_status, is_ai_assisted, dismissed, dismissed_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, (
                    f.id,
                    draft.id,
                    f.category.value if isinstance(f.category, FindingCategory) else f.category,
                    f.matched_text,
                    f.rule_id,
                    f.rule_description,
                    f.severity.value if isinstance(f.severity, Severity) else f.severity,
                    f.explanation,
                    f.suggested_action,
                    f.suggested_rewrite,
                    f.evidence_source_id,
                    f.evidence_status.value if isinstance(f.evidence_status, EvidenceStatus) else f.evidence_status,
                    1 if f.is_ai_assisted else 0,
                    1 if f.dismissed else 0,
                    f.dismissed_reason,
                ))
            conn.commit()

    def get_draft(self, draft_id: str) -> Optional[ContentDraft]:
        """Loads a draft and its findings from SQLite."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM drafts WHERE id = ?;", (draft_id,))
            row = cursor.fetchone()
            if not row:
                return None

            cursor.execute("SELECT * FROM findings WHERE draft_id = ?;", (draft_id,))
            finding_rows = cursor.fetchall()
            findings = []
            for fr in finding_rows:
                findings.append(
                    Finding(
                        id=fr["id"],
                        category=FindingCategory(fr["category"]),
                        matched_text=fr["matched_text"],
                        rule_id=fr["rule_id"],
                        rule_description=fr["rule_description"],
                        severity=Severity(fr["severity"]),
                        explanation=fr["explanation"],
                        suggested_action=fr["suggested_action"],
                        suggested_rewrite=fr["suggested_rewrite"],
                        evidence_source_id=fr["evidence_source_id"],
                        evidence_status=EvidenceStatus(fr["evidence_status"]) if fr["evidence_status"] else EvidenceStatus.NOT_APPLICABLE,
                        is_ai_assisted=bool(fr["is_ai_assisted"]),
                        dismissed=bool(fr["dismissed"]),
                        dismissed_reason=fr["dismissed_reason"],
                    )
                )

            return ContentDraft(
                id=row["id"],
                title=row["title"],
                content=row["content"],
                product_id=row["product_id"],
                author=row["author"],
                current_state=ReviewState(row["current_state"]),
                version=row["version"],
                findings=findings,
                created_at=datetime.fromisoformat(row["created_at"]),
                updated_at=datetime.fromisoformat(row["updated_at"]),
            )

    def list_drafts(self) -> List[Dict[str, Any]]:
        """Returns a list of summary records for all drafts."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT d.id, d.title, d.author, d.current_state, d.version, d.updated_at,
                   COUNT(f.id) as finding_count
            FROM drafts d
            LEFT JOIN findings f ON d.id = f.draft_id AND f.dismissed = 0
            GROUP BY d.id
            ORDER BY d.updated_at DESC;
            """)
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def update_draft_state(
        self,
        draft_id: str,
        new_state: ReviewState,
        reviewer: str,
        decision_notes: str = "",
    ) -> bool:
        """Transitions a draft to a new state and logs the decision."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT current_state FROM drafts WHERE id = ?;", (draft_id,))
            row = cursor.fetchone()
            if not row:
                return False

            old_state = ReviewState(row["current_state"])
            now_iso = datetime.utcnow().isoformat()

            # Update draft
            cursor.execute("""
            UPDATE drafts SET current_state = ?, updated_at = ? WHERE id = ?;
            """, (new_state.value, now_iso, draft_id))

            # Add decision audit record
            decision_id = f"DEC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{draft_id[:6]}"
            cursor.execute("""
            INSERT INTO review_decisions (
                id, draft_id, reviewer, from_state, to_state, decision_notes, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (
                decision_id,
                draft_id,
                reviewer,
                old_state.value,
                new_state.value,
                decision_notes,
                now_iso,
            ))
            conn.commit()
            return True

    # -------------------------------------------------------------------------
    # Comments Operations
    # -------------------------------------------------------------------------

    def add_comment(self, comment: ReviewComment):
        """Adds a reviewer comment to a draft."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO review_comments (
                id, draft_id, author, comment_text, finding_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?);
            """, (
                comment.id,
                comment.draft_id,
                comment.author,
                comment.comment_text,
                comment.finding_id,
                comment.created_at.isoformat(),
            ))
            conn.commit()

    def get_comments(self, draft_id: str) -> List[ReviewComment]:
        """Fetches all reviewer comments for a draft."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT * FROM review_comments WHERE draft_id = ? ORDER BY created_at ASC;
            """, (draft_id,))
            rows = cursor.fetchall()
            return [
                ReviewComment(
                    id=r["id"],
                    draft_id=r["draft_id"],
                    author=r["author"],
                    comment_text=r["comment_text"],
                    finding_id=r["finding_id"],
                    created_at=datetime.fromisoformat(r["created_at"]),
                )
                for r in rows
            ]

    def get_decisions(self, draft_id: str) -> List[ReviewDecision]:
        """Fetches all historical review decisions for a draft."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT * FROM review_decisions WHERE draft_id = ? ORDER BY timestamp ASC;
            """, (draft_id,))
            rows = cursor.fetchall()
            return [
                ReviewDecision(
                    id=r["id"],
                    draft_id=r["draft_id"],
                    reviewer=r["reviewer"],
                    from_state=ReviewState(r["from_state"]),
                    to_state=ReviewState(r["to_state"]),
                    decision_notes=r["decision_notes"],
                    timestamp=datetime.fromisoformat(r["timestamp"]),
                )
                for r in rows
            ]

    # -------------------------------------------------------------------------
    # Stress Test Evaluation Runs Operations
    # -------------------------------------------------------------------------

    def save_evaluation_run(self, summary: EvaluationSuiteSummary) -> str:
        """Saves a stress test evaluation run for auditing and dashboard metrics."""
        run_id = f"EVAL-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO evaluation_runs (
                id, total_tests, passed_tests, failed_tests, false_positives,
                false_negatives, execution_time_seconds, timestamp, summary_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                run_id,
                summary.total_tests,
                summary.passed_tests,
                summary.failed_tests,
                summary.false_positives,
                summary.false_negatives,
                summary.execution_time_seconds,
                summary.timestamp.isoformat(),
                summary.model_dump_json(),
            ))
            conn.commit()
        return run_id

    def get_latest_evaluation_run(self) -> Optional[Dict[str, Any]]:
        """Retrieves the most recent evaluation run."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT * FROM evaluation_runs ORDER BY timestamp DESC LIMIT 1;
            """)
            row = cursor.fetchone()
            if not row:
                return None
            return dict(row)

    def get_dashboard_metrics(self) -> Dict[str, Any]:
        """Calculates live aggregated metrics from actual stored data."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Total drafts
            cursor.execute("SELECT COUNT(*) as total_drafts FROM drafts;")
            total_drafts = cursor.fetchone()["total_drafts"]

            # Drafts by state
            cursor.execute("""
            SELECT current_state, COUNT(*) as count FROM drafts GROUP BY current_state;
            """)
            state_counts = {r["current_state"]: r["count"] for r in cursor.fetchall()}

            # Findings by category
            cursor.execute("""
            SELECT category, COUNT(*) as count FROM findings WHERE dismissed = 0 GROUP BY category;
            """)
            category_counts = {r["category"]: r["count"] for r in cursor.fetchall()}

            # Findings by severity
            cursor.execute("""
            SELECT severity, COUNT(*) as count FROM findings WHERE dismissed = 0 GROUP BY severity;
            """)
            severity_counts = {r["severity"]: r["count"] for r in cursor.fetchall()}

            return {
                "total_drafts": total_drafts,
                "state_counts": state_counts,
                "category_counts": category_counts,
                "severity_counts": severity_counts,
            }
