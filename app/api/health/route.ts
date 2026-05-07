// Lightweight health endpoint used by Render's healthCheckPath.
// Reports liveness of both the Node side and the Python service.

import { NextResponse } from 'next/server';
import { pyAvailable, pyServiceUrl } from '@/lib/pyclient';

export const dynamic = 'force-dynamic';

export async function GET() {
  const py = await pyAvailable();
  return NextResponse.json(
    {
      ok: true,
      service: 'nyayaflow-next',
      python: { reachable: py, url: pyServiceUrl() },
      time: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
