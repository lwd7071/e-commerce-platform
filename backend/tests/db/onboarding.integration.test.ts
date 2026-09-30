import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { PgOnboardingService } from '../../src/modules/identity/services/pg-onboarding.service.ts';
import { PgAuthRepository } from '../../src/modules/identity/repositories/pg-auth.repository.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { createApp } from '../../src/platform/http/app.ts';
import request from 'supertest';
import { PostgresUserProfileRepository } from '../../src/modules/buyer/infrastructure/postgres-user-profile.repository.ts';
import { ProfileService } from '../../src/modules/buyer/services/profile.service.ts';

const remoteDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

remoteDescribe('Buyer/Seller onboarding (real PostgreSQL)', () => {
  const schema = `onboarding_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let service: PgOnboardingService;
  let buyerId: string;
  let sellerId: string;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 8, options: `-c search_path=${schema}` });
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`
      CREATE TABLE ${schema}.app_users (
        user_id uuid PRIMARY KEY, email varchar(255) NOT NULL UNIQUE,
        role varchar(20) NOT NULL CHECK (role IN ('BUYER','SELLER','ADMIN')),
        status varchar(20) NOT NULL CHECK (status IN ('ACTIVE','LOCKED')),
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE ${schema}.user_profiles (
        user_id uuid PRIMARY KEY REFERENCES ${schema}.app_users(user_id),
        full_name varchar(150) NOT NULL, phone varchar(20), avatar_url text, updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE ${schema}.shops (
        shop_id uuid PRIMARY KEY, owner_id uuid NOT NULL UNIQUE REFERENCES ${schema}.app_users(user_id),
        shop_name varchar(150) NOT NULL, description text, logo_url text, pickup_address varchar(255),
        contact_phone varchar(20), status varchar(20) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    service = new PgOnboardingService(pool);
  }, 45_000);

  afterAll(async () => {
    if (pool) {
      try { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
      finally { await pool.end(); }
    }
  }, 20_000);

  beforeEach(async () => {
    buyerId = randomUUID();
    sellerId = randomUUID();
    await pool.query(`INSERT INTO ${schema}.app_users (user_id,email,role,status) VALUES ($1,$2,'BUYER','ACTIVE'),($3,$4,'BUYER','ACTIVE')`, [buyerId, `${buyerId}@example.test`, sellerId, `${sellerId}@example.test`]);
  });

  it('completes Buyer onboarding and returns the stored profile', async () => {
    const result = await service.completeOnboarding(buyerId, { full_name: 'Nguyễn Văn A', requested_role: 'BUYER', shop_name: null });
    expect(result).toMatchObject({ user_id: buyerId, role: 'BUYER', profile_completed: true, shop: null });
    expect((await pool.query(`SELECT full_name FROM ${schema}.user_profiles WHERE user_id=$1`, [buyerId])).rows).toEqual([{ full_name: 'Nguyễn Văn A' }]);
  });

  it('exposes authenticated onboarding and auth/me through the API runtime', async () => {
    const app = createApp({
      rateLimiter: false,
      authRepository: new PgAuthRepository(pool),
      onboardingService: service,
      auth: (req, _res, next) => {
        req.context = createRequestContext({ request_id: req.requestId ?? 'req_test', user_id: buyerId, role: 'BUYER' });
        next();
      },
    });
    const onboarding = await request(app).post('/api/v1/auth/onboarding').send({ full_name: 'Nguyễn Văn A', requested_role: 'BUYER', shop_name: null });
    expect(onboarding.status).toBe(200);
    expect(onboarding.body.data).toMatchObject({ user_id: buyerId, role: 'BUYER', profile_completed: true });
    const me = await request(app).get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ user_id: buyerId, role: 'BUYER', profile_completed: true });
  });

  it('reads and updates only the authenticated user profile through the API', async () => {
    await service.completeOnboarding(buyerId, { full_name: 'Nguyễn Văn A', requested_role: 'BUYER', shop_name: null });
    const app = createApp({
      rateLimiter: false,
      buyerServices: { profileService: new ProfileService(new PostgresUserProfileRepository(pool)) },
      auth: (req, _res, next) => { req.context = createRequestContext({ request_id: req.requestId ?? 'req_profile', user_id: buyerId, role: 'BUYER' }); next(); },
    });
    const get = await request(app).get('/api/v1/profile');
    expect(get.status).toBe(200);
    expect(get.body.data).toMatchObject({ user_id: buyerId, full_name: 'Nguyễn Văn A' });
    const patch = await request(app).patch('/api/v1/profile').send({ full_name: 'Nguyễn Văn C', phone: '0901234567' });
    expect(patch.status).toBe(200);
    expect(patch.body.data).toMatchObject({ user_id: buyerId, full_name: 'Nguyễn Văn C', phone: '0901234567' });
    expect((await request(app).patch('/api/v1/profile').send({ role: 'ADMIN' })).status).toBe(422);
  });

  it('creates exactly one PENDING shop for Seller onboarding', async () => {
    const result = await service.completeOnboarding(sellerId, { full_name: 'Nguyễn Văn B', requested_role: 'SELLER', shop_name: 'Dino Store' });
    expect(result).toMatchObject({ role: 'SELLER', shop: { shop_name: 'Dino Store', status: 'PENDING' } });
    expect((await pool.query(`SELECT count(*)::int AS count FROM ${schema}.shops WHERE owner_id=$1`, [sellerId])).rows[0].count).toBe(1);
  });

  it('returns the existing result for an identical retry', async () => {
    const input = { full_name: 'Nguyễn Văn B', requested_role: 'SELLER', shop_name: 'Dino Store' } as const;
    const first = await service.completeOnboarding(sellerId, input);
    const retry = await service.completeOnboarding(sellerId, input);
    expect(retry).toEqual(first);
  });

  it('rejects a retry that changes role or shop name with 409', async () => {
    await service.completeOnboarding(sellerId, { full_name: 'Nguyễn Văn B', requested_role: 'SELLER', shop_name: 'Dino Store' });
    await expect(service.completeOnboarding(sellerId, { full_name: 'Nguyễn Văn B', requested_role: 'BUYER', shop_name: null })).rejects.toMatchObject({ httpStatus: 409 });
    await expect(service.completeOnboarding(sellerId, { full_name: 'Nguyễn Văn B', requested_role: 'SELLER', shop_name: 'Other Store' })).rejects.toMatchObject({ httpStatus: 409 });
  });

  it('rejects ADMIN, invalid names and Seller without a shop name', async () => {
    await expect(service.completeOnboarding(buyerId, { full_name: 'Admin', requested_role: 'ADMIN', shop_name: null })).rejects.toMatchObject({ httpStatus: 422 });
    await expect(service.completeOnboarding(buyerId, { full_name: 'A', requested_role: 'BUYER', shop_name: null })).rejects.toMatchObject({ httpStatus: 422 });
    await expect(service.completeOnboarding(sellerId, { full_name: 'Seller User', requested_role: 'SELLER', shop_name: null })).rejects.toMatchObject({ httpStatus: 422 });
  });

  it('serializes concurrent Seller retries and relies on owner uniqueness to prevent duplicate shops', async () => {
    const input = { full_name: 'Nguyễn Văn B', requested_role: 'SELLER', shop_name: 'Dino Store' } as const;
    const [first, second] = await Promise.all([service.completeOnboarding(sellerId, input), service.completeOnboarding(sellerId, input)]);
    expect(first).toEqual(second);
    expect((await pool.query(`SELECT count(*)::int AS count FROM ${schema}.shops WHERE owner_id=$1`, [sellerId])).rows[0].count).toBe(1);
  });
});
