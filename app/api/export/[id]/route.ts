import { NextResponse } from 'next/server';
import {
  getJudgment,
  listActions,
  listAudit,
  listFields,
} from '@/lib/repo';
import { safeJsonParse } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const url = new URL(req.url);
  const fmt = url.searchParams.get('format') || 'csv';
  const j = getJudgment(id);
  if (!j) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const fields = listFields(id);
  const actions = listActions({ judgmentId: id }).filter(
    (a) => a.status === 'Approved' || a.status === 'Completed'
  );
  const audit = listAudit(id);

  if (fmt === 'csv') {
    const rows = [
      ['Section', 'Key', 'Value', 'Status', 'Confidence', 'Page'],
      ['Case', 'Title', j.case_title ?? '', j.status, j.overall_confidence ?? '', '1'],
      ['Case', 'Number', j.case_number ?? '', j.status, '', '1'],
      ['Case', 'Court', j.court_name ?? '', j.status, '', '1'],
      ['Case', 'Order Date', j.order_date ?? '', j.status, '', '1'],
      ['Case', 'Petitioners', safeJsonParse<string[]>(j.petitioners, []).join('; '), j.status, '', '1'],
      ['Case', 'Respondents', safeJsonParse<string[]>(j.respondents, []).join('; '), j.status, '', '1'],
      ['Case', 'Urgency', j.urgency ?? '', j.status, '', '1'],
    ];
    for (const f of fields) {
      rows.push([
        'Field',
        f.field_key,
        f.current_value,
        f.status,
        String(f.confidence),
        String(f.source_page),
      ]);
    }
    for (const a of actions) {
      rows.push([
        'Action',
        a.title,
        `${a.action_type} | ${a.department} | due ${a.due_date ?? 'TBD'} | ${a.urgency}`,
        a.status,
        String(a.confidence),
        String(a.source_page),
      ]);
    }
    rows.push(['---', '---', '---', '---', '---', '---']);
    for (const e of audit) {
      rows.push([
        'Audit',
        `${e.entity_type}#${e.entity_id} ${e.field_key ?? ''}`.trim(),
        `${e.previous_value ?? ''} → ${e.new_value ?? ''}`,
        `${e.decision} by ${e.reviewer}`,
        String(e.confidence ?? ''),
        e.timestamp,
      ]);
    }
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="nyayaflow-judgment-${id}.csv"`,
      },
    });
  }

  // HTML export — printable as PDF from the browser
  const html = renderHtmlReport(j, fields, actions, audit);
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="nyayaflow-judgment-${id}.html"`,
    },
  });
}

function renderHtmlReport(
  j: any,
  fields: any[],
  actions: any[],
  audit: any[]
): string {
  const rowsField = fields
    .map(
      (f) =>
        `<tr><td>${esc(f.field_key)}</td><td>${esc(f.current_value)}</td><td>${esc(
          f.status
        )}</td><td>${Math.round(f.confidence * 100)}%</td><td>p.${f.source_page}</td></tr>`
    )
    .join('');
  const rowsAction = actions
    .map(
      (a) =>
        `<tr><td>${esc(a.title)}</td><td>${esc(a.action_type)}</td><td>${esc(
          a.department
        )}</td><td>${esc(a.due_date ?? 'TBD')}</td><td>${esc(a.urgency)}</td><td>${esc(
          a.status
        )}</td><td>${esc(a.approved_by ?? '')}</td></tr>`
    )
    .join('');
  const rowsAudit = audit
    .slice(0, 80)
    .map(
      (e) =>
        `<tr><td>${esc(e.timestamp)}</td><td>${esc(e.entity_type)}</td><td>${esc(
          e.field_key ?? ''
        )}</td><td>${esc(e.previous_value ?? '')}</td><td>${esc(
          e.new_value ?? ''
        )}</td><td>${esc(e.decision)}</td><td>${esc(e.reviewer)}</td></tr>`
    )
    .join('');
  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>NyayaFlow Verified Action Plan — ${esc(j.case_title ?? j.file_name)}</title>
<style>
  body { font-family: Georgia, serif; margin: 40px; color: #0a0f1f; }
  h1 { color: #0b2545; border-bottom: 2px solid #0b2545; padding-bottom: 8px; }
  h2 { color: #13315c; margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th, td { border: 1px solid #c5c7cc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
  .meta { color: #3a506b; font-size: 13px; }
  .stamp { display: inline-block; padding: 4px 10px; border: 2px solid #7a1e1e; color: #7a1e1e; font-weight: bold; transform: rotate(-3deg); }
  @media print { body { margin: 14mm; } }
</style></head><body>
<h1>Verified Action Plan</h1>
<p class="meta"><span class="stamp">OFFICER VERIFIED</span> &nbsp;
Generated: ${new Date().toLocaleString('en-IN')}</p>
<h2>Case Particulars</h2>
<table>
  <tr><th>Case Title</th><td>${esc(j.case_title ?? '—')}</td></tr>
  <tr><th>Case Number</th><td>${esc(j.case_number ?? '—')}</td></tr>
  <tr><th>Court</th><td>${esc(j.court_name ?? '—')}</td></tr>
  <tr><th>Order Date</th><td>${esc(j.order_date ?? '—')}</td></tr>
  <tr><th>Urgency</th><td>${esc(j.urgency ?? '—')}</td></tr>
  <tr><th>Source File</th><td>${esc(j.file_name)}</td></tr>
</table>
<h2>Verified Action Items</h2>
<table>
  <thead><tr><th>Title</th><th>Type</th><th>Department</th><th>Due</th><th>Urgency</th><th>Status</th><th>Approved by</th></tr></thead>
  <tbody>${rowsAction || '<tr><td colspan="7"><em>No verified actions yet.</em></td></tr>'}</tbody>
</table>
<h2>Verified Extracted Fields</h2>
<table>
  <thead><tr><th>Key</th><th>Value</th><th>Status</th><th>Confidence</th><th>Source</th></tr></thead>
  <tbody>${rowsField}</tbody>
</table>
<h2>Audit Trail (latest 80 entries)</h2>
<table>
  <thead><tr><th>When</th><th>Entity</th><th>Field</th><th>Previous</th><th>New</th><th>Decision</th><th>Reviewer</th></tr></thead>
  <tbody>${rowsAudit}</tbody>
</table>
<p class="meta">Generated by NyayaFlow AI — Decision Support System for Court Judgment Compliance.</p>
<script>window.addEventListener('load',()=>{ if(location.search.includes('print=1')) window.print(); });</script>
</body></html>`;
}

function esc(s: any) {
  return String(s ?? '').replace(/[&<>]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'
  );
}
