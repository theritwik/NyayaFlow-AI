import { PageHeader } from '@/components/PageHeader';
import { UploadForm } from './UploadForm';

export const dynamic = 'force-dynamic';

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload Judgment"
        crumbs={[{ label: 'Overview', href: '/' }, { label: 'Upload Judgment' }]}
        subtitle="Upload a digital or scanned judgment PDF — or pick a curated sample. The system will extract structured fields and draft an action plan that you must verify before it appears on the trusted dashboard."
      />
      <UploadForm />
      <section className="gov-card p-5">
        <h2 className="gov-h2 mb-3">What happens next</h2>
        <ol className="text-sm space-y-2 text-gov-slate list-decimal list-inside">
          <li>PDF text is extracted (OCR fallback for scanned files).</li>
          <li>The extraction engine identifies case fields and action items with source excerpts and confidence scores.</li>
          <li>You will be taken to the Human Review screen to verify each item.</li>
          <li>Only approved items appear on the Verified Dashboard and exported reports.</li>
        </ol>
      </section>
    </div>
  );
}
