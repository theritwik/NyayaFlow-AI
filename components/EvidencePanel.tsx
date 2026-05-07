import { ConfidenceBadge } from './Badges';
import { PdfHighlight } from './PdfHighlight';
import { safeJsonParse } from '@/lib/utils';
import type { BBox } from '@/lib/types';

export function EvidencePanel({
  excerpt,
  page,
  confidence,
  fieldKey,
  judgmentId,
  bbox,
}: {
  excerpt: string;
  page: number;
  confidence: number;
  fieldKey?: string;
  judgmentId?: number;
  bbox?: string | BBox | null;
}) {
  const parsedBbox: BBox | null =
    typeof bbox === 'string' ? safeJsonParse<BBox | null>(bbox, null) : bbox ?? null;

  return (
    <div className="space-y-2">
      <div className="border-l-4 border-gov-gold bg-amber-50/50 p-3 rounded-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="gov-section-title">Source Evidence</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gov-slate">Page {page}</span>
            <ConfidenceBadge value={confidence} />
          </div>
        </div>
        {fieldKey && (
          <div className="text-[11px] uppercase tracking-wider text-gov-slate mb-1">
            Field: {fieldKey}
          </div>
        )}
        <p className="font-serif text-[13px] text-gov-deep italic leading-snug">
          “{excerpt}”
        </p>
      </div>
      {judgmentId !== undefined && (
        <PdfHighlight
          judgmentId={judgmentId}
          page={page}
          bbox={parsedBbox}
          caption={fieldKey ? `${fieldKey} · page ${page}` : undefined}
        />
      )}
    </div>
  );
}
