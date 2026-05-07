import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { ConfidenceBadge, StatusChip, UrgencyBadge } from '@/components/Badges';
import { EvidencePanel } from '@/components/EvidencePanel';
import {
  getJudgment,
  listActions,
  listFields,
} from '@/lib/repo';
import { fieldLabel, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function ProcessingResultsPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  const j = getJudgment(id);
  if (!j) return notFound();
  // If still uploaded, hard-redirect — pipeline runs synchronously in MVP
  if (j.status === 'Uploaded') {
    redirect('/upload');
  }
  const fields = listFields(id);
  const actions = listActions({ judgmentId: id });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Processing results"
        subtitle="AI-extracted fields and draft action items. Nothing here is trusted yet — proceed to Human Review to verify."
        crumbs={[
          { label: 'Overview', href: '/' },
          { label: 'Upload Judgment', href: '/upload' },
          { label: `Judgment #${id}` },
        ]}
        actions={
          <Link href={`/review/${id}`} className="gov-btn-primary">
            Open Human Review →
          </Link>
        }
      />

      <section className="gov-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
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
            <span className="text-[12px] text-gov-slate">
              {j.page_count} pages {j.is_scanned ? '· OCR fallback' : '· digital PDF'}
            </span>
            {typeof j.overall_confidence === 'number' && (
              <ConfidenceBadge value={j.overall_confidence} />
            )}
          </div>
        </div>
      </section>

      <section className="gov-card">
        <div className="gov-card-header flex items-center justify-between">
          <h2 className="gov-h2">Extracted fields ({fields.length})</h2>
          <span className="text-[12px] text-gov-slate">All marked Pending Review</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {fields.map((f) => (
            <li key={f.id} className="px-5 py-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="gov-section-title">{fieldLabel(f.field_key)}</div>
                <div className="text-sm font-medium text-gov-deep mt-0.5">{f.current_value}</div>
                <div className="mt-1 flex items-center gap-2">
                  <ConfidenceBadge value={f.confidence} />
                  <StatusChip status={f.status} />
                </div>
              </div>
              <div className="md:col-span-2">
                <EvidencePanel
                  excerpt={f.source_excerpt}
                  page={f.source_page}
                  confidence={f.confidence}
                  judgmentId={j.id}
                  bbox={f.bbox}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="gov-card">
        <div className="gov-card-header">
          <h2 className="gov-h2">Suggested action plan ({actions.length})</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {actions.map((a) => (
            <li key={a.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <div className="font-semibold text-gov-deep">{a.title}</div>
                  <div className="text-[12px] text-gov-slate">
                    {a.action_type} · {a.department} · Due {a.due_date || 'TBD (officer review)'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <UrgencyBadge value={a.urgency} />
                  <ConfidenceBadge value={a.confidence} />
                  <StatusChip status={a.status} />
                </div>
              </div>
              <p className="text-sm text-gov-deep">{a.description}</p>
              <div className="mt-2">
                <EvidencePanel
                  excerpt={a.source_excerpt}
                  page={a.source_page}
                  confidence={a.confidence}
                  judgmentId={j.id}
                  bbox={a.bbox}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
