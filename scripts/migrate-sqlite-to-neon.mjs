import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { sql, initializeDatabase } from '../server/db.mjs';

const source = path.resolve(process.env.SQLITE_DATABASE_PATH || 'data/studio.db');
if (!existsSync(source)) throw new Error(`SQLite database not found at ${source}. Nothing was migrated.`);

await initializeDatabase();
const sqlite = new DatabaseSync(source, { readOnly: true });
try {
  const users = sqlite.prepare('SELECT * FROM users').all();
  const sessions = sqlite.prepare('SELECT * FROM sessions').all();
  const audit = sqlite.prepare('SELECT * FROM audit').all();
  for (const user of users) await sql`INSERT INTO users (id, name, email, password, role, status, created_at) VALUES (${user.id}, ${user.name}, ${user.email}, ${user.password}, ${user.role}, ${user.status}, ${user.created_at}) ON CONFLICT (id) DO NOTHING`;
  for (const session of sessions) await sql`INSERT INTO sessions (token, user_id, expires) VALUES (${session.token}, ${session.user_id}, ${session.expires}) ON CONFLICT (token) DO NOTHING`;
  for (const entry of audit) await sql`INSERT INTO audit (actor, target, action, created_at) VALUES (${entry.actor}, ${entry.target}, ${entry.action}, ${entry.created_at})`;
  console.log(`Migrated ${users.length} users, ${sessions.length} sessions, and ${audit.length} audit records to Neon.`);
} finally {
  sqlite.close();
}
