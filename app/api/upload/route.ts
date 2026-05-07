import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  applyExtractionToJudgment,
  createJudgment,
  logAudit,
  setSourceText,
  updateJudgmentStatus,
} from '@/lib/repo';
import { uploadsDir } from '@/lib/db';
import { findBboxForExcerpt, parsePdf } from '@/lib/pdf';
import { extractFromText } from '@/lib/extraction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file') as File | null;
  const useSample = form.get('use_sample') as string | null;

  let fileName: string;
  let storedPath: string;

  if (useSample) {
    const allowed = new Set([
      'sample-1-representation.txt',
      'sample-2-affidavit.txt',
      'sample-3-scanned-low.txt',
    ]);
    if (!allowed.has(useSample)) {
      return NextResponse.json({ error: 'Unknown sample' }, { status: 400 });
    }
    fileName = useSample;
    const src = path.join(process.cwd(), 'data', 'samples', useSample);
    storedPath = path.join(uploadsDir(), `${Date.now()}-${useSample}`);
    await fs.copyFile(src, storedPath);
  } else if (file) {
    fileName = file.name;
    const arrayBuf = await file.arrayBuffer();
    storedPath = path.join(uploadsDir(), `${Date.now()}-${file.name}`);
    await fs.writeFile(storedPath, Buffer.from(arrayBuf));
  } else {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const id = createJudgment({ file_name: fileName, stored_path: storedPath });
  updateJudgmentStatus(id, 'Processing');

  // Run pipeline synchronously for the MVP
  const parsed = await parsePdf(storedPath);
  setSourceText(id, parsed.text);
  const result = await extractFromText({
    text: parsed.text,
    fileName,
    pageCount: parsed.pageCount,
    isScanned: parsed.isScanned,
  });

  // Enrich each extracted item with a bbox by matching the excerpt against
  // the per-span coordinates returned by the Python service.
  for (const f of result.fields) {
    if (!f.bbox) {
      f.bbox = findBboxForExcerpt(parsed.pages, f.source_excerpt, f.source_page);
    }
  }
  for (const a of result.actions) {
    if (!a.bbox) {
      a.bbox = findBboxForExcerpt(parsed.pages, a.source_excerpt, a.source_page);
    }
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

  return NextResponse.json({ id, fileName, ...parsed, fields: result.fields.length, actions: result.actions.length });
}
