import '../src/platform/config/load-root-env.ts';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { loadDatabaseConfig } from '../db/config.ts';
import { createRuntimeApp } from '../src/platform/http/app.ts';

const required = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required for review media smoke`);
  return value;
};

if (process.env.ALLOW_SUPABASE_REVIEW_MEDIA_SMOKE !== 'true') {
  throw new Error('Set ALLOW_SUPABASE_REVIEW_MEDIA_SMOKE=true for this one-run Storage smoke');
}

const config = loadDatabaseConfig(process.env);
const projectRef = config.supabaseUrl.hostname.split('.')[0];
if (required('EXPECTED_SUPABASE_PROJECT_REF') !== projectRef) {
  throw new Error('EXPECTED_SUPABASE_PROJECT_REF does not match SUPABASE_URL');
}

const secretKey = required('SUPABASE_SECRET_KEY');
const publishableKey = required('SUPABASE_PUBLISHABLE_KEY');
const admin = createClient(config.supabaseUrl.toString(), secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authClient = createClient(config.supabaseUrl.toString(), publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 2 });
const userEmail = `review-media-smoke-${randomUUID()}@example.test`;
const password = `Review-${randomUUID()}-Aa1!`;
const reviewId = randomUUID();
let userId: string | undefined;
let accessToken: string | undefined;
let mediaId: string | undefined;
let objectPath: string | undefined;
let runtime: ReturnType<typeof createRuntimeApp> | undefined;
let server: http.Server | undefined;
let cleanupError: Error | undefined;

const request = async (baseUrl: string, path: string, method: string, token: string, body?: unknown) => {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined) as { data?: Record<string, unknown>; error?: { message?: string } } | undefined;
  if (!response.ok) throw new Error(`Review media API ${method} ${path} failed with HTTP ${response.status}: ${payload?.error?.message ?? 'request failed'}`);
  return payload?.data;
};

try {
  const created = await admin.auth.admin.createUser({ email: userEmail, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error('Could not create temporary confirmed Buyer');
  userId = created.data.user.id;

  const bootstrap = await pool.query<{ role: string; status: string }>(
    'SELECT role,status FROM app_users WHERE user_id=$1', [userId],
  );
  if (bootstrap.rowCount !== 1 || bootstrap.rows[0]?.role !== 'BUYER' || bootstrap.rows[0]?.status !== 'ACTIVE') {
    throw new Error('Auth bootstrap did not create the expected active Buyer');
  }

  const signedIn = await authClient.auth.signInWithPassword({ email: userEmail, password });
  if (signedIn.error || !signedIn.data.session?.access_token) throw signedIn.error ?? new Error('Temporary Buyer sign-in failed');
  accessToken = signedIn.data.session.access_token;

  runtime = createRuntimeApp({ ...process.env, SUPABASE_URL: config.supabaseUrl.toString() });
  server = runtime.app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server?.once('listening', () => resolve());
    server?.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Review media smoke server did not bind to a local port');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const presigned = await request(baseUrl, '/api/v1/media/uploads/presign', 'POST', accessToken, {
    filename: 'review-smoke.png',
    purpose: 'review_image',
    content_type: 'image/png',
    review_id: reviewId,
  });
  mediaId = String(presigned?.media_id ?? '');
  objectPath = String(presigned?.storage_path ?? '');
  const uploadUrl = String(presigned?.upload_url ?? '');
  const expectedPath = `users/${userId}/reviews/${reviewId}/${mediaId}.png`;
  if (!mediaId || objectPath !== expectedPath || !uploadUrl) throw new Error('Review presign returned an unexpected media path or no signed URL');

  // A valid 1x1 PNG; the API finalizer checks the actual bytes from Storage.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l6kAAAAASUVORK5CYII=', 'base64');
  const uploaded = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png });
  if (!uploaded.ok) throw new Error(`Supabase signed Storage PUT failed with HTTP ${uploaded.status}`);

  const finalized = await request(baseUrl, `/api/v1/media/uploads/${mediaId}/finalize`, 'POST', accessToken, {});
  if (finalized?.status !== 'FINALIZED' || finalized?.storage_path !== objectPath) {
    throw new Error('Review media finalization did not return the expected path and FINALIZED state');
  }
  const state = await pool.query<{ status: string }>('SELECT status FROM media_uploads WHERE media_id=$1 AND owner_id=$2', [mediaId, userId]);
  if (state.rows[0]?.status !== 'FINALIZED') throw new Error('Database did not record the review media as FINALIZED');
  console.log('Live review media smoke passed: Supabase presign, Storage PUT, and API finalization.');
} finally {
  if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
  if (runtime) await runtime.close();

  if (objectPath) {
    const { error } = await admin.storage.from('review-media').remove([objectPath]);
    if (error) cleanupError ??= new Error('Could not remove the temporary review Storage object');
  }
  if (mediaId) {
    await pool.query('DELETE FROM media_uploads WHERE media_id=$1', [mediaId]).catch(() => undefined);
    const remaining = await pool.query('SELECT 1 FROM media_uploads WHERE media_id=$1', [mediaId]).catch(() => ({ rowCount: 1 }));
    if (remaining.rowCount !== 0) cleanupError ??= new Error('Temporary media registry row remains after cleanup');
  }
  if (userId) {
    await pool.query('DELETE FROM app_users WHERE user_id=$1', [userId]).catch(() => undefined);
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error) cleanupError ??= new Error('Could not remove the temporary Supabase Auth user');
    const remaining = await pool.query('SELECT 1 FROM app_users WHERE user_id=$1', [userId]).catch(() => ({ rowCount: 1 }));
    if (remaining.rowCount !== 0) cleanupError ??= new Error('Temporary Buyer database row remains after cleanup');
  }
  await pool.end();
}

if (cleanupError) throw cleanupError;
