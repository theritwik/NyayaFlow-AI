// Apply db/schema.sql to a Postgres database.
//
// Usage:
//   export DATABASE_URL="postgres://nyaya:nyaya@localhost:5432/nyayaflow"
//   npm run db:migrate
//
// The Postgres path is provided as an alternative production target.  The
// MVP demo runs on SQLite; this script lets you bring up the same schema on
// Postgres without changing any other code.

import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.  Example:');
    console.error('  export DATABASE_URL="postgres://nyaya:nyaya@localhost:5432/nyayaflow"');
    process.exit(1);
  }
  if (!url.startsWith('postgres')) {
    console.error('DATABASE_URL must start with postgres://');
    process.exit(1);
  }
  let pg: any;
  try {
    pg = await import('pg');
  } catch {
    console.error(
      'The `pg` package is not installed.  Run:  npm install --save-optional pg'
    );
    process.exit(1);
  }
  const Client = pg.default?.Client ?? pg.Client;
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log('✓ Applied db/schema.sql to', url);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
