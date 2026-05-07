import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/Badges';
import { listAudit, listJudgments } from '@/lib/repo';
import { formatDateTime } from '@/lib/utils';
import { JudgmentSelect } from './JudgmentSelect';

export const dynamic = 'force-dynamic';

export default function AuditPage({
  searchParams,
}: {
  searchParams: { judgmentId?: string };
}) {
  const judgmentId = searchParams.judgmentId
    ? Number(searchParams.judgmentId)
    : undefined;
  const entries = listAudit(judgmentId);
  const judgments = listJudgments();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Trail"
        subtitle="Every AI extraction and human action is logged here for compliance and traceability."
        crumbs={[{ label: 'Overview', href: '/' }, { label: 'Audit Trail' }]}
        actions={<JudgmentSelect judgments={judgments} current={judgmentId} />}
      />

      <section className="gov-card">
        <table className="gov-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Judgment</th>
              <th>Entity</th>
              <th>Field</th>
              <th>AI value</th>
              <th>Previous → New</th>
              <th>Decision</th>
              <th>Reviewer</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="text-sm">{formatDateTime(e.timestamp)}</td>
                <td className="text-sm">
                  <Link className="hover:underline" href={`/review/${e.judgment_id}`}>
                    #{e.judgment_id}
                  </Link>
                </td>
                <td className="text-sm">{e.entity_type}#{e.entity_id || '—'}</td>
                <td className="text-sm font-mono text-[12px]">{e.field_key || '—'}</td>
                <td className="text-sm italic text-gov-slate">{e.ai_value || '—'}</td>
                <td className="text-sm">
                  <span className="text-gov-slate italic">{e.previous_value || '—'}</span>{' '}
                  <span className="text-slate-400">→</span>{' '}
                  <span>{e.new_value || '—'}</span>
                </td>
                <td><StatusChip status={e.decision} /></td>
                <td className="text-sm">{e.reviewer}</td>
                <td className="text-sm">{e.comment || '—'}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-gov-slate py-8">
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
