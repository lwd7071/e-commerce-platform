import '../src/platform/config/load-root-env.ts';
import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { createRuntimeApp } from '../src/platform/http/app.ts';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for auth smoke`);
  return value;
};

const supabaseUrl = required('SUPABASE_URL');
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
if (process.env.ALLOW_SUPABASE_AUTH_SMOKE !== 'true') throw new Error('Set ALLOW_SUPABASE_AUTH_SMOKE=true to authorize creating and deleting one temporary Supabase Auth user');
if (required('EXPECTED_SUPABASE_PROJECT_REF') !== projectRef) throw new Error('EXPECTED_SUPABASE_PROJECT_REF does not match SUPABASE_URL');
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY?.trim() || required('SUPABASE_PUBLISHABLE_KEY');
const secretKey = process.env.SUPABASE_TEST_SECRET_KEY?.trim() || required('SUPABASE_SECRET_KEY');
required('SUPABASE_JWKS_URL');
const databaseUrl = required('DIRECT_URL');

const admin = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
const client = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const email = `t1-auth-smoke-${Date.now()}@example.test`;
const password = `T1-${crypto.randomUUID()}-Aa1!`;
let userId: string | undefined;
let server: http.Server | undefined;
let runtime: ReturnType<typeof createRuntimeApp> | undefined;

const request = (port: number, token: string) => new Promise<{ status: number; body: string }>((resolve, reject) => {
  const req = http.request({ hostname: '127.0.0.1', port, path: '/api/v1/addresses', method: 'GET', headers: { Authorization: `Bearer ${token}` } }, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
  });
  req.on('error', reject);
  req.end();
});

try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`Supabase Auth test user creation failed: ${created.error?.message ?? 'no user returned'}`);
  userId = created.data.user.id;

  const bootstrap = await pool.query<{ email: string; role: string; status: string }>(
    `SELECT email, role, status FROM app_users WHERE user_id = $1`,
    [userId],
  );
  if (bootstrap.rowCount !== 1 || bootstrap.rows[0]?.email !== email || bootstrap.rows[0]?.role !== 'BUYER' || bootstrap.rows[0]?.status !== 'ACTIVE') {
    throw new Error('Supabase auth.users trigger did not bootstrap the expected active Buyer app_users row');
  }

  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session?.access_token) throw new Error('Supabase Auth sign-in failed');

  runtime = createRuntimeApp({ ...process.env, SUPABASE_URL: supabaseUrl });
  server = runtime.app.listen(0);
  await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Auth smoke server did not bind to a port');

  const active = await request(address.port, signedIn.data.session.access_token);
  if (active.status !== 200) throw new Error(`ACTIVE auth smoke failed with HTTP ${active.status}`);

  await pool.query(`UPDATE app_users SET status = 'LOCKED', updated_at = now() WHERE user_id = $1`, [userId]);
  const locked = await request(address.port, signedIn.data.session.access_token);
  if (locked.status !== 403 || !locked.body.includes('USER_LOCKED')) {
    throw new Error(`LOCKED auth smoke failed with HTTP ${locked.status}`);
  }

  console.log('Supabase auth smoke passed: ACTIVE request accepted; LOCKED request rejected.');
} finally {
  if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
  if (runtime) await runtime.close();
  if (userId) {
    await pool.query('DELETE FROM app_users WHERE user_id = $1', [userId]);
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error) throw new Error(`Supabase Auth test user cleanup failed: ${deleted.error.message}`);
    const remaining = await pool.query('SELECT 1 FROM app_users WHERE user_id = $1', [userId]);
    if (remaining.rowCount !== 0) throw new Error('Supabase Auth smoke left an app_users test row behind');
  }
  await pool.end();
}
