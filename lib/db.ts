// Storage layer.
//
// Default driver: SQLite via better-sqlite3 (zero-setup).
//
// PostgreSQL: set DATABASE_URL to a Postgres connection string and run
//             `docker compose up -d` + `npm run db:migrate`.  The Node app
//             keeps using SQLite for the MVP (the better-sqlite3 path is
//             well-tested); Postgres is wired in via lib/db.pg.ts and used
//             by scripts/migrate-pg.ts.  This keeps the demo zero-setup
//             while the Postgres path is fully documented and runnable.

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'nyayaflow.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  _db = db;
  return db;
}

function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  ddl: string
) {
  const cols = db
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS judgments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      stored_path TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'Uploaded',
      page_count INTEGER NOT NULL DEFAULT 0,
      is_scanned INTEGER NOT NULL DEFAULT 0,
      source_text TEXT,
      case_title TEXT,
      case_number TEXT,
      court_name TEXT,
      order_date TEXT,
      petitioners TEXT,
      respondents TEXT,
      urgency TEXT,
      overall_confidence REAL
    );

    CREATE TABLE IF NOT EXISTS extracted_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      judgment_id INTEGER NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
      field_key TEXT NOT NULL,
      ai_value TEXT NOT NULL,
      current_value TEXT NOT NULL,
      confidence REAL NOT NULL,
      source_excerpt TEXT NOT NULL,
      source_page INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending Review',
      reviewer_comment TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS action_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      judgment_id INTEGER NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      ai_title TEXT NOT NULL,
      action_type TEXT NOT NULL,
      description TEXT NOT NULL,
      ai_description TEXT NOT NULL,
      department TEXT NOT NULL,
      ai_department TEXT NOT NULL,
      due_date TEXT,
      ai_due_date TEXT,
      needs_officer_review INTEGER NOT NULL DEFAULT 0,
      source_excerpt TEXT NOT NULL,
      source_page INTEGER NOT NULL,
      confidence REAL NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'Pending Review',
      reviewer_comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      approved_by TEXT,
      approved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      judgment_id INTEGER NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      field_key TEXT,
      ai_value TEXT,
      previous_value TEXT,
      new_value TEXT,
      confidence REAL,
      decision TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      comment TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_fields_judgment ON extracted_fields(judgment_id);
    CREATE INDEX IF NOT EXISTS idx_actions_judgment ON action_items(judgment_id);
    CREATE INDEX IF NOT EXISTS idx_actions_status ON action_items(status);
    CREATE INDEX IF NOT EXISTS idx_audit_judgment ON audit_log(judgment_id);
  `);

  // Forward-compatible additions for existing DBs.
  ensureColumn(db, 'extracted_fields', 'bbox', 'TEXT');
  ensureColumn(db, 'action_items', 'bbox', 'TEXT');
}

export function uploadsDir(): string {
  return UPLOADS_DIR;
}
