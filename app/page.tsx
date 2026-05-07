import Link from 'next/link';
import { dashboardStats, departmentBreakdown, listJudgments } from '@/lib/repo';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/Badges';
import { formatDate } from '@/lib/utils';
import { autoSeedIfEmpty } from '@/lib/autoseed';
import { SeedButton } from './_components/SeedButton';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  await autoSeedIfEmpty();
  const stats = dashboardStats();
  const judgments = listJudgments().slice(0, 5);
  const departments = departmentBreakdown().slice(0, 5);
  const isEmpty = stats.total_judgments === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decision-support overview"
        subtitle="Upload court judgments. The AI extracts fields and drafts an action plan. Officers verify each item before it appears in the trusted dashboard."
        actions={
          <>
            <SeedButton />
            <Link className="gov-btn-primary" href="/upload">
              Upload Judgment
            </Link>
          </>
        }
      />

      {isEmpty && (
        <div className="gov-card p-5 border-amber-300 bg-amber-50">
          <div className="flex items-start gap-3">
            <span className="gov-stamp">No data</span>
            <div>
              <h2 className="gov-h2">Database is empty</h2>
              <p className="text-sm text-gov-slate mt-1">
                Click <em>Load demo data</em> to seed three sample judgments
                (one with a clear deadline, one compliance affidavit, one
                low-confidence scanned judgment) — or upload your own PDF.
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Judgments processed" value={stats.total_judgments} />
        <Stat label="Pending officer review" value={stats.pending_review} accent="amber" />
        <Stat label="Approved actions" value={stats.approved_actions} accent="emerald" />
        <Stat label="High urgency open" value={stats.high_urgency_open} accent="red" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="gov-card lg:col-span-2">
          <div className="gov-card-header flex items-center justify-between">
            <h2 className="gov-h2">Recent judgments</h2>
            <Link href="/judgments" className="text-sm text-gov-deep hover:underline">
              View all
            </Link>
          </div>
          <table className="gov-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Court</th>
                <th>Status</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {judgments.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link
                      href={`/review/${j.id}`}
                      className="font-medium text-gov-deep hover:underline"
                    >
                      {j.case_title || j.file_name}
                    </Link>
                    <div className="text-[12px] text-gov-slate">
                      {j.case_number || '—'}
                    </div>
                  </td>
                  <td className="text-sm">{j.court_name || '—'}</td>
                  <td>
                    <StatusChip status={j.status} />
                  </td>
                  <td className="text-sm">{formatDate(j.uploaded_at)}</td>
                </tr>
              ))}
              {judgments.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-gov-slate py-6">
                    No judgments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="gov-card">
          <div className="gov-card-header">
            <h2 className="gov-h2">Top departments (verified)</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {departments.map((d) => (
              <li key={d.department} className="flex items-center justify-between px-5 py-3 text-sm">
                <span>{d.department}</span>
                <span className="font-semibold text-gov-deep">{d.count}</span>
              </li>
            ))}
            {departments.length === 0 && (
              <li className="px-5 py-6 text-center text-gov-slate text-sm">
                No verified actions yet.
              </li>
            )}
          </ul>
        </div>
      </section>

      <section className="gov-card p-5">
        <h2 className="gov-h2 mb-2">How NyayaFlow works</h2>
        <ol className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
          {[
            ['1', 'Upload', 'Officer uploads PDF or selects sample.'],
            ['2', 'Extract', 'PDF text + OCR fallback feed the AI extractor.'],
            ['3', 'Suggest', 'AI drafts fields and an action plan with sources.'],
            ['4', 'Verify', 'Officer approves / edits / rejects each item.'],
            ['5', 'Trust', 'Only verified items reach the dashboard & report.'],
          ].map(([n, t, d]) => (
            <li key={n} className="border border-slate-200 rounded-sm p-3 bg-white">
              <div className="text-[11px] uppercase tracking-wider text-gov-slate">Step {n}</div>
              <div className="font-semibold text-gov-deep">{t}</div>
              <div className="text-gov-slate text-[13px] mt-1">{d}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'red' | 'amber' | 'emerald';
}) {
  const ring =
    accent === 'red'
      ? 'border-l-4 border-l-red-500'
      : accent === 'amber'
        ? 'border-l-4 border-l-amber-500'
        : accent === 'emerald'
          ? 'border-l-4 border-l-emerald-600'
          : 'border-l-4 border-l-gov-navy';
  return (
    <div className={`gov-stat ${ring}`}>
      <div className="gov-stat-label">{label}</div>
      <div className="gov-stat-value">{value}</div>
    </div>
  );
}
