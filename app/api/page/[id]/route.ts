// Proxies the Python service's /page endpoint.  Renders the original PDF
// page (or a synthesised page for .txt fixtures) as PNG, optionally with a
// translucent yellow highlight rectangle drawn at the supplied bbox.
//
// Failure modes return non-200 status codes so the PdfHighlight component
// can show a clear, actionable message instead of a silently-blank image.

import { NextResponse } from 'next/server';
import path from 'node:path';
import { getJudgment } from '@/lib/repo';
import { pyAvailable, pyServiceUrl } from '@/lib/pyclient';

export const dynamic = 'force-dynamic';

function err(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: code, message, hint: hintFor(code) },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

function hintFor(code: string): string {
  switch (code) {
    case 'python_offline':
      return 'Start the Python service in a separate terminal:  npm run py:dev';
    case 'no_source_file':
      return 'Re-upload this judgment, or click "Load demo data" on the home page to refresh sample paths.';
    case 'python_error':
      return 'Check the FastAPI console for a stack trace.  Often a missing PDF page index or a bad bbox.';
    default:
      return 'See README → Quick Start.';
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const judgmentId = Number(params.id);
  const judgment = getJudgment(judgmentId);
  if (!judgment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!judgment.stored_path) {
    return err(503, 'no_source_file', 'No stored source file for this judgment.');
  }

  const url = new URL(req.url);
  const page = url.searchParams.get('page') || '1';
  const x0 = url.searchParams.get('x0');
  const y0 = url.searchParams.get('y0');
  const x1 = url.searchParams.get('x1');
  const y1 = url.searchParams.get('y1');

  if (!(await pyAvailable())) {
    return err(
      503,
      'python_offline',
      'Python processing service (PyMuPDF + Tesseract) is not reachable on port 8000.'
    );
  }

  const rel = path.relative(process.cwd(), judgment.stored_path);
  const pyUrl = new URL(`${pyServiceUrl()}/page`);
  pyUrl.searchParams.set('path', rel);
  pyUrl.searchParams.set('page', page);
  if (x0 && y0 && x1 && y1) {
    pyUrl.searchParams.set('x0', x0);
    pyUrl.searchParams.set('y0', y0);
    pyUrl.searchParams.set('x1', x1);
    pyUrl.searchParams.set('y1', y1);
  }

  try {
    const res = await fetch(pyUrl.toString(), {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return err(
        502,
        'python_error',
        `Python /page returned ${res.status}: ${text.slice(0, 200)}`
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (e: any) {
    return err(
      502,
      'python_error',
      e?.message || 'Failed to reach Python service.'
    );
  }
}
