// Convenience endpoint: re-seed sample data on demand from the UI.
import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';
import { getDb, uploadsDir } from '@/lib/db';
import {
  applyExtractionToJudgment,
  createJudgment,
  logAudit,
  setSourceText,
  updateAction,
  updateJudgmentStatus,
} from '@/lib/repo';
import { extractFromText } from '@/lib/extraction';
import { findBboxForExcerpt, parsePdf } from '@/lib/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ingest(fileName: string): Promise<number> {
  const src = path.join(process.cwd(), 'data', 'samples', fileName);
  const dst = path.join(uploadsDir(), `${Date.now()}-${fileName}`);
  await fs.copyFile(src, dst);
  const id = createJudgment({ file_name: fileName, stored_path: dst });
  updateJudgmentStatus(id, 'Processing');
  const parsed = await parsePdf(dst);
  setSourceText(id, parsed.text);
  const result = await extractFromText({
    text: parsed.text,
    fileName,
    pageCount: parsed.pageCount,
    isScanned: parsed.isScanned,
  });
  for (const f of result.fields) {
    if (!f.bbox) f.bbox = findBboxForExcerpt(parsed.pages, f.source_excerpt, f.source_page);
  }
  for (const a of result.actions) {
    if (!a.bbox) a.bbox = findBboxForExcerpt(parsed.pages, a.source_excerpt, a.source_page);
  }
  applyExtractionToJudgment(id, result);
  updateJudgmentStatus(id, 'Under Review');
  for (const f of result.fields) {
    logAudit({
      judgment_id: id,
      entity_type: 'field',
      entity_id: 0,
      field_key: f.field_key,
      ai_value: f.value,
      previous_value: null,
      new_value: f.value,
      confidence: f.confidence,
      decision: 'AI Extracted',
      reviewer: 'system/AI',
      comment: 'Initial AI extraction',
    });
  }
  for (const a of result.actions) {
    logAudit({
      judgment_id: id,
      entity_type: 'action',
      entity_id: 0,
      field_key: null,
      ai_value: a.title,
      previous_value: null,
      new_value: a.title,
      confidence: a.confidence,
      decision: 'AI Suggested',
      reviewer: 'system/AI',
      comment: `Suggested action of type ${a.action_type}`,
    });
  }
  return id;
}

export async function POST() {
  const db = getDb();
  db.exec(
    `DELETE FROM audit_log;
     DELETE FROM action_items;
     DELETE FROM extracted_fields;
     DELETE FROM judgments;
     DELETE FROM sqlite_sequence;`
  );

  const idA = await ingest('sample-1-representation.txt');
  await ingest('sample-2-affidavit.txt');
  await ingest('sample-3-scanned-low.txt');

  // Pre-approve a single action on sample A so the dashboard isn't empty
  const first = db
    .prepare(`SELECT id FROM action_items WHERE judgment_id = ? LIMIT 1`)
    .get(idA) as { id: number } | undefined;
  if (first) {
    updateAction(first.id, {
      status: 'Approved',
      approved_by: 'demo.officer',
      reviewer_comment: 'Verified by Demo Officer during seed',
    });
    logAudit({
      judgment_id: idA,
      entity_type: 'action',
      entity_id: first.id,
      field_key: null,
      ai_value: null,
      previous_value: 'Pending Review',
      new_value: 'Approved',
      confidence: null,
      decision: 'Approved',
      reviewer: 'demo.officer',
      comment: 'Verified by Demo Officer during seed',
    });
  }

  return NextResponse.json({ ok: true });
}
