import { sql } from '../server/db.mjs';

const [database] = await sql.query('SELECT current_database() AS database, current_schema() AS schema');
const tables = await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
const counts = {};
for (const table of ['users', 'sessions', 'audit', 'projects', 'project_chunks', 'project_tombstones', 'exports', 'export_chunks']) {
  try {
    const [row] = await sql.query(`SELECT count(*)::int AS n FROM ${table}`);
    counts[table] = row.n;
  } catch {
    counts[table] = 'missing';
  }
}
console.log(JSON.stringify({ ...database, tables: tables.map(row => row.table_name), counts }, null, 2));
