import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Add your Neon connection string to .env.');
}

export const sql = neon(databaseUrl);

export async function initializeDatabase() {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires);
    CREATE TABLE IF NOT EXISTS audit (
      id BIGSERIAL PRIMARY KEY,
      actor TEXT,
      target TEXT,
      action TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );
  `);
}
