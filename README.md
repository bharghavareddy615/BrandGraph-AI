# BrandGraph AI — Inkloom AI Brand Governance Platform

> **An Evidence-Linked Brand Intelligence and Governance System**  
> **Challenge:** Inkloom AI Brand Governance Platform Challenge (Round 1)  
> **Team Name:** ProjectX  
> **Institution:** Amrita Vishwa Vidyapeetham  

---

## 1. Executive Summary

Maintaining a consistent, legally compliant, and evidence-grounded brand voice is critical when scaling content across agencies, creators, and generative AI tools. Unapproved aliases, unsupported performance claims, missing mandatory disclaimers, or off-brand superlatives risk regulatory penalties and erode consumer trust.

**BrandGraph AI** is a full-stack brand governance platform that checks drafts *before publication* against approved guidelines, product facts, and evidence sources.

### Key Differentiators:
- **Evidence-Linked Grounding:** Combines a local **NetworkX Knowledge Graph** with **Retrieval-Augmented Generation (RAG)** to connect every finding directly to approved benchmark whitepapers and source records.
- **Deterministic Rule Reliability:** High-priority policy violations (prohibited phrases, unapproved aliases, missing disclaimers) execute offline without hallucinations or external API dependencies.
- **Responsible AI with Human-in-the-Loop:** Missing evidence is strictly categorized as **"Needs verification"** (never assumed false). The system never automatically publishes content; final authority rests with human editors.
- **Built-in Brand Stress Tester:** Evaluates 10 curated synthetic edge cases with transparent, repeatable metrics calculated from live executions.

---

## 2. Architecture & Technology Stack

```
[ Frontend: HTML5 / CSS3 / Vanilla JavaScript ]
                      │  REST (JSON)
                      ▼
       [ FastAPI Backend (Python 3.12) ]
                      │
  ┌───────────────────┼───────────────────┐
  ▼                   ▼                   ▼
[ Deterministic   [ RAG Pipeline     [ NetworkX
  Rule Engine ]     & Keyword Store ]   Knowledge Graph ]
  │                   │                   │
  └───────────────────┼───────────────────┘
                      ▼
          [ Review Service Orchestrator ]
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
[ SQLite Persistence ]      [ Optional External LLM ]
 (Drafts, Findings,          (Disabled by default;
  Comments, Decisions)        Local Offline Mode)
```

- **Frontend:** Plain HTML5, CSS3, Vanilla JavaScript (No React, Next.js, or frontend build tool needed).
- **Backend:** Python 3.12, FastAPI, Uvicorn.
- **Database:** SQLite (persists drafts, findings, comments, state transitions, evaluation runs).
- **Knowledge Graph:** NetworkX directed multigraph with typed nodes (`Brand`, `Product`, `Rule`, `PreferredTerm`, `ProhibitedTerm`, `Claim`, `EvidenceSource`, `Disclaimer`, `ContentDraft`, `Finding`).
- **Retrieval Engine:** Sentence-aware chunking with token-overlap and term-weighted search with provenance preservation.
- **Testing:** Pytest automated test suite.

---

## 3. Getting Started & Installation (Windows PowerShell)

### Prerequisites
- Python 3.11 or 3.12
- Git

### 1. Clone or Open Workspace
```powershell
cd c:\Users\bharg\Desktop\Projects\CodeAxis
```

### 2. Install Dependencies
```powershell
pip install -r requirements.txt
```

### 3. Launch the Application
```powershell
python run.py
```
*The browser will automatically open to `http://localhost:8000`.*  
*Interactive Swagger API documentation is available at `http://localhost:8000/docs`.*

---

## 4. Running Automated Tests

Run the full pytest suite (23 unit and integration tests):
```powershell
python -m pytest -v
```

### Test Coverage Summary:
- `tests/test_rule_engine.py`: Prohibited terms (`100% bug-free`, `hack-proof`), unapproved product aliases (`Inkloom Bot`), missing disclaimers (`DISC-001`), compliant drafts, contradicted claims (`zero false alarms`), and superseded rules.
- `tests/test_retrieval.py`: Benchmark report retrieval (`SRC-001`), SOC2 audit summaries (`SRC-003`), unsupported claim uncertainty (`Needs verification`), and empty queries.
- `tests/test_graph.py`: Node and edge initialization, product-to-rule traversals, claim-to-evidence traversals, conflicting rules (`RULE-007` vs `RULE-008`), and visualizer JSON export.
- `tests/test_api.py`: FastAPI endpoints (`/api/health`, `/api/brand/rules`, `/api/brand/graph`, `/api/review`, `/api/drafts`, comments, status transitions, `/api/evaluation/run`, `/api/settings`).

---

## 5. Walkthrough of User Interface Pages

1. **Dashboard:** Live governance overview displaying total drafts reviewed, issue distributions by category and severity, workflow status breakdown, and actual stress test accuracy.
2. **Content Review:** Interactive copy editor with one-click test presets:
   - *Multiple Violations Preset:* Demonstrates simultaneous detection of prohibited terms, unapproved aliases, missing disclaimers, and contradicted claims.
   - *Suggested Rewrite Assistant:* Reviewers can click **"Apply Correction"** to automatically substitute approved wording into the draft and update the SQLite record.
3. **Brand Knowledge Base:**
   - *Interactive SVG Knowledge Graph:* Visualizes directed relationships between Brands, Products, Rules, Terms, Sources, and Disclaimers with pan, zoom, and a node inspector drawer.
   - *Tables:* Approved rules, preferred vs prohibited terminology, and mandatory disclaimers.
4. **Evidence Explorer:** Searchable repository of approved synthetic evidence sources with excerpts, provenance, publication dates, and supported claims.
5. **Review Workflow:** Human-in-the-loop review queue supporting 5 lifecycle states:
   - `Draft` &rarr; `Needs Revision` &rarr; `Submitted for Review` &rarr; `Approved` &bull; `Rejected`
   - Includes threaded reviewer comments and an audit trail of every status transition.
6. **Brand Stress Tester:** 10 curated synthetic test cases run in real time, calculating actual accuracy, false positives, false negatives, and latency without fabricated scores.
7. **Settings & Disclosures:** Transparent visibility into AI provider status, privacy safeguards, and synthetic demonstration disclosures.

---

## 6. Manual Demo Checklist for Hackathon Judges

| Step | Action | Expected Behavior |
|------|--------|-------------------|
| 1 | Visit `http://localhost:8000` | Dashboard loads with live metrics and synthetic demo banner. |
| 2 | Click **"Content Review"** in sidebar | Content review editor opens with test presets. |
| 3 | Click **"⚠️ Multiple Violations"** preset | Populates textarea with text containing `Inkloom Bot`, `100% bug-free`, `under 5ms latency`, etc. |
| 4 | Click **"Check Brand Compliance"** | Flags 5 distinct findings grouped by severity with rule IDs and evidence links. |
| 5 | Click **"Apply Correction"** on `Inkloom Bot` | Automatically replaces text with `Inkloom Copilot` and increments draft version. |
| 6 | Navigate to **"Brand Knowledge"** | Interactive SVG graph loads with 28 nodes and 20 edges; click any node to open the inspector. |
| 7 | Navigate to **"Stress Tester"** | Displays synthetic test suite; click **"Run Live Stress Test Suite"** to execute live evaluation. |
| 8 | Navigate to **"Review Workflow"** | Select draft, click **"Approve Draft"**, enter note, and observe the updated state and audit trail. |

---

## 7. Feature Implementation Status

### Fully Implemented:
- [x] Local offline-first architecture (operates without external API keys)
- [x] NetworkX knowledge graph with 11 node types and 9 relationship types
- [x] Deterministic brand rule engine for prohibited terms, product names, and disclaimers
- [x] Source-grounded RAG retrieval with provenance and "Needs verification" uncertainty
- [x] SQLite persistence for drafts, findings, comments, decisions, and evaluations
- [x] Plain HTML5, CSS3, and Vanilla JavaScript frontend (responsive, modern dark SaaS aesthetic)
- [x] Interactive SVG graph visualizer with node click inspection
- [x] 10 curated synthetic evaluation test cases with live pass/fail execution
- [x] Human review workflow with 5 states, comment threads, and audit log
- [x] 23 automated tests with Pytest (100% pass rate)

### Future Enhancements (Post-Hackathon):
- Multi-brand tenancy (supporting multiple brand guidelines within one workspace)
- Multi-modal image banner and logo scanner (OCR / visual trademark inspection)
- Production vector database integration (Qdrant / Milvus / Neo4j)

---

## 8. Responsible AI, Privacy & Third-Party Disclosures

1. **Synthetic Data Disclosure:** All brand rules, product facts, benchmark numbers, and audit sources are simulated for the Inkloom AI Brand Governance Platform Challenge.
2. **Privacy Notice:** In default local mode, content is analyzed strictly within memory and SQLite. No content is transmitted to external servers.
3. **No Automated Publishing:** The system enforces human-in-the-loop oversight and will never automatically publish content.
4. **Third-Party Libraries:**
   - `fastapi` & `uvicorn`: ASGI web framework and server
   - `networkx`: Directed graph data structure and algorithms
   - `pydantic`: Schema validation
   - `pytest`: Automated test runner
   - `sqlite3`: Relational persistence
