import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import {
  ConfidenceBadge,
  ProvenanceTag,
  StatusChip,
  UrgencyBadge,
} from '@/components/Badges';
import { EvidencePanel } from '@/components/EvidencePanel';
import { getAction, getJudgment, listAudit } from '@/lib/repo';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function ActionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  const action = getAction(id);
  if (!action) return notFound();
  const judgment = getJudgment(action.judgment_id);
  const history = listAudit(action.judgment_id).filter(
    (e) => e.entity_type === 'action' && e.entity_id === id
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Action item"
        subtitle="Detailed view with source evidence and full review history."
        crumbs={[
          { label: 'Overview', href: '/' },
          { label: 'Verified Dashboard', href: '/dashboard' },
          { label: `Action #${id}` },
        ]}
        actions={
          judgment ? (
            <Link href={`/review/${judgment.id}`} className="gov-btn-ghost">
              Open Review
            </Link>
          ) : null
        }
      />

      <section className="gov-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="gov-section-title mb-1">{action.action_type}</div>
            <h2 className="font-serif text-xl text-gov-navy">{action.title}</h2>
            {judgment && (
              <div className="text-sm text-gov-slate mt-1">
                From{' '}
                <Link href={`/review/${judgment.id}`} className="hover:underline">
                  {judgment.case_title || judgment.file_name}
                </Link>{' '}
                · {judgment.case_number || '—'}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <UrgencyBadge value={action.urgency} />
            <ConfidenceBadge value={action.confidence} />
            <StatusChip status={action.status} />
            <ProvenanceTag verified={action.status === 'Approved' || action.status === 'Completed'} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
          <Detail label="Department" value={action.department} />
          <Detail label="Due date" value={action.due_date || '—'} />
          <Detail
            label="Approved by"
            value={action.approved_by ? `${action.approved_by} · ${formatDateTime(action.approved_at)}` : '—'}
          />
        </div>

        <div className="mt-4">
          <div className="gov-section-title mb-1">Description</div>
          <p className="text-sm text-gov-deep">{action.description}</p>
        </div>

        {(action.ai_title !== action.title ||
          action.ai_description !== action.description ||
          action.ai_department !== action.department ||
          action.ai_due_date !== action.due_date) && (
          <div className="mt-4 border-t border-slate-200 pt-3">
            <div className="gov-section-title mb-2">Original AI suggestion</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm italic text-gov-slate">
              <div><strong>Title:</strong> {action.ai_title}</div>
              <div><strong>Department:</strong> {action.ai_department}</div>
              <div><strong>Due date:</strong> {action.ai_due_date ?? '—'}</div>
              <div className="md:col-span-2"><strong>Description:</strong> {action.ai_description}</div>
            </div>
          </div>
        )}

        <div className="mt-4">
          <EvidencePanel
            excerpt={action.source_excerpt}
            page={action.source_page}
            confidence={action.confidence}
            judgmentId={action.judgment_id}
            bbox={action.bbox}
          />
        </div>

        {action.reviewer_comment && (
          <div className="mt-3 text-sm text-gov-deep">
            <strong>Reviewer note:</strong> <span className="italic">{action.reviewer_comment}</span>
          </div>
        )}
      </section>

      <section className="gov-card">
        <div className="gov-card-header">
          <h2 className="gov-h2">Review history</h2>
        </div>
        <table className="gov-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Decision</th>
              <th>Reviewer</th>
              <th>Previous</th>
              <th>New</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td className="text-sm">{formatDateTime(h.timestamp)}</td>
                <td><StatusChip status={h.decision} /></td>
                <td className="text-sm">{h.reviewer}</td>
                <td className="text-sm text-gov-slate italic">{h.previous_value || '—'}</td>
                <td className="text-sm">{h.new_value || '—'}</td>
                <td className="text-sm">{h.comment || '—'}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gov-slate py-6">
                  No history yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="gov-section-title">{label}</div>
      <div className="text-sm text-gov-deep mt-0.5">{value}</div>
    </div>
  );
}
