// Seed the SQLite database with three sample judgments + extracted data so
// the dashboard is populated on first run.

import path from 'node:path';
import fs from 'node:fs';
import { getDb, uploadsDir } from '../lib/db';
import {
  applyExtractionToJudgment,
  createJudgment,
  logAudit,
  setSourceText,
  updateAction,
  updateJudgmentStatus,
} from '../lib/repo';
import { extractFromText } from '../lib/extraction';
import { findBboxForExcerpt, parsePdf } from '../lib/pdf';

async function copySample(name: string): Promise<string> {
  const src = path.join(process.cwd(), 'data', 'samples', name);
  const dst = path.join(uploadsDir(), name);
  fs.copyFileSync(src, dst);
  return dst;
}

async function ingest(fileName: string): Promise<number> {
  const stored = await copySample(fileName);
  const id = createJudgment({ file_name: fileName, stored_path: stored });
  updateJudgmentStatus(id, 'Processing');
  const parsed = await parsePdf(stored);
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
  // Initial audit entry per AI extraction
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

async function main() {
  const db = getDb();
  // Reset for an idempotent demo seed
  db.exec(
    `DELETE FROM audit_log;
     DELETE FROM action_items;
     DELETE FROM extracted_fields;
     DELETE FROM judgments;
     DELETE FROM sqlite_sequence;`
  );

  const idA = await ingest('sample-1-representation.txt');
  const idB = await ingest('sample-2-affidavit.txt');
  const idC = await ingest('sample-3-scanned-low.txt');

  // For sample A pre-approve one action to show the dashboard populated
  const firstAction = db
    .prepare(`SELECT id FROM action_items WHERE judgment_id = ? LIMIT 1`)
    .get(idA) as { id: number };
  if (firstAction) {
    updateAction(firstAction.id, {
      status: 'Approved',
      approved_by: 'demo.officer',
      reviewer_comment: 'Verified by Demo Officer during seed',
    });
    logAudit({
      judgment_id: idA,
      entity_type: 'action',
      entity_id: firstAction.id,
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

  console.log(`Seeded judgments with ids: ${idA}, ${idB}, ${idC}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
