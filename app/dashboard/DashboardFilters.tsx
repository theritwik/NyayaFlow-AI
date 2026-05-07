'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ActionStatus } from '@/lib/types';

const STATUSES: ActionStatus[] = [
  'Pending Review',
  'Approved',
  'Rejected',
  'Completed',
];
const TYPES = [
  'Compliance',
  'Appeal Consideration',
  'Department Review',
  'Deadline Tracking',
  'Information Update',
];
const URGENCIES = ['High', 'Medium', 'Low'];

export function DashboardFilters({
  currentStatus,
  departments,
  searchParams,
}: {
  currentStatus: ActionStatus;
  departments: string[];
  searchParams: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    router.push(`/dashboard?${next.toString()}`);
  }

  return (
    <div className="gov-card p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="gov-section-title mr-2">Status</span>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setParam('status', s)}
            className={`gov-btn ${
              currentStatus === s
                ? 'bg-gov-navy text-white border-gov-navy'
                : 'bg-white border-slate-300 text-gov-deep hover:bg-slate-50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          defaultValue={searchParams.q ?? ''}
          placeholder="Search title, department, case…"
          className="gov-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter') setParam('q', (e.target as HTMLInputElement).value);
          }}
        />
        <select
          className="gov-input"
          value={searchParams.dept ?? ''}
          onChange={(e) => setParam('dept', e.target.value || null)}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          className="gov-input"
          value={searchParams.type ?? ''}
          onChange={(e) => setParam('type', e.target.value || null)}
        >
          <option value="">All action types</option>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          className="gov-input"
          value={searchParams.urgency ?? ''}
          onChange={(e) => setParam('urgency', e.target.value || null)}
        >
          <option value="">All urgencies</option>
          {URGENCIES.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
