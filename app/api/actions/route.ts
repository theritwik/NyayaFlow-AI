import { NextResponse } from 'next/server';
import { listActions } from '@/lib/repo';
import type { ActionStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ALL_STATUSES = new Set<ActionStatus>([
  'Pending Review',
  'Approved',
  'Rejected',
  'Completed',
]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status') as ActionStatus | null;
  const filter: { status?: ActionStatus } = {};
  if (status && ALL_STATUSES.has(status)) filter.status = status;
  const actions = listActions(filter);
  return NextResponse.json({ actions });
}
