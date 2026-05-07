'use client';
// Renders a single PDF page as an image (via the Python /page endpoint),
// with a translucent yellow highlight rectangle baked into the PNG by
// PyMuPDF.  When the Python service is unreachable we surface a clear,
// actionable message instead of a silently-blank image.

import { useEffect, useState } from 'react';

interface ErrorPayload {
  error: string;
  message: string;
  hint?: string;
}

export function PdfHighlight({
  judgmentId,
  page,
  bbox,
  caption,
}: {
  judgmentId: number;
  page: number;
  bbox?: [number, number, number, number] | null;
  caption?: string;
}) {
  const [open, setOpen] = useState(false);
  const [errInfo, setErrInfo] = useState<ErrorPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const params = new URLSearchParams({ page: String(page) });
  if (bbox) {
    params.set('x0', String(bbox[0]));
    params.set('y0', String(bbox[1]));
    params.set('x1', String(bbox[2]));
    params.set('y1', String(bbox[3]));
  }
  if (retryNonce) params.set('_r', String(retryNonce));
  const src = `/api/page/${judgmentId}?${params.toString()}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setLoading(true);
      setErrInfo(null);
      setImgUrl(null);
      try {
        const res = await fetch(src, { cache: 'no-store' });
        if (res.ok) {
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setImgUrl(objectUrl);
        } else {
          const j: ErrorPayload = await res
            .json()
            .catch(() => ({ error: 'unknown', message: `HTTP ${res.status}` }));
          if (!cancelled) setErrInfo(j);
        }
      } catch (e: any) {
        if (!cancelled)
          setErrInfo({
            error: 'network',
            message: e?.message || 'Network error fetching PDF page.',
          });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, src]);

  return (
    <div className="border border-slate-200 rounded-sm bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-3 py-2 flex items-center justify-between text-[12px] text-gov-deep hover:bg-slate-50 border-b border-slate-200"
      >
        <span>
          <strong>📄 View on PDF</strong>
          <span className="text-gov-slate ml-2">
            Page {page}
            {bbox ? ' · highlighted' : ''}
          </span>
        </span>
        <span className="text-slate-400">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="p-2 bg-slate-50">
          {loading && (
            <div className="h-32 flex items-center justify-center text-[12px] text-gov-slate">
              <span className="animate-pulse">
                Rendering page via PyMuPDF…
              </span>
            </div>
          )}

          {errInfo && (
            <div className="border border-amber-300 bg-amber-50 rounded-sm p-3 text-[12px] text-amber-900">
              <div className="font-semibold mb-1">
                {errInfo.error === 'python_offline'
                  ? 'Python processing service is offline'
                  : errInfo.error === 'no_source_file'
                    ? 'Source PDF missing'
                    : 'Could not render PDF page'}
              </div>
              <div className="text-amber-900/80 mb-2">{errInfo.message}</div>
              {errInfo.hint && (
                <div className="bg-white border border-amber-200 rounded-sm px-2 py-1 font-mono text-[11px] text-amber-900">
                  💡 {errInfo.hint}
                </div>
              )}
              <button
                type="button"
                onClick={() => setRetryNonce((n) => n + 1)}
                className="mt-2 inline-flex items-center text-[11px] px-2 py-1 rounded-sm border border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
              >
                ↻ Retry
              </button>
            </div>
          )}

          {imgUrl && !errInfo && (
            <>
              <img
                src={imgUrl}
                alt={caption || `Page ${page}`}
                className="w-full max-h-[480px] object-contain border border-slate-300 shadow-sm bg-white"
              />
              {caption && (
                <div className="text-[11px] text-gov-slate mt-1 italic">
                  {caption}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
