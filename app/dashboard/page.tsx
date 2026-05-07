import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import {
  ConfidenceBadge,
  StatusChip,
  UrgencyBadge,
  ProvenanceTag,
} from '@/components/Badges';
import {
  dashboardStats,
  departmentBreakdown,
  listActions,
} from '@/lib/repo';
import { formatDate } from '@/lib/utils';
import { DashboardFilters } from './DashboardFilters';
import type { ActionStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function VerifiedDashboardPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string; dept?: string; type?: string; urgency?: string };
}) {
  const status = (searchParams.status as ActionStatus) ?? 'Approved';
  const stats = dashboardStats();
  const departments = departmentBreakdown();

  let actions = listActions({ status });
  const q = (searchParams.q || '').toLowerCase();
  if (q) {
    actions = actions.filter((a) =>
      [a.title, a.description, a.department, a.action_type, String(a.judgment_id)]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }
  if (searchParams.dept) {
    actions = actions.filter((a) => a.department === searchParams.dept);
  }
  if (searchParams.type) {
    actions = actions.filter((a) => a.action_type === searchParams.type);
  }
  if (searchParams.urgency) {
    actions = actions.filter((a) => a.urgency === searchParams.urgency);
  }

  // Department-wise grouping (only approved)
  const approvedAll = listActions({ status: 'Approved' });
  const dueSorted = [...actions]
    .filter((a) => !!a.due_date)
    .sort((x, y) => (x.due_date! < y.due_date! ? -1 : 1));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verified Action Dashboard"
        subtitle="Officer-verified action items only. Use the filters to focus on departments, urgency or status."
        crumbs={[{ label: 'Overview', href: '/' }, { label: 'Verified Dashboard' }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Judgments" value={stats.total_judgments} />
        <Stat label="Pending Review" value={stats.pending_review} accent="amber" />
        <Stat label="Approved Actions" value={stats.approved_actions} accent="emerald" />
        <Stat label="High Urgency" value={stats.high_urgency_open} accent="red" />
        <Stat label="Rejected" value={stats.rejected_actions} accent="slate" />
      </section>

      <DashboardFilters
        currentStatus={status}
        departments={departments.map((d) => d.department)}
        searchParams={searchParams}
      />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="gov-card lg:col-span-2">
          <div className="gov-card-header flex items-center justify-between">
            <h2 className="gov-h2">Action items ({actions.length})</h2>
            <span className="text-[12px] text-gov-slate">
              Status filter: <strong>{status}</strong>
            </span>
          </div>
          <table className="gov-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Department</th>
                <th>Due</th>
                <th>Urgency</th>
                <th>Confidence</th>
                <th>Provenance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="font-medium text-gov-deep">{a.title}</div>
                    <div className="text-[12px] text-gov-slate">
                      {a.action_type} · J#{a.judgment_id}
                    </div>
                  </td>
                  <td className="text-sm">{a.department}</td>
                  <td className="text-sm">{formatDate(a.due_date)}</td>
                  <td><UrgencyBadge value={a.urgency} /></td>
                  <td><ConfidenceBadge value={a.confidence} /></td>
                  <td>
                    <ProvenanceTag verified={a.status === 'Approved' || a.status === 'Completed'} />
                  </td>
                  <td>
                    <Link
                      href={`/action/${a.id}`}
                      className="text-sm text-gov-deep hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
              {actions.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gov-slate py-8">
                    No action items match the current filter.
                    {status === 'Approved' && (
                      <div className="text-[12px] mt-2">
                        Tip: open <Link className="underline" href="/judgments">Judgments</Link> and approve a few items first.
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <div className="gov-card">
            <div className="gov-card-header">
              <h2 className="gov-h2">Departments (verified)</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {departments.length === 0 && (
                <li className="px-5 py-6 text-center text-gov-slate text-sm">
                  No verified actions yet.
                </li>
              )}
              {departments.map((d) => (
                <li key={d.department} className="px-5 py-2.5 flex items-center justify-between text-sm">
                  <span>{d.department}</span>
                  <span className="font-semibold">{d.count}</span>
                </li>
              ))}
              {approvedAll.length > 0 && departments.length === 0 && null}
            </ul>
          </div>

          <div className="gov-card">
            <div className="gov-card-header">
              <h2 className="gov-h2">Upcoming deadlines</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {dueSorted.slice(0, 8).map((a) => (
                <li key={a.id} className="px-5 py-2.5 text-sm flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gov-deep">{a.title}</div>
                    <div className="text-[12px] text-gov-slate">{a.department}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] font-mono">{formatDate(a.due_date)}</div>
                    <UrgencyBadge value={a.urgency} />
                  </div>
                </li>
              ))}
              {dueSorted.length === 0 && (
                <li className="px-5 py-6 text-center text-gov-slate text-sm">
                  No deadlines on file.
                </li>
              )}
            </ul>
          </div>
        </div>
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
  accent?: 'red' | 'amber' | 'emerald' | 'slate';
}) {
  const ring =
    accent === 'red'
      ? 'border-l-4 border-l-red-500'
      : accent === 'amber'
        ? 'border-l-4 border-l-amber-500'
        : accent === 'emerald'
          ? 'border-l-4 border-l-emerald-600'
          : accent === 'slate'
            ? 'border-l-4 border-l-slate-400'
            : 'border-l-4 border-l-gov-navy';
  return (
    <div className={`gov-stat ${ring}`}>
      <div className="gov-stat-label">{label}</div>
      <div className="gov-stat-value">{value}</div>
    </div>
  );
}
