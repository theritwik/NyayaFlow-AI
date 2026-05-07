import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { listJudgments, listActions } from '@/lib/repo';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function ExportPage() {
  const judgments = listJudgments();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Export Verified Action Plan"
        subtitle="Download a per-judgment verified action plan report. Only approved/completed action items are included; the audit trail is appended for traceability."
        crumbs={[{ label: 'Overview', href: '/' }, { label: 'Export Report' }]}
      />

      <section className="gov-card">
        <table className="gov-table">
          <thead>
            <tr>
              <th>Case</th>
              <th>Order date</th>
              <th>Approved actions</th>
              <th>Total actions</th>
              <th>Export</th>
            </tr>
          </thead>
          <tbody>
            {judgments.map((j) => {
              const actions = listActions({ judgmentId: j.id });
              const approved = actions.filter(
                (a) => a.status === 'Approved' || a.status === 'Completed'
              ).length;
              return (
                <tr key={j.id}>
                  <td>
                    <div className="font-medium text-gov-deep">
                      {j.case_title || j.file_name}
                    </div>
                    <div className="text-[12px] text-gov-slate">
                      {j.case_number || '—'}
                    </div>
                  </td>
                  <td className="text-sm">{formatDate(j.order_date)}</td>
                  <td className="text-sm">{approved}</td>
                  <td className="text-sm">{actions.length}</td>
                  <td className="text-sm flex gap-2">
                    <Link className="gov-btn-ghost" href={`/api/export/${j.id}?format=csv`}>
                      CSV
                    </Link>
                    <Link
                      className="gov-btn-primary"
                      href={`/api/export/${j.id}?format=html&print=1`}
                      target="_blank"
                    >
                      PDF (print)
                    </Link>
                  </td>
                </tr>
              );
            })}
            {judgments.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-gov-slate py-8">
                  No judgments to export. <Link href="/upload" className="underline">Upload one</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <p className="text-[12px] text-gov-slate">
        The PDF export opens a printable HTML view — use the browser's <em>Save as PDF</em> dialog to produce a file. CSV export is suitable for case-management systems and auditors.
      </p>
    </div>
  );
}
