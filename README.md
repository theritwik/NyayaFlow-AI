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

## 🎯 5-Minute Demo Script

> Pre-flight: Python service running on `:8000`, Next.js on `:3000`, click **Load demo data**.

1. **Frame the problem** *(30s)* — Officers spend hours reading PDFs and risk missing court-mandated deadlines.

2. **Overview** *(30s)* — Point at the four KPIs. One action is already approved; that's the only thing on the trusted dashboard.

3. **Upload** *(45s)* — Open `/upload`, click **Process** on Sample 1. Pipeline runs PyMuPDF → extraction → bbox enrichment in real time, lands on `/processing/1`.

4. **Show real PDF highlighting** *(30s)* — Expand any **📄 View on PDF** panel. The original page renders with a translucent yellow box around the cited span. **This is real PyMuPDF output**, not a screenshot.

5. **Open Human Review** *(90s)* — Edit a field (preserve AI value), Approve a high-confidence field, Approve & Edit an action with a real due date. Watch the *Officer Verified* badge appear.

6. **Verified Dashboard** *(45s)* — Approved actions show up. Filter by High urgency or department. Open one → see the AI-vs-current diff and review history.

7. **Audit Trail** *(30s)* — Every AI extraction → every reviewer decision, with timestamps. Filterable per judgment.

8. **Low-confidence pathway** *(30s)* — Run Sample 3 (scanned). Red badges, blank due dates, *Needs officer review*. Nothing reaches the dashboard until a human acts.

9. **Export** *(20s)* — Download CSV. Click PDF → printable report with **OFFICER VERIFIED** stamp.

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

## ☁️ Deploy on Render (Node native runtime — easiest)

The fastest way to get NyayaFlow running on Render. No Docker, no venv, no
infra setup — just paste two commands into the dashboard.

### 1. Render dashboard settings

| Setting | Value |
|---|---|
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build && python3 -m pip install --user --break-system-packages --no-cache-dir -r backend/requirements.txt` |
| **Start Command** | `./start.sh` |
| **Health Check Path** | `/api/health` |

> Tip: the same Build Command is exposed as `npm run render:build` and the same Start Command as `npm run start:prod`.

### 2. Environment variables

Render → your service → **Environment**:

| Key | Value |
|---|---|
| `NYAYAFLOW_PY_URL` | `http://127.0.0.1:8000` |
| `NYAYAFLOW_AUTOSEED` | `true` |
| `NODE_ENV` | `production` |

### 3. What happens on deploy

1. Render runs the Build Command:
   - `npm install` → installs Node deps
   - `npm run build` → builds Next.js for production
   - `python3 -m pip install --user …` → installs FastAPI + PyMuPDF + Pydantic into `~/.local/lib/python3.x/site-packages`
2. Render runs `./start.sh`, which:
   - Detects `python3` on PATH (Render has Python pre-installed)
   - Verifies FastAPI / PyMuPDF / uvicorn are importable
   - Boots `python3 -m uvicorn backend.main:app` on `127.0.0.1:8000` in the background
   - Waits up to 60s for `/health` to respond
   - Hands over to Next.js on `$PORT` in the foreground
3. The landing page auto-seeds 3 demo judgments on first hit (because `NYAYAFLOW_AUTOSEED=true`).
4. Health endpoint reports both services live.

### 4. Verify the deploy

```bash
curl https://YOUR-APP.onrender.com/api/health
```

Expected:

```json
{
  "ok": true,
  "service": "nyayaflow-next",
  "python": { "reachable": true, "url": "http://127.0.0.1:8000" },
  "time": "2026-05-07T10:06:34.977Z"
}
```

If `python.reachable` is `false`, open Render Logs and look for `[NyayaFlow]` lines from `start.sh` — they tell you exactly where Python startup got stuck.

### Note on Tesseract OCR

Render's Node runtime doesn't have Tesseract pre-installed. The demo workflow doesn't need it (curated samples don't trigger OCR), so it's fine. For real OCR in production, switch to the Docker deployment below.

---

## ☁️ Deploy to Render (Docker — for real OCR + persistent bundling)

The repo also ships a [`Dockerfile`](Dockerfile) + [`render.yaml`](render.yaml) that deploys **both** services in a single container with Tesseract pre-installed.

### One-time setup

1. Push this repo to GitHub.
2. On [render.com](https://render.com) → **New +** → **Blueprint** → select your repo.
3. Render reads `render.yaml`, builds the Dockerfile, and deploys.
4. First boot installs Tesseract + PyMuPDF inside the image (~5 minutes).
5. Open the URL — the landing page auto-seeds 3 sample judgments on first hit (because `NYAYAFLOW_AUTOSEED=true` is set in `render.yaml`).

### What the Docker image contains

```
node:20-slim
  ├── Node 20 + Next.js (production build)
  ├── Python 3 + venv + PyMuPDF + Tesseract bindings + FastAPI
  └── Tesseract OCR (apt package)
```

### How it boots

[`start.sh`](start.sh) launches FastAPI on `127.0.0.1:8000`, waits for `/health`, then starts Next.js on `$PORT` (Render injects this). Both processes share the container's filesystem so PDFs uploaded through the UI are immediately readable by Python for rendering and OCR.

### Health check

`render.yaml` points `healthCheckPath` at `/api/health`, which reports both Node liveness and the reachability of the Python sidecar:

```json
{
  "ok": true,
  "service": "nyayaflow-next",
  "python": { "reachable": true, "url": "http://127.0.0.1:8000" },
  "time": "2026-05-07T10:06:34.977Z"
}
```

### Run the same image locally

```bash
docker build -t nyayaflow-ai .
docker run --rm -p 3000:3000 -e NYAYAFLOW_AUTOSEED=true nyayaflow-ai
# → http://localhost:3000
```

### Notes on free-tier hosts

- Render's free tier has **no persistent disk**, so the SQLite DB and uploaded PDFs reset on every restart. Auto-seed re-creates the demo content on first hit, so the URL is always demo-ready.
- For production with retained data, attach a Render persistent disk at `/app/data` or set `DATABASE_URL` to a managed Postgres instance.

---

## 🗺️ Roadmap

- [ ] Wire LayoutLMv3 fine-tuned on Indian judgment corpus
- [ ] Wire production LLM (Anthropic / OpenAI / Gemini)
- [ ] Real reviewer auth (replace `demo.officer` with CCMS SSO)
- [ ] Async pipeline (queue + worker for large PDFs)
- [ ] Native PDF generator for exports (currently uses browser print dialog)
- [ ] Multi-language judgment support (Hindi / regional courts)

---

## 🧪 Honest Limitations

- **LayoutLMv3** — hook is wired and documented; the model itself isn't loaded by default (needs GPU + a fine-tuned checkpoint).
- **LLM** — hook is wired; flip the env var and drop in your provider call to enable.
- **Reviewer identity** — currently hard-coded to `demo.officer`; production should integrate CCMS SSO.
- **Sample fixtures** are `.txt` for portability; real `.pdf` files work end-to-end with PyMuPDF + Tesseract.

---

## 📜 License

Prototype, internal use. Add your organisation's license header before deployment.

---

<div align="center">

**Built for Theme 11 — *From Court Judgments to Verified Action Plans*.**

*AI assists. Officers decide. Justice flows.*

</div>
