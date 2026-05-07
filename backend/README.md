# NyayaFlow Python Backend

FastAPI service that performs the heavy PDF/OCR work for the Next.js frontend.

## Components

- **PyMuPDF (`fitz`)** — text extraction with per-span bounding boxes; page rendering with annotation overlays for the highlighted-evidence view.
- **Tesseract** via `pytesseract` — OCR fallback for scanned pages (per-word bounding boxes preserved).
- **Pluggable NLP** — `/extract` runs curated-mock + rule-based extraction; `run_layoutlm` and `run_llm` are wired hooks (disabled by default) for LayoutLMv3 / LLM upgrades.

## Run

```bash
# 1. Install Python deps
python3 -m pip install -r backend/requirements.txt

# 2. (Optional) Verify Tesseract — required for OCR on scanned PDFs
tesseract --version

# 3. Start the service (port 8000 by default)
python3 -m uvicorn backend.main:app --reload --port 8000
```

The Next.js frontend will discover the service at `http://127.0.0.1:8000` (override with `NYAYAFLOW_PY_URL`). When the service is **down**, the Node side falls back to its built-in `pdf-parse` + curated-mock pipeline so demos still work.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET  | `/health` | Liveness + capability flags (`tesseract_available`, `pymupdf` version). |
| POST | `/process` | Multipart PDF **or** `?path=` to a file under `data/uploads/`. Returns per-page text + per-span bounding boxes. Auto-falls-through to OCR when native text < 50 chars. |
| GET  | `/page` | Render a PDF page as PNG. Optional `x0,y0,x1,y1` query params draw a translucent yellow highlight rectangle on the original page. |
| POST | `/extract` | Run extraction on raw text. Tries LayoutLMv3 → LLM → curated mock → rule-based, in that order. |

## LayoutLMv3 hook

`run_layoutlm(req)` in `backend/main.py` is the integration point. Outline:

```python
from transformers import LayoutLMv3ForTokenClassification, LayoutLMv3Processor
proc = LayoutLMv3Processor.from_pretrained("microsoft/layoutlmv3-base")
model = LayoutLMv3ForTokenClassification.from_pretrained("<your-finetune>")
# feed token bboxes + page image → run inference → map labels to fields.
```

Enable with `NYAYAFLOW_LAYOUTLM_ENABLED=true`.

## LLM hook

`run_llm(req)` is the second integration point. Use the `LLM_SYSTEM_PROMPT` from `lib/extraction.ts` (Node side) or replicate it here. Enable with `NYAYAFLOW_LLM_ENABLED=true`.
