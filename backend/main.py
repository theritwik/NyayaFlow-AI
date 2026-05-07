"""
NyayaFlow AI — Python processing service
=========================================

FastAPI service that handles the heavy PDF / OCR work for the Next.js
frontend.  It exposes:

* ``POST /process`` — read a PDF (digital) or run OCR (scanned), return
  per-page text + per-text-span bounding boxes that the frontend can use
  for highlighted source-evidence rendering.
* ``GET  /page``   — render a single PDF page as PNG (optionally with a
  highlight rectangle) so the frontend can show the original document
  page beside the AI-extracted excerpt.
* ``POST /extract`` — exposes the same modular extraction interface used
  by the Node side, with hooks for LayoutLMv3 / LLM extraction.
* ``GET  /health``  — liveness + capability flags.

Design notes
------------
* PDFs live on a shared filesystem (``data/uploads`` from the project
  root) so we can be called either with an uploaded file (multipart) or
  with a known relative path.
* OCR uses Tesseract via pytesseract.  If Tesseract isn't installed the
  service still runs — only scanned PDFs degrade gracefully.
* The extraction logic mirrors the Node mock+rule engine so both paths
  produce the same JSON shape.  When LayoutLMv3 / a real LLM is wired in,
  drop the implementation into ``run_layoutlm`` / ``run_llm``.
"""

from __future__ import annotations

import io
import os
import re
import shutil
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

import fitz  # PyMuPDF
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

# -- Optional Tesseract --------------------------------------------------------
try:
    import pytesseract
    from PIL import Image

    _TESSERACT_AVAILABLE = bool(shutil.which("tesseract"))
except Exception:  # pragma: no cover
    pytesseract = None  # type: ignore
    Image = None  # type: ignore
    _TESSERACT_AVAILABLE = False

# -- Paths --------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
UPLOADS_DIR = PROJECT_ROOT / "data" / "uploads"
SAMPLES_DIR = PROJECT_ROOT / "data" / "samples"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="NyayaFlow AI Processing Service",
    description=(
        "Python pipeline for PDF text extraction (PyMuPDF), OCR fallback "
        "(Tesseract), per-span bounding boxes, page rendering for "
        "highlighted evidence views, and a LayoutLMv3-pluggable extraction "
        "interface."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Schemas
# =============================================================================

class TextSpan(BaseModel):
    text: str
    page: int
    bbox: list[float]  # [x0, y0, x1, y1] in PDF user-space units


class PageInfo(BaseModel):
    page: int
    width: float
    height: float
    text: str
    spans: list[TextSpan]


class ProcessResponse(BaseModel):
    file_name: str
    stored_path: str
    page_count: int
    is_scanned: bool
    used_ocr: bool
    full_text: str
    pages: list[PageInfo]


class ExtractionField(BaseModel):
    field_key: str
    value: str
    confidence: float
    source_excerpt: str
    source_page: int
    bbox: Optional[list[float]] = None


class ExtractionAction(BaseModel):
    title: str
    action_type: str
    description: str
    department: str
    due_date: Optional[str] = None
    needs_officer_review: bool
    source_excerpt: str
    source_page: int
    bbox: Optional[list[float]] = None
    confidence: float
    urgency: str


class ExtractResponse(BaseModel):
    is_scanned: bool
    page_count: int
    fields: list[ExtractionField]
    actions: list[ExtractionAction]
    engine: str  # "mock" | "rule" | "layoutlm" | "llm"


# =============================================================================
# Health
# =============================================================================

@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "nyayaflow-python",
        "pymupdf": fitz.__doc__.splitlines()[0] if fitz.__doc__ else "PyMuPDF",
        "tesseract_available": _TESSERACT_AVAILABLE,
        "uploads_dir": str(UPLOADS_DIR),
    }


# =============================================================================
# /process — run PyMuPDF + OCR fallback, return spans + per-page text
# =============================================================================

def _resolve_path(rel_or_abs: str) -> Path:
    p = Path(rel_or_abs)
    if not p.is_absolute():
        p = (PROJECT_ROOT / rel_or_abs).resolve()
    if not p.exists():
        # Try uploads dir directly
        candidate = UPLOADS_DIR / Path(rel_or_abs).name
        if candidate.exists():
            return candidate
        raise HTTPException(status_code=404, detail=f"File not found: {rel_or_abs}")
    return p


def _process_pdf(pdf_path: Path) -> ProcessResponse:
    pages: list[PageInfo] = []
    used_ocr = False
    is_scanned = False
    full_chunks: list[str] = []

    with fitz.open(pdf_path) as doc:
        for i, page in enumerate(doc, start=1):
            spans: list[TextSpan] = []
            page_text_chunks: list[str] = []

            # 1) Try native text extraction with bounding boxes
            try:
                d = page.get_text("dict")
                for block in d.get("blocks", []):
                    if block.get("type", 0) != 0:  # 0 = text block
                        continue
                    for line in block.get("lines", []):
                        line_text_parts: list[str] = []
                        line_bbox = list(line.get("bbox", [0, 0, 0, 0]))
                        for span in line.get("spans", []):
                            t = span.get("text", "")
                            if not t.strip():
                                continue
                            spans.append(
                                TextSpan(
                                    text=t,
                                    page=i,
                                    bbox=list(span.get("bbox", line_bbox)),
                                )
                            )
                            line_text_parts.append(t)
                        if line_text_parts:
                            page_text_chunks.append(" ".join(line_text_parts))
            except Exception:
                pass

            page_text = "\n".join(page_text_chunks).strip()

            # 2) OCR fallback for low-text pages
            if len(page_text) < 50 and _TESSERACT_AVAILABLE and pytesseract and Image:
                used_ocr = True
                pix = page.get_pixmap(dpi=200)
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                try:
                    ocr_text = pytesseract.image_to_string(img) or ""
                except Exception:
                    ocr_text = ""
                if ocr_text.strip():
                    page_text = ocr_text.strip()
                    # Bounding boxes from OCR (best-effort)
                    try:
                        data = pytesseract.image_to_data(
                            img, output_type=pytesseract.Output.DICT
                        )
                        for k, txt in enumerate(data["text"]):
                            if not txt or not txt.strip():
                                continue
                            x = float(data["left"][k]) / pix.width * page.rect.width
                            y = float(data["top"][k]) / pix.height * page.rect.height
                            w = float(data["width"][k]) / pix.width * page.rect.width
                            h = float(data["height"][k]) / pix.height * page.rect.height
                            spans.append(
                                TextSpan(
                                    text=txt,
                                    page=i,
                                    bbox=[x, y, x + w, y + h],
                                )
                            )
                    except Exception:
                        pass

            if not page_text:
                is_scanned = True

            full_chunks.append(page_text)
            pages.append(
                PageInfo(
                    page=i,
                    width=page.rect.width,
                    height=page.rect.height,
                    text=page_text,
                    spans=spans,
                )
            )

    full_text = "\n\n".join(full_chunks).strip()
    return ProcessResponse(
        file_name=pdf_path.name,
        stored_path=str(pdf_path),
        page_count=len(pages),
        is_scanned=is_scanned and not used_ocr,
        used_ocr=used_ocr,
        full_text=full_text,
        pages=pages,
    )


def _process_text_fixture(txt_path: Path) -> ProcessResponse:
    """For .txt sample fixtures shipped with the demo."""
    text = txt_path.read_text(encoding="utf-8", errors="ignore")
    # Synthesise one or two pages so highlight overlays still work in the UI.
    chunks = re.split(r"\n\n(?=ORDER\b|\d+\.\s)", text)
    pages: list[PageInfo] = []
    spans: list[TextSpan] = []
    cursor = 0
    for i, ch in enumerate(chunks, start=1):
        spans_per_page: list[TextSpan] = []
        # Approximate bbox layout: each line gets a rect
        y = 80.0
        for line in ch.splitlines():
            if not line.strip():
                y += 14
                continue
            spans_per_page.append(
                TextSpan(
                    text=line,
                    page=i,
                    bbox=[60.0, y, 540.0, y + 14.0],
                )
            )
            y += 16.0
        cursor += len(ch)
        pages.append(
            PageInfo(
                page=i,
                width=612.0,
                height=792.0,
                text=ch.strip(),
                spans=spans_per_page,
            )
        )
        spans.extend(spans_per_page)

    if not pages:
        pages = [PageInfo(page=1, width=612.0, height=792.0, text=text, spans=[])]
    return ProcessResponse(
        file_name=txt_path.name,
        stored_path=str(txt_path),
        page_count=len(pages),
        is_scanned=False,
        used_ocr=False,
        full_text=text,
        pages=pages,
    )


@app.post("/process", response_model=ProcessResponse)
async def process(
    file: Optional[UploadFile] = File(default=None),
    path: Optional[str] = Query(default=None),
) -> ProcessResponse:
    """Process either an uploaded PDF or a relative path inside data/uploads."""
    if not file and not path:
        raise HTTPException(status_code=400, detail="Provide `file` or `path`.")

    if file:
        suffix = Path(file.filename or "uploaded.pdf").suffix or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = Path(tmp.name)
        try:
            if suffix.lower() == ".txt":
                return _process_text_fixture(tmp_path)
            return _process_pdf(tmp_path)
        finally:
            try:
                tmp_path.unlink()
            except OSError:
                pass

    assert path is not None
    p = _resolve_path(path)
    if p.suffix.lower() == ".txt":
        return _process_text_fixture(p)
    return _process_pdf(p)


# =============================================================================
# /page — render a PDF page as PNG, optionally with a highlight rectangle
# =============================================================================

@app.get("/page")
def render_page(
    path: str = Query(..., description="Relative path inside the project."),
    page: int = Query(1, ge=1),
    dpi: int = Query(140, ge=72, le=300),
    x0: Optional[float] = None,
    y0: Optional[float] = None,
    x1: Optional[float] = None,
    y1: Optional[float] = None,
) -> Response:
    """Render a PDF page (or a synthesised page for .txt fixtures) as PNG.

    If ``x0…y1`` are supplied, draw a yellow translucent rectangle at the
    given PDF user-space coordinates so the frontend can show a true
    highlight on the original page.
    """
    p = _resolve_path(path)

    if p.suffix.lower() == ".txt":
        png = _render_text_fixture_page(p, page, dpi, (x0, y0, x1, y1))
        return Response(content=png, media_type="image/png")

    with fitz.open(p) as doc:
        if page < 1 or page > doc.page_count:
            raise HTTPException(status_code=404, detail=f"Page {page} out of range (1..{doc.page_count}).")
        pg = doc.load_page(page - 1)
        if all(v is not None for v in (x0, y0, x1, y1)):
            rect = fitz.Rect(x0, y0, x1, y1)
            annot = pg.add_rect_annot(rect)
            annot.set_colors(stroke=(1.0, 0.85, 0.2), fill=(1.0, 0.85, 0.2))
            annot.set_opacity(0.35)
            annot.set_border(width=2)
            annot.update()
        pix = pg.get_pixmap(dpi=dpi, alpha=False)
        png = pix.tobytes("png")
    return Response(content=png, media_type="image/png")


def _render_text_fixture_page(
    txt_path: Path,
    page: int,
    dpi: int,
    bbox: tuple[Optional[float], ...],
) -> bytes:
    """Render a .txt fixture as a PDF-ish page with optional highlight."""
    proc = _process_text_fixture(txt_path)
    if page < 1 or page > len(proc.pages):
        raise HTTPException(status_code=404, detail=f"Page {page} out of range (1..{len(proc.pages)}).")
    pinfo = proc.pages[page - 1]

    doc = fitz.open()
    pdf_page = doc.new_page(width=pinfo.width, height=pinfo.height)
    # Header
    pdf_page.insert_text(
        (60, 50),
        f"NyayaFlow demo fixture: {txt_path.name} — page {page}/{len(proc.pages)}",
        fontsize=10,
        color=(0.2, 0.2, 0.2),
    )
    # Body text — keep simple monospace-ish output
    y = 80
    for line in pinfo.text.splitlines():
        if y > pinfo.height - 60:
            break
        pdf_page.insert_text((60, y), line[:110], fontsize=10, color=(0.05, 0.1, 0.2))
        y += 14
    # Highlight rectangle
    if all(v is not None for v in bbox):
        rect = fitz.Rect(*[float(b) for b in bbox])  # type: ignore[arg-type]
        annot = pdf_page.add_rect_annot(rect)
        annot.set_colors(stroke=(1.0, 0.85, 0.2), fill=(1.0, 0.85, 0.2))
        annot.set_opacity(0.35)
        annot.set_border(width=2)
        annot.update()
    pix = pdf_page.get_pixmap(dpi=dpi, alpha=False)
    png = pix.tobytes("png")
    doc.close()
    return png


# =============================================================================
# /extract — pluggable extraction (mock + rule-based; LayoutLM/LLM wired off)
# =============================================================================

class ExtractRequest(BaseModel):
    text: str
    file_name: str
    page_count: int
    is_scanned: bool


def _iso_in_days(n: int) -> str:
    return (datetime.now() + timedelta(days=n)).date().isoformat()


def _curated_sample(file_name: str) -> Optional[ExtractResponse]:
    """Mirror of the Node curated mock so both engines agree on samples."""
    lower = file_name.lower()
    if "sample-1" in lower or "representation" in lower:
        return ExtractResponse(
            is_scanned=False,
            page_count=8,
            engine="mock",
            fields=[
                ExtractionField(
                    field_key="case_title",
                    value="Anita Kumari vs State of Bihar & Ors.",
                    confidence=0.97,
                    source_excerpt=(
                        "IN THE HIGH COURT OF JUDICATURE AT PATNA — Anita Kumari "
                        "(Petitioner) versus State of Bihar & Ors."
                    ),
                    source_page=1,
                ),
                ExtractionField(
                    field_key="case_number",
                    value="CWJC No. 4521 of 2025",
                    confidence=0.96,
                    source_excerpt="Civil Writ Jurisdiction Case No. 4521 of 2025",
                    source_page=1,
                ),
                ExtractionField(
                    field_key="court_name",
                    value="High Court of Judicature at Patna",
                    confidence=0.98,
                    source_excerpt="IN THE HIGH COURT OF JUDICATURE AT PATNA",
                    source_page=1,
                ),
                ExtractionField(
                    field_key="order_date",
                    value="2026-04-22",
                    confidence=0.94,
                    source_excerpt="Pronounced on the 22nd day of April, 2026",
                    source_page=1,
                ),
                ExtractionField(
                    field_key="key_direction",
                    value=(
                        "Department of Revenue & Land Reforms shall consider the "
                        "representation within six weeks by passing a reasoned and "
                        "speaking order."
                    ),
                    confidence=0.92,
                    source_excerpt=(
                        "Department of Revenue & Land Reforms shall consider … "
                        "within a period of six weeks … by passing a reasoned and "
                        "speaking order."
                    ),
                    source_page=5,
                ),
                ExtractionField(
                    field_key="urgency",
                    value="High",
                    confidence=0.86,
                    source_excerpt="time-bound direction (6 weeks)",
                    source_page=5,
                ),
            ],
            actions=[
                ExtractionAction(
                    title="Decide representation of Anita Kumari dated 11.02.2026 by reasoned order",
                    action_type="Compliance",
                    description=(
                        "Department of Revenue & Land Reforms must consider the "
                        "representation and pass a reasoned and speaking order "
                        "within 6 weeks. The order must be communicated to the "
                        "petitioner. Maintain a copy on file for compliance affidavit."
                    ),
                    department="Department of Revenue & Land Reforms",
                    due_date=_iso_in_days(42),
                    needs_officer_review=False,
                    source_excerpt=(
                        "shall consider the representation within six weeks by "
                        "passing a reasoned and speaking order."
                    ),
                    source_page=5,
                    confidence=0.9,
                    urgency="High",
                ),
                ExtractionAction(
                    title="Communicate decision to petitioner and place on record",
                    action_type="Information Update",
                    description=(
                        "Communicate the speaking order to the petitioner via "
                        "registered post and place a copy on the case file."
                    ),
                    department="Department of Revenue & Land Reforms",
                    due_date=_iso_in_days(45),
                    needs_officer_review=False,
                    source_excerpt="and communicate the same to the petitioner.",
                    source_page=6,
                    confidence=0.85,
                    urgency="Medium",
                ),
                ExtractionAction(
                    title="Evaluate need for appeal/review against this order",
                    action_type="Appeal Consideration",
                    description=(
                        "Legal cell to examine whether the State should consider "
                        "review/appeal within statutory limitation. Standard "
                        "limitation for review is 30 days."
                    ),
                    department="Legal Cell, Department of Revenue & Land Reforms",
                    due_date=_iso_in_days(28),
                    needs_officer_review=True,
                    source_excerpt="No appeal direction issued; State may evaluate independently.",
                    source_page=7,
                    confidence=0.6,
                    urgency="Medium",
                ),
            ],
        )
    if "sample-2" in lower or "affidavit" in lower:
        return ExtractResponse(
            is_scanned=False,
            page_count=6,
            engine="mock",
            fields=[
                ExtractionField(
                    field_key="case_title",
                    value="Mohan Lal vs Union of India & Anr.",
                    confidence=0.95,
                    source_excerpt="Mohan Lal … versus Union of India & Anr.",
                    source_page=1,
                ),
                ExtractionField(
                    field_key="case_number",
                    value="W.P.(C) 7843/2025",
                    confidence=0.97,
                    source_excerpt="Writ Petition (Civil) No. 7843 of 2025",
                    source_page=1,
                ),
                ExtractionField(
                    field_key="key_direction",
                    value=(
                        "Respondents directed to file a compliance affidavit "
                        "within 30 days from today."
                    ),
                    confidence=0.94,
                    source_excerpt="file a compliance affidavit … within 30 days from today.",
                    source_page=4,
                ),
                ExtractionField(
                    field_key="urgency",
                    value="High",
                    confidence=0.9,
                    source_excerpt="30-day filing window",
                    source_page=4,
                ),
            ],
            actions=[
                ExtractionAction(
                    title="File compliance affidavit before Hon'ble High Court",
                    action_type="Compliance",
                    description=(
                        "Prepare and file a compliance affidavit detailing actions "
                        "taken on the petitioner's grievance dated 02.01.2026. "
                        "Must be sworn by an officer not below Deputy Secretary."
                    ),
                    department="Ministry of Home Affairs",
                    due_date=_iso_in_days(30),
                    needs_officer_review=False,
                    source_excerpt="file a compliance affidavit … within 30 days from today.",
                    source_page=4,
                    confidence=0.93,
                    urgency="High",
                ),
                ExtractionAction(
                    title="Assign nodal officer for affidavit preparation",
                    action_type="Department Review",
                    description=(
                        "Identify and assign a Deputy Secretary level officer to "
                        "coordinate with the standing counsel for affidavit drafting "
                        "and filing."
                    ),
                    department="Ministry of Home Affairs (Coordination)",
                    due_date=_iso_in_days(7),
                    needs_officer_review=False,
                    source_excerpt="Affidavit must be sworn by an officer not below Deputy Secretary rank.",
                    source_page=4,
                    confidence=0.82,
                    urgency="High",
                ),
                ExtractionAction(
                    title="Track next date of hearing and circulate cause-list entry",
                    action_type="Deadline Tracking",
                    description=(
                        "Set internal reminder 5 days before next listing; share "
                        "affidavit copy with standing counsel 7 days in advance."
                    ),
                    department="Ministry of Home Affairs (Litigation)",
                    due_date=_iso_in_days(25),
                    needs_officer_review=False,
                    source_excerpt="List on the next date of hearing.",
                    source_page=5,
                    confidence=0.78,
                    urgency="Medium",
                ),
            ],
        )
    if "sample-3" in lower or "scanned" in lower:
        return ExtractResponse(
            is_scanned=True,
            page_count=11,
            engine="mock",
            fields=[
                ExtractionField(
                    field_key="case_title",
                    value="Sundaram & Sons vs Tamil Nadu Pollution Control Board",
                    confidence=0.61,
                    source_excerpt="Sundar?m & Sons … T.N. Pollut?on Control B?ard",
                    source_page=1,
                ),
                ExtractionField(
                    field_key="urgency",
                    value="Medium",
                    confidence=0.45,
                    source_excerpt="no specific timeline detected",
                    source_page=7,
                ),
            ],
            actions=[
                ExtractionAction(
                    title="Officer review required — direction phrasing is open-ended",
                    action_type="Department Review",
                    description=(
                        "The court direction is open-ended and the scan quality is "
                        "poor. An officer must read the original judgment, identify "
                        "the specific action expected, and assign a deadline."
                    ),
                    department="Tamil Nadu Pollution Control Board (please verify)",
                    due_date=None,
                    needs_officer_review=True,
                    source_excerpt="Board to examine the report and take such action as deemed appropriate.",
                    source_page=7,
                    confidence=0.55,
                    urgency="Medium",
                ),
                ExtractionAction(
                    title="Re-OCR or request clean copy of judgment",
                    action_type="Information Update",
                    description=(
                        "Request a clearer certified copy from the registry; current "
                        "scan has multiple illegible fields including case number "
                        "and order date."
                    ),
                    department="Litigation Cell",
                    due_date=None,
                    needs_officer_review=True,
                    source_excerpt="Multiple OCR low-confidence regions on cover page.",
                    source_page=1,
                    confidence=0.5,
                    urgency="Low",
                ),
            ],
        )
    return None


def _rule_based(text: str, page_count: int) -> ExtractResponse:
    fields: list[ExtractionField] = []
    actions: list[ExtractionAction] = []
    if not text or len(text.strip()) < 80:
        return ExtractResponse(
            is_scanned=False, page_count=page_count or 1, engine="rule",
            fields=fields, actions=actions,
        )

    case_num = re.search(
        r"\b((?:W\.?P\.?\s*\(?[A-Z]\)?|S\.?L\.?P\.?|Crl\.?A\.?|C\.?A\.?|R\.?P\.?|CWJC)[\s.()A-Z]*\s*\d{1,6}\s*[/]\s*\d{4})",
        text, re.IGNORECASE,
    )
    if case_num:
        fields.append(ExtractionField(
            field_key="case_number", value=case_num.group(1),
            confidence=0.92, source_excerpt=case_num.group(0), source_page=1,
        ))

    court = re.search(r"(IN THE [A-Z][A-Z\s,]+COURT[A-Z\s,]*)", text)
    if court:
        fields.append(ExtractionField(
            field_key="court_name",
            value=re.sub(r"\s+", " ", court.group(1)).strip(),
            confidence=0.9, source_excerpt=court.group(0), source_page=1,
        ))

    vs = re.search(
        r"([A-Z][A-Za-z .&]{2,80})\s+(?:vs\.?|versus|v\.)\s+([A-Z][A-Za-z .&]{2,80})",
        text,
    )
    if vs:
        fields.append(ExtractionField(
            field_key="case_title",
            value=f"{vs.group(1).strip()} vs {vs.group(2).strip()}",
            confidence=0.86, source_excerpt=vs.group(0), source_page=1,
        ))

    for m in list(re.finditer(r"within\s+(\d+)\s+(weeks?|days?|months?)", text, re.IGNORECASE))[:3]:
        idx = m.start()
        excerpt = re.sub(r"\s+", " ", text[max(0, idx - 60): idx + 140])
        n = int(m.group(1))
        unit = m.group(2).lower()
        days = n * (1 if unit.startswith("day") else 7 if unit.startswith("week") else 30)
        actions.append(ExtractionAction(
            title="Compliance action required",
            action_type="Compliance",
            description=excerpt,
            department="Concerned Department (please verify)",
            due_date=_iso_in_days(days),
            needs_officer_review=False,
            source_excerpt=excerpt,
            source_page=min(2, page_count or 1),
            confidence=0.74,
            urgency="High",
        ))

    if re.search(r"urgent|forthwith|immediately|without\s+delay", text, re.IGNORECASE):
        fields.append(ExtractionField(
            field_key="urgency", value="High", confidence=0.7,
            source_excerpt="urgent language detected", source_page=1,
        ))
    else:
        fields.append(ExtractionField(
            field_key="urgency", value="Medium", confidence=0.55,
            source_excerpt="no urgent language detected", source_page=1,
        ))

    return ExtractResponse(
        is_scanned=False, page_count=page_count or 1, engine="rule",
        fields=fields, actions=actions,
    )


def run_layoutlm(_req: ExtractRequest) -> ExtractResponse:
    """LayoutLMv3 hook.  Disabled by default.

    Implementation outline (when you have GPU/checkpoint):

        from transformers import LayoutLMv3ForTokenClassification, LayoutLMv3Processor
        proc = LayoutLMv3Processor.from_pretrained("microsoft/layoutlmv3-base")
        model = LayoutLMv3ForTokenClassification.from_pretrained("<your-finetune>")
        # feed token bboxes + page image, run inference, map labels to fields.

    Set ``NYAYAFLOW_LAYOUTLM_ENABLED=true`` to opt-in once that's in place.
    """
    raise NotImplementedError("LayoutLMv3 is not configured in this build.")


def run_llm(_req: ExtractRequest) -> ExtractResponse:
    """OpenAI/Gemini/Anthropic hook.  Disabled by default."""
    raise NotImplementedError("LLM extraction not configured.")


@app.post("/extract", response_model=ExtractResponse)
def extract(req: ExtractRequest) -> ExtractResponse:
    if os.environ.get("NYAYAFLOW_LAYOUTLM_ENABLED") == "true":
        try:
            return run_layoutlm(req)
        except Exception as e:  # pragma: no cover
            print(f"LayoutLM failed, falling back: {e}")
    if os.environ.get("NYAYAFLOW_LLM_ENABLED") == "true":
        try:
            return run_llm(req)
        except Exception as e:  # pragma: no cover
            print(f"LLM failed, falling back: {e}")

    curated = _curated_sample(req.file_name)
    if curated:
        curated.engine = "mock"
        return curated

    rule = _rule_based(req.text, req.page_count)
    if rule.fields:
        return rule

    return ExtractResponse(
        is_scanned=req.is_scanned,
        page_count=req.page_count or 1,
        engine="mock",
        fields=[],
        actions=[],
    )


@app.get("/")
def index() -> JSONResponse:
    return JSONResponse(
        {
            "service": "NyayaFlow AI Processing Service",
            "endpoints": ["/health", "/process", "/page", "/extract"],
        }
    )


# Allow `python backend/main.py` for quick local runs.
if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
        reload=True,
    )
