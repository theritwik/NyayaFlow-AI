// PDF text extraction with OCR fallback.
//
// Primary path:  delegates to the Python FastAPI service (PyMuPDF + Tesseract
//                via lib/pyclient.ts).  Returns per-page text plus per-span
//                bounding boxes that drive the highlighted evidence view.
// Fallback path: pdf-parse on the Node side, which still works when the
//                Python service is offline.

import fs from 'node:fs/promises';
import { pyProcess, type PyPage } from './pyclient';

export interface PdfParseOutput {
  text: string;
  pageCount: number;
  isScanned: boolean;
  pages?: PyPage[]; // present when the Python service handled the file
  usedOcr?: boolean;
  source: 'python' | 'pdf-parse' | 'txt' | 'none';
}

export async function parsePdf(filePath: string): Promise<PdfParseOutput> {
  // 1. Try the Python service first — it handles digital PDFs (PyMuPDF) AND
  //    scanned PDFs (Tesseract OCR), and returns per-span bounding boxes.
  const py = await pyProcess(filePath);
  if (py) {
    return {
      text: py.full_text,
      pageCount: py.page_count,
      isScanned: py.is_scanned,
      pages: py.pages,
      usedOcr: py.used_ocr,
      source: 'python',
    };
  }

  // 2. .txt fixtures (Node fallback) — treat as already-extracted plain text.
  if (/\.txt$/i.test(filePath)) {
    const text = await fs.readFile(filePath, 'utf8');
    return {
      text,
      pageCount: Math.max(1, Math.ceil(text.length / 1800)),
      isScanned: false,
      source: 'txt',
    };
  }

  // 3. Node pdf-parse fallback for digital PDFs.
  try {
    const buf = await fs.readFile(filePath);
    const mod: any = await import('pdf-parse/lib/pdf-parse.js');
    const pdfParse = mod.default ?? mod;
    const result = await pdfParse(buf);
    const text = (result.text || '').trim();
    const pageCount = result.numpages || 1;
    const isScanned = text.length < 200;
    return {
      text: isScanned ? '' : text,
      pageCount,
      isScanned,
      source: 'pdf-parse',
    };
  } catch (e) {
    console.warn('parsePdf failed, treating as scanned:', e);
    return {
      text: '',
      pageCount: 0,
      isScanned: true,
      source: 'none',
    };
  }
}

/**
 * Walk the per-page spans returned by the Python service and find a minimal
 * bounding box that covers the supplied excerpt.  Used to enrich extracted
 * fields/actions so the highlight overlay shows the real region.
 */
export function findBboxForExcerpt(
  pages: PyPage[] | undefined,
  excerpt: string,
  pageNo: number
): [number, number, number, number] | null {
  if (!pages || !excerpt) return null;
  const page = pages.find((p) => p.page === pageNo) || pages[pageNo - 1];
  if (!page || !page.spans?.length) return null;

  const norm = (s: string) =>
    s.replace(/[“”"'’]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const target = norm(excerpt);
  if (target.length < 4) return null;

  // Try direct word matches first.  We scan for any 3-word window from the
  // excerpt that appears in the spans, then merge contiguous spans into a
  // bounding rectangle.
  const targetWords = target.split(' ').filter((w) => w.length > 2);
  if (targetWords.length === 0) return null;

  const matchedSpans = page.spans.filter((s) => {
    const txt = norm(s.text);
    if (!txt) return false;
    return targetWords.some((w) => txt.includes(w));
  });

  if (matchedSpans.length === 0) return null;

  const xs = matchedSpans.flatMap((s) => [s.bbox[0], s.bbox[2]]);
  const ys = matchedSpans.flatMap((s) => [s.bbox[1], s.bbox[3]]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const x1 = Math.max(...xs);
  const y1 = Math.max(...ys);
  // Sanity check: width/height should be > 1
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  // Pad slightly for visual breathing room
  return [x0 - 2, y0 - 2, x1 + 2, y1 + 2];
}
