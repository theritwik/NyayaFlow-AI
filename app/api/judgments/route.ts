import { NextResponse } from 'next/server';
import { listJudgments } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = listJudgments();
  return NextResponse.json({ judgments: items });
}
