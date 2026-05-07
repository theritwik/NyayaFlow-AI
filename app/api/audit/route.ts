import { NextResponse } from 'next/server';
import { listAudit } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const judgmentId = url.searchParams.get('judgmentId');
  const entries = listAudit(judgmentId ? Number(judgmentId) : undefined);
  return NextResponse.json({ entries });
}
