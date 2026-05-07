// Bridge from Next.js to the Python FastAPI processing service.
// If the service is up, the Node side delegates PyMuPDF / Tesseract / page
// rendering to it.  If the service is down, callers fall back to the local
// pdf-parse path.

import path from 'node:path';
import type { ExtractionResult } from './types';

const BASE = process.env.NYAYAFLOW_PY_URL || 'http://127.0.0.1:8000';

export interface PyTextSpan {
  text: string;
  page: number;
  bbox: [number, number, number, number];
}

export interface PyPage {
  page: number;
  width: number;
  height: number;
  text: string;
  spans: PyTextSpan[];
}

export interface PyProcessResult {
  file_name: string;
  stored_path: string;
  page_count: number;
  is_scanned: boolean;
  used_ocr: boolean;
  full_text: string;
  pages: PyPage[];
}

let cachedHealth: { ok: boolean; checked: number } | null = null;

// Cache positive results longer (Python is steady), but recheck "down" almost
// immediately so the demo recovers fast after the user starts the service.
const POSITIVE_TTL_MS = 10_000;
const NEGATIVE_TTL_MS = 1_500;

export async function pyAvailable(): Promise<boolean> {
  const now = Date.now();
  if (cachedHealth) {
    const ttl = cachedHealth.ok ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
    if (now - cachedHealth.checked < ttl) return cachedHealth.ok;
  }
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(800) });
    const ok = res.ok;
    cachedHealth = { ok, checked: now };
    return ok;
  } catch {
    cachedHealth = { ok: false, checked: now };
    return false;
  }
}

/** Process a PDF/.txt fixture via the Python service.  Returns null on failure. */
export async function pyProcess(absPath: string): Promise<PyProcessResult | null> {
  if (!(await pyAvailable())) return null;
  // Pass relative path so Python can resolve from project root.
  const rel = path.relative(process.cwd(), absPath);
  try {
    const res = await fetch(
      `${BASE}/process?path=${encodeURIComponent(rel)}`,
      { method: 'POST', signal: AbortSignal.timeout(30_000) }
    );
    if (!res.ok) return null;
    return (await res.json()) as PyProcessResult;
  } catch (e) {
    console.warn('pyProcess failed:', e);
    return null;
  }
}

/** Run extraction via the Python service.  Returns null on failure. */
export async function pyExtract(input: {
  text: string;
  fileName: string;
  pageCount: number;
  isScanned: boolean;
}): Promise<ExtractionResult | null> {
  if (!(await pyAvailable())) return null;
  try {
    const res = await fetch(`${BASE}/extract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: input.text,
        file_name: input.fileName,
        page_count: input.pageCount,
        is_scanned: input.isScanned,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const py = (await res.json()) as {
      is_scanned: boolean;
      page_count: number;
      engine: string;
      fields: Array<{
        field_key: string;
        value: string;
        confidence: number;
        source_excerpt: string;
        source_page: number;
        bbox: [number, number, number, number] | null;
      }>;
      actions: Array<{
        title: string;
        action_type: string;
        description: string;
        department: string;
        due_date: string | null;
        needs_officer_review: boolean;
        source_excerpt: string;
        source_page: number;
        bbox: [number, number, number, number] | null;
        confidence: number;
        urgency: string;
      }>;
    };
    return {
      is_scanned: py.is_scanned,
      page_count: py.page_count,
      fields: py.fields.map((f) => ({
        field_key: f.field_key,
        value: f.value,
        confidence: f.confidence,
        source_excerpt: f.source_excerpt,
        source_page: f.source_page,
      })),
      actions: py.actions.map((a) => ({
        title: a.title,
        action_type: a.action_type as ExtractionResult['actions'][number]['action_type'],
        description: a.description,
        department: a.department,
        due_date: a.due_date,
        needs_officer_review: a.needs_officer_review,
        source_excerpt: a.source_excerpt,
        source_page: a.source_page,
        confidence: a.confidence,
        urgency: a.urgency as ExtractionResult['actions'][number]['urgency'],
      })),
    };
  } catch (e) {
    console.warn('pyExtract failed:', e);
    return null;
  }
}

export function pyServiceUrl(): string {
  return BASE;
}
