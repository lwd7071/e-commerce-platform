import '../src/platform/config/load-root-env.ts';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { loadDatabaseConfig } from '../db/config.ts';
import { PgOnboardingService } from '../src/modules/identity/services/pg-onboarding.service.ts';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const config = loadDatabaseConfig(process.env);
const configuredRef = config.supabaseUrl.hostname.split('.')[0];
if (process.env.ALLOW_DEMO_ACCOUNT_SEED !== 'true') {
  throw new Error('Set ALLOW_DEMO_ACCOUNT_SEED=true for this one-time demo data operation');
}
if (process.env.DATABASE_ENVIRONMENT !== 'production') {
  throw new Error('This seed expects the explicitly verified Supabase production project');
}
if (required('EXPECTED_SUPABASE_PROJECT_REF') !== configuredRef || required('SUPABASE_PROJECT_REF') !== configuredRef) {
  throw new Error('Expected, configured, and URL-derived Supabase project refs must match');
}

const password = required('DEMO_SEED_SHARED_PASSWORD');
if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  throw new Error('DEMO_SEED_SHARED_PASSWORD must be 8+ characters and contain lowercase, uppercase, number, and symbol');
}

const admin = createClient(config.supabaseUrl.toString(), required('SUPABASE_SECRET_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 2 });
const onboarding = new PgOnboardingService(pool);
const seedTag = 'dino-demo-accounts-2026-09';
const sellers = Array.from({ length: 20 }, (_, i) => ({
  email: `seller${String(i + 1).padStart(2, '0')}@dino-demo.test`,
  fullName: `Demo Seller ${String(i + 1).padStart(2, '0')}`,
  shopName: `Dino Demo Shop ${String(i + 1).padStart(2, '0')}`,
}));
const buyers = Array.from({ length: 5 }, (_, i) => ({
  email: `buyer${String(i + 1).padStart(2, '0')}@dino-demo.test`,
  fullName: `Demo Buyer ${String(i + 1).padStart(2, '0')}`,
}));
const adminAccount = { email: 'admin@dino-demo.test', fullName: 'Demo Admin' };
const desired = [...sellers, ...buyers, adminAccount];
const created: Array<{ id: string; email: string }> = [];

try {
  const existingAuthEmails = new Set<string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) if (user.email) existingAuthEmails.add(user.email.toLowerCase());
    if (data.users.length < 1000) break;
  }
  const collisions = desired.filter(account => existingAuthEmails.has(account.email));
  if (collisions.length) {
    throw new Error(`Seed stopped before writing: ${collisions.length} target email(s) already exist. No existing account will be changed.`);
  }

  for (const account of desired) {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName, demo_seed: seedTag },
    });
    if (error || !data.user) throw error ?? new Error(`Supabase did not create ${account.email}`);
    created.push({ id: data.user.id, email: account.email });
  }

  for (let i = 0; i < sellers.length; i++) {
    await onboarding.completeOnboarding(created[i].id, {
      full_name: sellers[i].fullName,
      requested_role: 'SELLER',
      shop_name: sellers[i].shopName,
    });
  }
  for (let i = 0; i < buyers.length; i++) {
    const account = created[sellers.length + i];
    await onboarding.completeOnboarding(account.id, {
      full_name: buyers[i].fullName,
      requested_role: 'BUYER',
      shop_name: null,
    });
  }
  const createdAdmin = created[created.length - 1];
  await onboarding.completeOnboarding(createdAdmin.id, {
    full_name: adminAccount.fullName,
    requested_role: 'BUYER',
    shop_name: null,
  });
  await pool.query("UPDATE app_users SET role='ADMIN', updated_at=now() WHERE user_id=$1", [createdAdmin.id]);

  const verified = await pool.query<{ role: string; profile_count: number; shop_count: number }>(
    `SELECT u.role,
       (SELECT count(*)::int FROM user_profiles p WHERE p.user_id=u.user_id) AS profile_count,
       (SELECT count(*)::int FROM shops s WHERE s.owner_id=u.user_id) AS shop_count
     FROM app_users u WHERE u.user_id = ANY($1::uuid[])`,
    [created.map(user => user.id)],
  );
  if (verified.rowCount !== 26 || verified.rows.filter(row => row.profile_count === 1).length !== 26
    || verified.rows.filter(row => row.shop_count === 1).length !== 20
    || verified.rows.filter(row => row.role === 'ADMIN').length !== 1
    || verified.rows.filter(row => row.role === 'SELLER').length !== 20
    || verified.rows.filter(row => row.role === 'BUYER').length !== 5) {
    throw new Error('Post-seed verification counts did not match the requested roles, profiles, and shops');
  }

  console.log(JSON.stringify({
    project_ref: configuredRef,
    accounts_created: 26,
    sellers: sellers.map(account => account.email),
    buyers: buyers.map(account => account.email),
    admin: adminAccount.email,
    seller_shop_status: 'PENDING',
  }, null, 2));
} catch (error) {
  const cleanupFailures: string[] = [];
  for (const user of [...created].reverse()) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM shops WHERE owner_id=$1', [user.id]);
      await client.query('DELETE FROM user_profiles WHERE user_id=$1', [user.id]);
      await client.query('DELETE FROM app_users WHERE user_id=$1', [user.id]);
      await client.query('COMMIT');
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
      if (deleteError) throw deleteError;
    } catch {
      await client.query('ROLLBACK').catch(() => undefined);
      cleanupFailures.push(user.email);
    } finally {
      client.release();
    }
  }
  if (cleanupFailures.length) {
    throw new Error(`Seed failed; cleanup was incomplete for ${cleanupFailures.join(', ')}. Review these newly created demo users.`);
  }
  throw error;
} finally {
  await pool.end();
}
