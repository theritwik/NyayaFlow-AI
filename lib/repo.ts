// Thin data-access helpers over the SQLite db.
import { getDb } from './db';
import type {
  ActionItem,
  ActionStatus,
  AuditEntry,
  ExtractedField,
  ExtractionResult,
  Judgment,
  JudgmentStatus,
} from './types';

// ---------- Judgments ----------

export function listJudgments(): Judgment[] {
  return getDb()
    .prepare(`SELECT * FROM judgments ORDER BY datetime(uploaded_at) DESC`)
    .all() as Judgment[];
}

export function getJudgment(id: number): Judgment | undefined {
  return getDb()
    .prepare(`SELECT * FROM judgments WHERE id = ?`)
    .get(id) as Judgment | undefined;
}

export function createJudgment(input: {
  file_name: string;
  stored_path: string | null;
}): number {
  const info = getDb()
    .prepare(
      `INSERT INTO judgments (file_name, stored_path, status) VALUES (?, ?, 'Uploaded')`
    )
    .run(input.file_name, input.stored_path);
  return info.lastInsertRowid as number;
}

export function updateJudgmentStatus(id: number, status: JudgmentStatus) {
  getDb()
    .prepare(`UPDATE judgments SET status = ? WHERE id = ?`)
    .run(status, id);
}

export function applyExtractionToJudgment(
  id: number,
  result: ExtractionResult
) {
  const db = getDb();
  const fieldByKey = (k: string) => result.fields.find((f) => f.field_key === k);

  const get = (k: string) => fieldByKey(k)?.value ?? null;
  const petitioners = result.fields.filter((f) => f.field_key === 'petitioner').map((f) => f.value);
  const respondents = result.fields.filter((f) => f.field_key === 'respondent').map((f) => f.value);

  const urgencyField = fieldByKey('urgency');
  const overall =
    result.fields.length === 0
      ? null
      : Math.round(
          (result.fields.reduce((s, f) => s + f.confidence, 0) /
            result.fields.length) *
            100
        ) / 100;

  db.prepare(
    `UPDATE judgments SET
      page_count = ?,
      is_scanned = ?,
      case_title = ?,
      case_number = ?,
      court_name = ?,
      order_date = ?,
      petitioners = ?,
      respondents = ?,
      urgency = ?,
      overall_confidence = ?,
      status = 'Extracted'
     WHERE id = ?`
  ).run(
    result.page_count,
    result.is_scanned ? 1 : 0,
    get('case_title'),
    get('case_number'),
    get('court_name'),
    get('order_date'),
    JSON.stringify(petitioners),
    JSON.stringify(respondents),
    urgencyField?.value ?? null,
    overall,
    id
  );

  // wipe old rows so re-extraction is idempotent
  db.prepare(`DELETE FROM extracted_fields WHERE judgment_id = ?`).run(id);
  db.prepare(`DELETE FROM action_items WHERE judgment_id = ?`).run(id);

  const insertField = db.prepare(
    `INSERT INTO extracted_fields
      (judgment_id, field_key, ai_value, current_value, confidence, source_excerpt, source_page, bbox, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending Review')`
  );
  for (const f of result.fields) {
    insertField.run(
      id,
      f.field_key,
      f.value,
      f.value,
      f.confidence,
      f.source_excerpt,
      f.source_page,
      f.bbox ? JSON.stringify(f.bbox) : null
    );
  }

  const insertAction = db.prepare(
    `INSERT INTO action_items
      (judgment_id, title, ai_title, action_type, description, ai_description,
       department, ai_department, due_date, ai_due_date, needs_officer_review,
       source_excerpt, source_page, bbox, confidence, urgency, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Review')`
  );
  for (const a of result.actions) {
    insertAction.run(
      id,
      a.title,
      a.title,
      a.action_type,
      a.description,
      a.description,
      a.department,
      a.department,
      a.due_date,
      a.due_date,
      a.needs_officer_review ? 1 : 0,
      a.source_excerpt,
      a.source_page,
      a.bbox ? JSON.stringify(a.bbox) : null,
      a.confidence,
      a.urgency
    );
  }
}

export function setSourceText(id: number, text: string) {
  getDb()
    .prepare(`UPDATE judgments SET source_text = ? WHERE id = ?`)
    .run(text, id);
}

// ---------- Extracted Fields ----------

export function listFields(judgmentId: number): ExtractedField[] {
  return getDb()
    .prepare(
      `SELECT * FROM extracted_fields WHERE judgment_id = ? ORDER BY id ASC`
    )
    .all(judgmentId) as ExtractedField[];
}

export function getField(id: number): ExtractedField | undefined {
  return getDb()
    .prepare(`SELECT * FROM extracted_fields WHERE id = ?`)
    .get(id) as ExtractedField | undefined;
}

export function updateField(
  id: number,
  patch: { current_value?: string; status?: string; reviewer_comment?: string }
) {
  const existing = getField(id);
  if (!existing) throw new Error('Field not found');
  getDb()
    .prepare(
      `UPDATE extracted_fields
       SET current_value = ?, status = ?, reviewer_comment = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      patch.current_value ?? existing.current_value,
      patch.status ?? existing.status,
      patch.reviewer_comment ?? existing.reviewer_comment,
      id
    );
}

// ---------- Action Items ----------

export function listActions(filter?: {
  status?: ActionStatus;
  judgmentId?: number;
}): ActionItem[] {
  const where: string[] = [];
  const params: any[] = [];
  if (filter?.status) {
    where.push('status = ?');
    params.push(filter.status);
  }
  if (filter?.judgmentId) {
    where.push('judgment_id = ?');
    params.push(filter.judgmentId);
  }
  const sql = `SELECT * FROM action_items ${
    where.length ? 'WHERE ' + where.join(' AND ') : ''
  } ORDER BY datetime(updated_at) DESC`;
  return getDb().prepare(sql).all(...params) as ActionItem[];
}

export function getAction(id: number): ActionItem | undefined {
  return getDb()
    .prepare(`SELECT * FROM action_items WHERE id = ?`)
    .get(id) as ActionItem | undefined;
}

export function updateAction(
  id: number,
  patch: Partial<{
    title: string;
    description: string;
    department: string;
    due_date: string | null;
    status: ActionStatus;
    reviewer_comment: string;
    approved_by: string | null;
    needs_officer_review: 0 | 1;
  }>
) {
  const existing = getAction(id);
  if (!existing) throw new Error('Action not found');
  const next = { ...existing, ...patch };
  getDb()
    .prepare(
      `UPDATE action_items SET
        title = ?, description = ?, department = ?, due_date = ?,
        status = ?, reviewer_comment = ?, approved_by = ?, approved_at = ?,
        needs_officer_review = ?,
        updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      next.title,
      next.description,
      next.department,
      next.due_date,
      next.status,
      next.reviewer_comment,
      next.approved_by,
      next.status === 'Approved' ? new Date().toISOString() : next.approved_at,
      next.needs_officer_review,
      id
    );
}

// ---------- Audit Log ----------

export function logAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
  getDb()
    .prepare(
      `INSERT INTO audit_log
        (judgment_id, entity_type, entity_id, field_key, ai_value,
         previous_value, new_value, confidence, decision, reviewer, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      entry.judgment_id,
      entry.entity_type,
      entry.entity_id,
      entry.field_key,
      entry.ai_value,
      entry.previous_value,
      entry.new_value,
      entry.confidence,
      entry.decision,
      entry.reviewer,
      entry.comment
    );
}

export function listAudit(judgmentId?: number): AuditEntry[] {
  const sql = judgmentId
    ? `SELECT * FROM audit_log WHERE judgment_id = ? ORDER BY datetime(timestamp) DESC`
    : `SELECT * FROM audit_log ORDER BY datetime(timestamp) DESC LIMIT 500`;
  return judgmentId
    ? (getDb().prepare(sql).all(judgmentId) as AuditEntry[])
    : (getDb().prepare(sql).all() as AuditEntry[]);
}

// ---------- Aggregates for dashboard ----------

export interface DashboardStats {
  total_judgments: number;
  pending_review: number;
  approved_actions: number;
  high_urgency_open: number;
  rejected_actions: number;
}

export function dashboardStats(): DashboardStats {
  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM judgments`).get() as any)
    .c as number;
  const pending = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM action_items WHERE status='Pending Review'`)
      .get() as any
  ).c as number;
  const approved = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM action_items WHERE status='Approved'`)
      .get() as any
  ).c as number;
  const high = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM action_items WHERE urgency='High' AND status IN ('Approved','Pending Review')`
      )
      .get() as any
  ).c as number;
  const rejected = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM action_items WHERE status='Rejected'`)
      .get() as any
  ).c as number;
  return {
    total_judgments: total,
    pending_review: pending,
    approved_actions: approved,
    high_urgency_open: high,
    rejected_actions: rejected,
  };
}

export function departmentBreakdown(): Array<{
  department: string;
  count: number;
}> {
  return getDb()
    .prepare(
      `SELECT department, COUNT(*) AS count FROM action_items
       WHERE status='Approved' GROUP BY department ORDER BY count DESC`
    )
    .all() as Array<{ department: string; count: number }>;
}
