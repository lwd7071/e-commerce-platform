import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });
try {
  await pool.query('CREATE SCHEMA IF NOT EXISTS auth');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  END $$`);
} finally {
  await pool.end();
}
