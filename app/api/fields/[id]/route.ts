import { NextResponse } from 'next/server';
import { getField, logAudit, updateField } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const existing = getField(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await req.json()) as {
    decision: 'Approved' | 'Edited' | 'Rejected';
    new_value?: string;
    comment?: string;
    reviewer?: string;
  };
  const reviewer = body.reviewer || 'demo.officer';

  const previous = existing.current_value;
  let nextValue = previous;
  let status: 'Approved' | 'Edited' | 'Rejected' = body.decision;

  if (body.decision === 'Approved') {
    status = 'Approved';
  } else if (body.decision === 'Edited') {
    nextValue = body.new_value ?? previous;
    status = 'Edited';
  } else {
    status = 'Rejected';
  }

  updateField(id, {
    current_value: nextValue,
    status,
    reviewer_comment: body.comment ?? existing.reviewer_comment ?? '',
  });

  logAudit({
    judgment_id: existing.judgment_id,
    entity_type: 'field',
    entity_id: id,
    field_key: existing.field_key,
    ai_value: existing.ai_value,
    previous_value: previous,
    new_value: nextValue,
    confidence: existing.confidence,
    decision: status,
    reviewer,
    comment: body.comment ?? null,
  });

  return NextResponse.json({ ok: true });
}
