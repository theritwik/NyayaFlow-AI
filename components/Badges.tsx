import { cn } from '@/lib/utils';
import type { ActionStatus, FieldStatus, Urgency } from '@/lib/types';

export function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.85
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : value >= 0.7
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-red-50 text-red-800 border-red-200';
  const label = value >= 0.85 ? 'High' : value >= 0.7 ? 'Medium' : 'Low';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-sm border font-medium',
        tone
      )}
      title={`AI confidence: ${pct}%`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label} · {pct}%
    </span>
  );
}

export function UrgencyBadge({ value }: { value: Urgency }) {
  const tone =
    value === 'High'
      ? 'bg-red-100 text-red-900 border-red-300'
      : value === 'Medium'
        ? 'bg-amber-100 text-amber-900 border-amber-300'
        : 'bg-slate-100 text-slate-800 border-slate-300';
  return (
    <span
      className={cn(
        'inline-flex items-center text-[11px] px-2 py-0.5 rounded-sm border font-semibold uppercase tracking-wide',
        tone
      )}
    >
      {value}
    </span>
  );
}

export function StatusChip({
  status,
}: {
  status: ActionStatus | FieldStatus | string;
}) {
  const map: Record<string, string> = {
    'Pending Review': 'bg-slate-100 text-slate-800 border-slate-300',
    Approved: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    Edited: 'bg-sky-100 text-sky-900 border-sky-300',
    Rejected: 'bg-red-100 text-red-900 border-red-300',
    Completed: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    Uploaded: 'bg-slate-100 text-slate-800 border-slate-300',
    Processing: 'bg-amber-100 text-amber-900 border-amber-300',
    Extracted: 'bg-sky-100 text-sky-900 border-sky-300',
    'Under Review': 'bg-amber-100 text-amber-900 border-amber-300',
    Verified: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  };
  const tone = map[status] || 'bg-slate-100 text-slate-800 border-slate-300';
  return (
    <span
      className={cn(
        'inline-flex items-center text-[11px] px-2 py-0.5 rounded-sm border font-medium',
        tone
      )}
    >
      {status}
    </span>
  );
}

export function ProvenanceTag({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-sm border bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold uppercase tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> Officer Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-sm border bg-amber-50 text-amber-900 border-amber-200 font-semibold uppercase tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> AI Suggested
    </span>
  );
}
