import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip, UrgencyBadge, ConfidenceBadge } from '@/components/Badges';
import { getJudgment, listActions, listFields } from '@/lib/repo';
import { formatDate } from '@/lib/utils';
import { ReviewBoard } from './ReviewBoard';

export const dynamic = 'force-dynamic';

export default function ReviewPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const j = getJudgment(id);
  if (!j) return notFound();
  const fields = listFields(id);
  const actions = listActions({ judgmentId: id });
  const pendingFields = fields.filter((f) => f.status === 'Pending Review').length;
  const pendingActions = actions.filter((a) => a.status === 'Pending Review').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Human Review"
        subtitle="Verify each AI-extracted field and each suggested action. Approved items will move to the Verified Dashboard."
        crumbs={[
          { label: 'Overview', href: '/' },
          { label: 'Judgments', href: '/judgments' },
          { label: `Review #${id}` },
        ]}
      />

      <section className="gov-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="gov-section-title mb-1">Case</div>
            <h2 className="font-serif text-xl text-gov-navy">
              {j.case_title || j.file_name}
            </h2>
            <div className="text-sm text-gov-slate mt-1">
              {j.case_number || '—'} · {j.court_name || '—'} ·{' '}
              {formatDate(j.order_date)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusChip status={j.status} />
            {j.urgency && <UrgencyBadge value={j.urgency} />}
            {typeof j.overall_confidence === 'number' && (
              <ConfidenceBadge value={j.overall_confidence} />
            )}
            <div className="text-[12px] text-gov-slate">
              {pendingFields} fields, {pendingActions} actions awaiting review
            </div>
          </div>
        </div>
      </section>

      <ReviewBoard judgmentId={id} fields={fields} actions={actions} />
    </div>
  );
}
