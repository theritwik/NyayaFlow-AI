<div align="center">

# ⚖️ NyayaFlow AI

### Court Judgment → Verified Action Plan

**AI suggests. Officers verify. Only approved actions reach the dashboard.**

A decision-support platform that helps government departments turn long court-judgment PDFs into structured, source-verifiable action plans — without ever letting raw AI output slip into official records.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PyMuPDF](https://img.shields.io/badge/PyMuPDF-1.27-2C3E50)](https://pymupdf.readthedocs.io/)
[![Tesseract](https://img.shields.io/badge/Tesseract-5.5-4285F4)](https://tesseract-ocr.github.io/)
[![Postgres](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Prototype-orange)]()

</div>

---

## 🧭 The Problem

Government departments receive long court-judgment PDFs through CCMS every day. An officer has to:

1. Read the entire judgment.
2. Spot the directions ("the Department shall consider… within 6 weeks").
3. Identify deadlines, responsible departments, and whether an appeal is worth filing.
4. Manually create an action plan — and risk missing a court-mandated step.

Result: **delayed compliance, missed appeals, and contempt risk.**

## ✨ The Solution

NyayaFlow AI reads the judgment, drafts an action plan with **source highlights** and **confidence scores**, and routes everything to a **mandatory officer-review screen**. The Verified Dashboard only ever shows items that a human approved.

> **One sentence:** AI assists with drafting; a human officer remains the only authority that can mark an action as official.

---

## 🎬 Demo flow at a glance

```
┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌────────────┐   ┌──────────┐
│  Upload  │ → │ Extract  │ → │ Human Review │ → │ Verified   │ → │  Export  │
│   PDF    │   │  + OCR   │   │  (the gate)  │   │ Dashboard  │   │  CSV/PDF │
└──────────┘   └──────────┘   └──────────────┘   └────────────┘   └──────────┘
                                  ▲                  ▲
                          Approve / Edit /     Only approved
                              Reject           items appear
```

| Page | Purpose |
|---|---|
| `/` | Overview KPIs and recent judgments |
| `/upload` | PDF upload (digital or scanned) or pick a sample |
| `/processing/[id]` | Read-only "what AI found" with confidence + source page |
| `/review/[id]` | **The trust gate** — Approve / Edit / Reject every field and action |
| `/dashboard` | Verified-only Action Dashboard with filters and search |
| `/action/[id]` | Action Detail with full review history + AI-vs-current diff |
| `/audit` | Immutable audit log of every AI extraction and reviewer decision |
| `/export` | Per-judgment CSV export and printable PDF report with **OFFICER VERIFIED** stamp |

---

## 🚀 Quick Start

> **Requirements:** Node.js 18+ · Python 3.11+ · Tesseract OCR (for scanned PDFs)

### 1️⃣ Clone & install

```bash
git clone <your-repo-url> nyayaflow-ai
cd nyayaflow-ai

# Node dependencies
npm install

# Python dependencies (creates backend/.venv with PyMuPDF, FastAPI, Tesseract bindings)
npm run py:install

# Tesseract — macOS
brew install tesseract
# Tesseract — Ubuntu/Debian
# sudo apt-get install tesseract-ocr
```

### 2️⃣ Run (two terminals)

```bash
# Terminal 1 — Python processing service
npm run py:dev          # → http://127.0.0.1:8000

# Terminal 2 — Next.js frontend + API
npm run dev             # → http://localhost:3000
```

### 3️⃣ Load demo data

Open http://localhost:3000 and click **"Load demo data"** on the landing page. This seeds three sample judgments covering:

- ✅ A clear 6-week direction (High urgency)
- ✅ A 30-day compliance affidavit (High urgency)
- ⚠ A poor-quality scanned judgment (Low confidence — routed to human review)

That's it. **You're ready to demo.** 🎉

---

## ⭐ Features

### 📄 Document processing
- Digital PDF text extraction via **PyMuPDF**
- **Tesseract OCR** fallback for scanned pages
- Per-span bounding boxes preserved for highlighting
- Sample fixtures included so demos work even without real PDFs

### 🤖 AI / NLP
- Modular extraction with three engines:
  - **Curated mock** for guaranteed-good demo output
  - **Rule-based regex** for real PDF uploads
  - **LayoutLMv3 hook** + **LLM hook** as documented integration points
- 12 extracted field types: case title, case number, court, date, parties, key directions, deadlines, departments, compliance instructions, appeal considerations, urgency
- 5 action types: Compliance · Appeal Consideration · Department Review · Deadline Tracking · Information Update
- Per-field and per-action confidence scores

### 👮 Human-in-the-loop verification
- **Approve · Edit · Reject** for every field and every action
- Reviewer comments captured per decision
- Original AI value preserved alongside the edited value (struck-through diff)
- "Save & Approve" combo button for fast verification of edited items
- Low-confidence items flagged with **⚠ Needs officer review** badge

### 🔍 Source evidence
- Source excerpt + page number + confidence beside every extracted item
- **📄 View on PDF** — actual PDF page renders inline with a **translucent yellow highlight rectangle** drawn on the matched span by PyMuPDF
- AI-vs-Officer-Verified provenance badges throughout the UI

### 📊 Verified Dashboard
- KPIs: Judgments processed · Pending review · Approved actions · High urgency open
- Filters: status (Pending / Approved / Rejected / Completed) · department · action type · urgency
- Free-text search across title, description, department
- Department-wise breakdown · Upcoming deadlines list

### 📜 Audit trail
- Every AI extraction logged
- Every reviewer decision logged with previous → new value, reviewer, comment, timestamp
- Filterable by judgment

### 📤 Export
- **CSV** — machine-readable, suitable for case-management systems
- **PDF** — printable HTML report with the **OFFICER VERIFIED** stamp; one click in the browser saves it as PDF

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        NyayaFlow AI                                      │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Browser (React / Tailwind, government look-and-feel)            │   │
│  │  /upload  /processing  /review  /dashboard  /action  /audit  …   │   │
│  └────────────────────────────────┬─────────────────────────────────┘   │
│                                   │                                      │
│  ┌────────────────────────────────▼─────────────────────────────────┐   │
│  │  Next.js API routes (TypeScript, Node)                           │   │
│  │  /api/upload • /api/judgments • /api/review • /api/audit         │   │
│  │  /api/dashboard • /api/export • /api/page  (PDF render proxy)    │   │
│  └─────────┬────────────────────────────────────────┬───────────────┘   │
│            │ HTTP (port 8000)                       │                    │
│            ▼                                        ▼                    │
│  ┌──────────────────────────────┐      ┌────────────────────────────┐   │
│  │  Python FastAPI service      │      │  SQLite (default)          │   │
│  │  • PyMuPDF text + bboxes     │      │  via better-sqlite3        │   │
│  │  • Tesseract OCR fallback    │      │                            │   │
│  │  • Page → PNG with highlight │      │  PostgreSQL (optional)     │   │
│  │  • Pluggable extraction:     │      │  via docker compose        │   │
│  │     – curated mock           │      │  + db/schema.sql           │   │
│  │     – rule-based regex       │      │                            │   │
│  │     – LayoutLMv3 hook (off)  │      └────────────────────────────┘   │
│  │     – LLM hook (off)         │                                       │
│  └──────────────────────────────┘                                       │
│                                                                          │
│  Trust boundary:                                                         │
│      [ AI ] → Pending Review → [ Officer Approve / Edit / Reject ] →    │
│               Verified Dashboard · Export                                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🧰 Tech Stack

<table>
<tr>
<td valign="top" width="50%">

**Frontend**
- Next.js 14 (App Router)
- React 18
- TypeScript 5.6
- Tailwind CSS 3.4
- Custom shadcn-style components

**Backend (Node)**
- Next.js API routes
- `better-sqlite3` (SQLite)
- `pdf-parse` (Node fallback)

**Database**
- SQLite (zero-setup default)
- PostgreSQL 16 (docker-compose path)

</td>
<td valign="top" width="50%">

**Backend (Python)**
- FastAPI 0.136 + Uvicorn
- **PyMuPDF** 1.27 (text + bboxes + page render)
- **Tesseract** 5.5 via `pytesseract`
- Pillow + Pydantic

**AI / NLP**
- Curated mock fixtures
- Rule-based regex extractor
- **LayoutLMv3** integration hook
- **LLM** hook (OpenAI / Gemini / Anthropic)

**DevOps**
- Docker Compose (Postgres)
- Python venv

</td>
</tr>
</table>

---

## 📁 Project Structure

```
.
├── app/                        # Next.js App Router pages + API routes
│   ├── page.tsx                #   Landing
│   ├── upload/                 #   Upload Judgment
│   ├── processing/[id]/        #   Processing Results
│   ├── review/[id]/            #   Human Review (the gate)
│   ├── judgments/              #   All judgments
│   ├── dashboard/              #   Verified Dashboard
│   ├── action/[id]/            #   Action Detail
│   ├── audit/                  #   Audit Trail
│   ├── export/                 #   Export Report
│   └── api/                    #   JSON / file endpoints
├── backend/                    # Python FastAPI processing service
│   ├── main.py                 #   /process /page /extract /health
│   ├── requirements.txt
│   └── README.md
├── components/                 # Shared UI: Badges, EvidencePanel, PdfHighlight, …
├── db/schema.sql               # PostgreSQL schema
├── docker-compose.yml          # Postgres dev stack
├── lib/
│   ├── db.ts                   # SQLite handle + DDL bootstrap
│   ├── pyclient.ts             # Bridge to Python service
│   ├── pdf.ts                  # parsePdf() with Python primary + pdf-parse fallback
│   ├── extraction.ts           # Modular AI extraction
│   ├── repo.ts                 # Typed CRUD layer
│   ├── types.ts                # Domain types
│   └── utils.ts
├── scripts/
│   ├── seed.ts                 # CLI seeder (npm run seed)
│   └── migrate-pg.ts           # Apply db/schema.sql to Postgres
├── data/
│   ├── samples/                # 3 sample judgments
│   └── uploads/                # Uploaded files (gitignored)
└── README.md
```

---

## 🔌 API Reference

### Next.js (port 3000)

| Method | Endpoint | What it does |
|---|---|---|
| `POST` | `/api/upload` | Upload a PDF or trigger a sample. Runs the full pipeline. |
| `GET`  | `/api/judgments` | List all judgments. |
| `GET`  | `/api/judgments/[id]` | Judgment + its fields + actions. |
| `GET`  | `/api/actions?status=` | List actions, optional status filter. |
| `POST` | `/api/actions/[id]` | Reviewer decision (Approve / Edit / Reject / Complete). |
| `POST` | `/api/fields/[id]` | Reviewer decision on an extracted field. |
| `GET`  | `/api/audit?judgmentId=` | Audit log entries. |
| `GET`  | `/api/dashboard` | Stats + departments + approved actions. |
| `GET`  | `/api/page/[id]?page=&x0=&y0=&x1=&y1=` | Render a PDF page as PNG with optional highlight rectangle. |
| `GET`  | `/api/export/[id]?format=csv\|html` | Download CSV or printable HTML. |
| `POST` | `/api/seed` | Reset DB and load 3 curated samples. |

### Python FastAPI (port 8000)

| Method | Endpoint | What it does |
|---|---|---|
| `GET`  | `/health` | Liveness + capability flags. |
| `POST` | `/process` | PyMuPDF text + per-span bboxes; auto-OCR for scanned pages. |
| `GET`  | `/page` | PDF page → PNG with optional highlight rectangle. |
| `POST` | `/extract` | Run modular extraction (LayoutLMv3 → LLM → mock → rules). |

---

## 🗄️ Database Schema

Same on SQLite and PostgreSQL — see [`db/schema.sql`](db/schema.sql) for the canonical Postgres DDL.

```
judgments         ── one row per uploaded PDF
extracted_fields  ── per-field with ai_value, current_value, confidence, bbox
action_items      ── per-action with type, department, due_date, urgency, bbox
audit_log         ── append-only history of AI extractions + reviewer decisions
```

Each `extracted_fields` and `action_items` row keeps **both** the original AI value (`ai_*`) and the current (possibly edited) value, so the diff is always available.

---

## 🛡️ Product Principles

> Decision-support, not full automation.

- ✅ **Nothing untrusted reaches the dashboard.** Pending and Rejected items never appear in verified views or exports.
- ✅ **Explainability is first-class.** Every field and action carries source excerpt + page + confidence.
- ✅ **Low confidence routes to humans.** Missing deadlines or unclear directions are flagged for officer review.
- ✅ **Auditability.** AI value, edits, reviewer, decision, and timestamp are all preserved.

---

## ⚙️ Configuration

| Variable | Default | Purpose |
|---|---|---|
| `NYAYAFLOW_PY_URL` | `http://127.0.0.1:8000` | Python FastAPI base URL. |
| `NYAYAFLOW_LLM_ENABLED` | `false` | Enable the LLM extraction hook. |
| `NYAYAFLOW_LAYOUTLM_ENABLED` | `false` | Enable the LayoutLMv3 hook. |
| `NYAYAFLOW_AUTOSEED` | `false` | When `true`, the landing page auto-seeds 3 demo judgments on first hit if the DB is empty (used by the Render deploy). |
| `DATABASE_URL` | _unset_ | If set to `postgres://…`, switches to Postgres. |

### Use PostgreSQL instead of SQLite

```bash
docker compose up -d
export DATABASE_URL="postgres://nyaya:nyaya@localhost:5432/nyayaflow"
npm install --save-optional pg
npm run db:migrate
npm run dev
```

---

## 📜 License

Prototype, internal use. Add your organisation's license header before deployment.

---

<div align="center">

**Built for Theme 11 — *From Court Judgments to Verified Action Plans*.**

*AI assists. Officers decide. Justice flows.*

</div>
