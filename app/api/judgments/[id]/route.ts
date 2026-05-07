import { NextResponse } from 'next/server';
import { getJudgment, listActions, listFields } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const j = getJudgment(id);
  if (!j) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    judgment: j,
    fields: listFields(id),
    actions: listActions({ judgmentId: id }),
  });
}
