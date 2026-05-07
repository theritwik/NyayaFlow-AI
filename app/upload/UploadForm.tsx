'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SAMPLES = [
  {
    file: 'sample-1-representation.txt',
    title: 'A. Kumari vs State of Bihar',
    desc: 'Direction to consider representation within 6 weeks (clear deadline → High urgency).',
  },
  {
    file: 'sample-2-affidavit.txt',
    title: 'M. Lal vs Union of India',
    desc: 'Compliance affidavit to be filed within 30 days. Deputy Secretary to swear.',
  },
  {
    file: 'sample-3-scanned-low.txt',
    title: 'Sundaram & Sons vs TNPCB (scanned)',
    desc: 'Poor scan quality — low confidence; demonstrates the human-review pathway.',
  },
];

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Upload failed');
      }
      const data = await res.json();
      router.push(`/processing/${data.id}`);
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="gov-card">
        <div className="gov-card-header">
          <h2 className="gov-h2">Upload your own PDF</h2>
        </div>
        <form
          className="p-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) return;
            const fd = new FormData();
            fd.set('file', file);
            submit(fd);
          }}
        >
          <label className="block">
            <span className="gov-section-title block mb-2">
              Judgment PDF (or .txt for testing)
            </span>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block text-sm"
            />
          </label>
          {file && (
            <div className="text-[12px] text-gov-slate">
              Selected: <span className="font-medium">{file.name}</span> ({Math.round(file.size / 1024)} KB)
            </div>
          )}
          {error && (
            <div className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-sm px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" className="gov-btn-primary" disabled={!file || busy}>
              {busy ? 'Processing…' : 'Upload & extract'}
            </button>
          </div>
          <p className="text-[12px] text-gov-slate">
            For digital PDFs, text is parsed directly. Scanned PDFs fall through to a placeholder OCR path and use mock extraction.
          </p>
        </form>
      </div>

      <div className="gov-card">
        <div className="gov-card-header">
          <h2 className="gov-h2">Use a sample judgment</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {SAMPLES.map((s) => (
            <li key={s.file} className="px-5 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-gov-deep">{s.title}</div>
                <div className="text-[13px] text-gov-slate">{s.desc}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">{s.file}</div>
              </div>
              <button
                className="gov-btn-ghost shrink-0"
                disabled={busy}
                onClick={() => {
                  const fd = new FormData();
                  fd.set('use_sample', s.file);
                  submit(fd);
                }}
              >
                {busy ? '…' : 'Process'}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
