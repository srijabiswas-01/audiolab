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
    )
  `);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires BIGINT NOT NULL
    )
  `);
  await sql.query('CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)');
  await sql.query('CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires)');
  await sql.query(`
    CREATE TABLE IF NOT EXISTS audit (
      id BIGSERIAL PRIMARY KEY,
      actor TEXT,
      target TEXT,
      action TEXT,
      created_at TIMESTAMPTZ NOT NULL
    )
  `);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      filename TEXT NOT NULL,
      size BIGINT NOT NULL,
      duration DOUBLE PRECISION NOT NULL,
      transcript TEXT NOT NULL DEFAULT '',
      settings JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      expected_chunks INTEGER NOT NULL DEFAULT 0,
      complete BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
  await sql.query('CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id, updated_at DESC)');
  await sql.query(`
    CREATE TABLE IF NOT EXISTS project_chunks (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (project_id, chunk_index)
    )
  `);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS project_tombstones (
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      deleted_at BIGINT NOT NULL,
      PRIMARY KEY (project_id, user_id)
    )
  `);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS exports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT,
      name TEXT NOT NULL,
      size BIGINT NOT NULL,
      created_at BIGINT NOT NULL,
      expected_chunks INTEGER NOT NULL,
      complete BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
  await sql.query('CREATE INDEX IF NOT EXISTS exports_user_id_idx ON exports (user_id, created_at DESC)');
  await sql.query(`
    CREATE TABLE IF NOT EXISTS export_chunks (
      export_id TEXT NOT NULL REFERENCES exports(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (export_id, chunk_index)
    )
  `);
}
