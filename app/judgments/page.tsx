import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip, UrgencyBadge, ConfidenceBadge } from '@/components/Badges';
import { listJudgments, listActions } from '@/lib/repo';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function JudgmentsPage() {
  const judgments = listJudgments();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Judgments"
        subtitle="Every uploaded judgment, its current review state, and its action plan progress."
        crumbs={[{ label: 'Overview', href: '/' }, { label: 'Judgments' }]}
        actions={
          <Link href="/upload" className="gov-btn-primary">
            Upload new
          </Link>
        }
      />

      <section className="gov-card">
        <table className="gov-table">
          <thead>
            <tr>
              <th>Case</th>
              <th>Court</th>
              <th>Order Date</th>
              <th>Urgency</th>
              <th>Conf.</th>
              <th>Pending</th>
              <th>Approved</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {judgments.map((j) => {
              const acts = listActions({ judgmentId: j.id });
              const pending = acts.filter((a) => a.status === 'Pending Review').length;
              const approved = acts.filter((a) => a.status === 'Approved').length;
              return (
                <tr key={j.id}>
                  <td>
                    <Link href={`/review/${j.id}`} className="font-medium text-gov-deep hover:underline">
                      {j.case_title || j.file_name}
                    </Link>
                    <div className="text-[12px] text-gov-slate">
                      {j.case_number || '—'} · {j.file_name}
                    </div>
                  </td>
                  <td className="text-sm">{j.court_name || '—'}</td>
                  <td className="text-sm">{formatDate(j.order_date)}</td>
                  <td>{j.urgency ? <UrgencyBadge value={j.urgency} /> : '—'}</td>
                  <td>
                    {typeof j.overall_confidence === 'number' ? (
                      <ConfidenceBadge value={j.overall_confidence} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-sm">{pending}</td>
                  <td className="text-sm">{approved}</td>
                  <td><StatusChip status={j.status} /></td>
                  <td className="text-right">
                    <Link href={`/review/${j.id}`} className="text-sm text-gov-deep hover:underline">
                      Review →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {judgments.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-gov-slate py-8">
                  No judgments yet. <Link href="/upload" className="underline">Upload one</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
