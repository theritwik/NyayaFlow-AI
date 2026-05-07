import { NextResponse } from 'next/server';
import { getAction, logAudit, updateAction } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const existing = getAction(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json()) as {
    decision: 'Approved' | 'Rejected' | 'Completed' | 'Edited';
    title?: string;
    description?: string;
    department?: string;
    due_date?: string | null;
    needs_officer_review?: boolean;
    comment?: string;
    reviewer?: string;
  };
  const reviewer = body.reviewer || 'demo.officer';

  const patch: Parameters<typeof updateAction>[1] = {
    title: body.title ?? existing.title,
    description: body.description ?? existing.description,
    department: body.department ?? existing.department,
    due_date: body.due_date === undefined ? existing.due_date : body.due_date,
    needs_officer_review:
      body.needs_officer_review === undefined
        ? existing.needs_officer_review
        : body.needs_officer_review
          ? 1
          : 0,
    reviewer_comment: body.comment ?? existing.reviewer_comment ?? '',
  };

  if (body.decision === 'Approved') {
    patch.status = 'Approved';
    patch.approved_by = reviewer;
  } else if (body.decision === 'Rejected') {
    patch.status = 'Rejected';
  } else if (body.decision === 'Completed') {
    patch.status = 'Completed';
  } else if (body.decision === 'Edited') {
    patch.status = existing.status === 'Pending Review' ? 'Pending Review' : existing.status;
  }

  updateAction(id, patch);

  logAudit({
    judgment_id: existing.judgment_id,
    entity_type: 'action',
    entity_id: id,
    field_key: null,
    ai_value: existing.ai_title,
    previous_value: existing.title,
    new_value: patch.title ?? existing.title,
    confidence: existing.confidence,
    decision: body.decision,
    reviewer,
    comment: body.comment ?? null,
  });

  return NextResponse.json({ ok: true });
}
