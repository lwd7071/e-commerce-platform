import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import {
  createFixtureUser,
  createFixtureShop,
  applyShippingMigration,
} from './fixtures/database-fixtures.ts';
import { ShopMallRequestService } from '../../src/modules/shop/services/shop-mall-request.service.ts';
import { PgShopMallRequestRepository } from '../../src/modules/shop/repositories/pg-shop-mall-request.repository.ts';
import { PgModerationTargetRepository } from '../../src/modules/moderation/repositories/pg-target.repository.ts';
import { PgAuditRepository } from '../../src/platform/audit/pg-audit.repository.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import type { RequestContext } from '../../src/platform/context/request-context.ts';

const dbDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

dbDescribe('Seller Mall Request Integration (Real PostgreSQL)', { timeout: 90_000, sequential: true }, () => {
  const schema = `mall_test_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let service: ShopMallRequestService;
  let repo: PgShopMallRequestRepository;
  let auditRepo: PgAuditRepository;

  let adminId: string;
  let seller1Id: string;
  let seller2Id: string;
  let shop1Id: string;
  let shop2Id: string;

  let seller1Ctx: RequestContext;
  let _seller2Ctx: RequestContext;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    const directUrl = new URL(config.directUrl.toString());
    directUrl.searchParams.set('options', `-c search_path=${schema},public`);

    pool = new pg.Pool({
      connectionString: directUrl.toString(),
      max: 10,
      connectionTimeoutMillis: 15_000,
      options: `-c search_path=${schema},public -c statement_timeout=30000`,
      application_name: schema,
    });

    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`GRANT USAGE ON SCHEMA ${schema} TO anon, authenticated`);
    await pool.query(`SET search_path TO ${schema}, public`);
    await pool.query('CREATE TABLE fixture_auth_users (id uuid PRIMARY KEY)');

    const initialSql = await readFile(
      new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url),
      'utf8',
    );
    await pool.query(
      initialSql
        .replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '')
        .replaceAll('auth.users', 'fixture_auth_users'),
    );

    const migrations = [
      '20260918170000_add_api_idempotency_records',
      '20260924120000_t3_idempotency_rls_hardening',
      '20261003100000_shop_tiering',
    ];

    for (const mig of migrations) {
      const sql = await readFile(
        new URL(`../../prisma/migrations/${mig}/migration.sql`, import.meta.url),
        'utf8',
      );
      await pool.query(sql);
    }

    await applyShippingMigration(pool);

    const mallMigrationSql = await readFile(
      new URL('../../prisma/migrations/20261011100000_shop_mall_requests/migration.sql', import.meta.url),
      'utf8',
    );
    await pool.query(mallMigrationSql);

    repo = new PgShopMallRequestRepository(pool);
    auditRepo = new PgAuditRepository(pool);
    const targetRepo = new PgModerationTargetRepository(pool);
    service = new ShopMallRequestService(pool, repo, targetRepo, auditRepo);

    // Seed test users & shops
    adminId = randomUUID();
    seller1Id = randomUUID();
    seller2Id = randomUUID();

    await pool.query('INSERT INTO fixture_auth_users (id) VALUES ($1), ($2), ($3)', [adminId, seller1Id, seller2Id]);

    await createFixtureUser(pool, { userId: adminId, role: 'ADMIN' });
    await createFixtureUser(pool, { userId: seller1Id, role: 'SELLER' });
    await createFixtureUser(pool, { userId: seller2Id, role: 'SELLER' });

    const s1 = await createFixtureShop(pool, seller1Id, { shopName: 'Seller 1 Boutique', status: 'ACTIVE' });
    shop1Id = s1.shopId;
    const s2 = await createFixtureShop(pool, seller2Id, { shopName: 'Seller 2 Electronics', status: 'ACTIVE' });
    shop2Id = s2.shopId;

    seller1Ctx = createRequestContext({
      request_id: 'req_seller1_test',
      user_id: seller1Id,
      role: 'SELLER',
      shop_id: shop1Id,
      shop_status: 'ACTIVE',
    });

    _seller2Ctx = createRequestContext({
      request_id: 'req_seller2_test',
      user_id: seller2Id,
      role: 'SELLER',
      shop_id: shop2Id,
      shop_status: 'ACTIVE',
    });
  }, 90_000);

  afterAll(async () => {
    if (pool) {
      try {
        await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      } finally {
        await pool.end();
      }
    }
  }, 30_000);

  beforeEach(async () => {
    await pool.query('DELETE FROM shop_mall_requests WHERE shop_id IN ($1, $2)', [shop1Id, shop2Id]);
    await pool.query('DELETE FROM admin_logs WHERE target_id IN ($1, $2)', [shop1Id, shop2Id]);
    await pool.query('DELETE FROM moderation_records WHERE target_id IN ($1, $2)', [shop1Id, shop2Id]);
    await pool.query(
      `UPDATE shops
       SET tier = 'STANDARD', tier_override = FALSE, tier_override_reason = NULL,
           tier_overridden_at = NULL, tier_override_by = NULL
       WHERE shop_id IN ($1, $2)`,
      [shop1Id, shop2Id],
    );
  });

  describe('PostgreSQL DDL Constraints, Indexes & RLS Security', () => {
    it('enforces document_url NOT NULL and URL format CHECK constraint (SQLSTATE 23514 / 23502)', async () => {
      const validId = randomUUID();
      // Valid insert passes
      await pool.query(
        `INSERT INTO shop_mall_requests (request_id, shop_id, seller_id, document_url, reason, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
        [validId, shop2Id, seller2Id, 'https://storage.dino.vn/papers.pdf', 'Valid URL test reason with 10+ chars'],
      );

      // Clean up for next assertions
      await pool.query('DELETE FROM shop_mall_requests WHERE request_id = $1', [validId]);

      // Invalid URL format violates CHECK
      await expect(
        pool.query(
          `INSERT INTO shop_mall_requests (request_id, shop_id, seller_id, document_url, reason, status)
           VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
          [randomUUID(), shop2Id, seller2Id, 'ftp://invalid-url.com/doc', 'Invalid proto reason with 10+ chars'],
        ),
      ).rejects.toMatchObject({ code: '23514' });

      // NULL document_url violates NOT NULL
      await expect(
        pool.query(
          `INSERT INTO shop_mall_requests (request_id, shop_id, seller_id, document_url, reason, status)
           VALUES ($1, $2, $3, NULL, $4, 'PENDING')`,
          [randomUUID(), shop2Id, seller2Id, 'Missing doc url reason with 10+ chars'],
        ),
      ).rejects.toMatchObject({ code: '23502' });
    });

    it('enforces partial unique index uq_shop_mall_requests_pending_per_shop (SQLSTATE 23505)', async () => {
      const id1 = randomUUID();
      const id2 = randomUUID();

      await pool.query(
        `INSERT INTO shop_mall_requests (request_id, shop_id, seller_id, document_url, reason, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
        [id1, shop2Id, seller2Id, 'https://dino.vn/first.pdf', 'First pending request reason 10+ chars'],
      );

      // Inserting a second PENDING request for the same shop must violate unique index
      await expect(
        pool.query(
          `INSERT INTO shop_mall_requests (request_id, shop_id, seller_id, document_url, reason, status)
           VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
          [id2, shop2Id, seller2Id, 'https://dino.vn/second.pdf', 'Duplicate pending reason 10+ chars'],
        ),
      ).rejects.toMatchObject({ code: '23505' });

      // Updating the first request to REJECTED with valid state fields frees the partial unique constraint
      await pool.query(
        `UPDATE shop_mall_requests
         SET status = 'REJECTED', admin_id = $2, admin_note = 'Rejected for testing', reviewed_at = NOW()
         WHERE request_id = $1`,
        [id1, adminId],
      );

      // Now inserting a new PENDING request succeeds
      await expect(
        pool.query(
          `INSERT INTO shop_mall_requests (request_id, shop_id, seller_id, document_url, reason, status)
           VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
          [id2, shop2Id, seller2Id, 'https://dino.vn/second.pdf', 'Second pending after rejection 10+ chars'],
        ),
      ).resolves.toBeDefined();
    });

    it('enforces foreign key ON DELETE RESTRICT on shop_id and seller_id (SQLSTATE 23503)', async () => {
      const tempSellerId = randomUUID();
      const tempShopId = randomUUID();
      const tempReqId = randomUUID();

      await pool.query('INSERT INTO fixture_auth_users (id) VALUES ($1)', [tempSellerId]);
      await createFixtureUser(pool, { userId: tempSellerId, role: 'SELLER' });
      await createFixtureShop(pool, tempSellerId, { shopId: tempShopId, shopName: 'Temp Shop', status: 'ACTIVE' });

      await pool.query(
        `INSERT INTO shop_mall_requests (request_id, shop_id, seller_id, document_url, reason, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
        [tempReqId, tempShopId, tempSellerId, 'https://dino.vn/temp.pdf', 'Temp test with at least 10 chars'],
      );

      // Attempting to delete shop fails due to RESTRICT
      await expect(
        pool.query('DELETE FROM shops WHERE shop_id = $1', [tempShopId]),
      ).rejects.toMatchObject({ code: '23503' });

      // Attempting to delete user fails due to RESTRICT
      await expect(
        pool.query('DELETE FROM app_users WHERE user_id = $1', [tempSellerId]),
      ).rejects.toMatchObject({ code: '23503' });

      // Cleaning up request first allows deletion
      await pool.query('DELETE FROM shop_mall_requests WHERE request_id = $1', [tempReqId]);
      await pool.query('DELETE FROM shops WHERE shop_id = $1', [tempShopId]);
      await pool.query('DELETE FROM app_users WHERE user_id = $1', [tempSellerId]);
      await pool.query('DELETE FROM fixture_auth_users WHERE id = $1', [tempSellerId]);
    });

    it('denies anon and authenticated roles direct access to shop_mall_requests via RLS (SQLSTATE 42501)', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE anon');
        await client.query('SAVEPOINT sp_anon');
        await expect(client.query('SELECT * FROM shop_mall_requests LIMIT 1')).rejects.toMatchObject({
          code: '42501',
        });
        await client.query('ROLLBACK TO SAVEPOINT sp_anon');

        await client.query('SET LOCAL ROLE authenticated');
        await client.query('SAVEPOINT sp_auth');
        await expect(client.query('SELECT * FROM shop_mall_requests LIMIT 1')).rejects.toMatchObject({
          code: '42501',
        });
        await client.query('ROLLBACK TO SAVEPOINT sp_auth');
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });

  describe('Concurrency & Lock Serialization (Real PostgreSQL)', () => {
    it('handles two concurrent submissions: exactly one succeeds and the other fails or conflicts', async () => {
      const payload1 = {
        document_url: 'https://cdn.dino.test/license-a.pdf',
        reason: 'Concurrent submission attempt A with sufficient length',
      };
      const payload2 = {
        document_url: 'https://cdn.dino.test/license-b.pdf',
        reason: 'Concurrent submission attempt B with sufficient length',
      };

      const results = await Promise.allSettled([
        service.submitRequest(seller1Ctx, payload1),
        service.submitRequest(seller1Ctx, payload2),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      // Verify exactly one pending request exists in DB
      const res = await pool.query('SELECT * FROM shop_mall_requests WHERE shop_id = $1', [shop1Id]);
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].status).toBe('PENDING');
    });

    it('handles concurrent Admin Approve vs Admin Reject: exactly one succeeds, the other fails', async () => {
      const req = await service.submitRequest(seller1Ctx, {
        document_url: 'https://cdn.dino.test/approve-reject-race.pdf',
        reason: 'Submitting request to race approve and reject on real DB',
      });

      const results = await Promise.allSettled([
        service.approveRequest(adminId, req.request_id, { note: 'Approved by race test admin' }),
        service.rejectRequest(adminId, req.request_id, { reason: 'Rejected by race test admin' }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const dbCheck = await pool.query('SELECT status FROM shop_mall_requests WHERE request_id = $1', [req.request_id]);
      expect(['APPROVED', 'REJECTED']).toContain(dbCheck.rows[0].status);
    });

    it('handles concurrent Admin Approve vs Seller Cancel: exactly one succeeds', async () => {
      const req = await service.submitRequest(seller1Ctx, {
        document_url: 'https://cdn.dino.test/approve-cancel-race.pdf',
        reason: 'Submitting request to race approve and cancel on real DB',
      });

      const results = await Promise.allSettled([
        service.approveRequest(adminId, req.request_id, { note: 'Approved during cancel race' }),
        service.cancelRequest(seller1Ctx, req.request_id),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const dbCheck = await pool.query('SELECT status FROM shop_mall_requests WHERE request_id = $1', [req.request_id]);
      expect(['APPROVED', 'CANCELLED']).toContain(dbCheck.rows[0].status);
    });
  });

  describe('Transaction Rollback Integrity (Real PostgreSQL)', () => {
    it('rolls back shop tier, request status, and admin_logs if an audit error occurs during approval', async () => {
      const req = await service.submitRequest(seller1Ctx, {
        document_url: 'https://cdn.dino.test/rollback-test.pdf',
        reason: 'Request to test rollback integrity on real database transaction',
      });

      // Create a faulty service where auditPort throws inside the transaction
      const failingAuditPort = {
        logAdminAction: async () => {
          throw new Error('SIMULATED_AUDIT_FAILURE_FOR_ROLLBACK_TEST');
        },
      };

      const faultyService = new ShopMallRequestService(
        pool,
        repo,
        new PgModerationTargetRepository(pool),
        failingAuditPort,
      );

      await expect(
        faultyService.approveRequest(adminId, req.request_id, { note: 'Should fail audit' }),
      ).rejects.toThrow();

      // VERIFY 100% ROLLBACK ON REAL POSTGRESQL:
      // 1. Request status must still be PENDING
      const reqCheck = await pool.query('SELECT status FROM shop_mall_requests WHERE request_id = $1', [req.request_id]);
      expect(reqCheck.rows[0].status).toBe('PENDING');

      // 2. Shop tier must remain STANDARD
      const shopCheck = await pool.query('SELECT tier FROM shops WHERE shop_id = $1', [shop1Id]);
      expect(shopCheck.rows[0].tier).toBe('STANDARD');

      // 3. No audit record was inserted in admin_logs
      const auditCheck = await pool.query(
        "SELECT * FROM admin_logs WHERE target_id = $1 AND action = 'SHOP_MALL_REQUEST_APPROVE'",
        [shop1Id],
      );
      expect(auditCheck.rows).toHaveLength(0);

      // Now approve with normal service and verify atomic success
      await service.approveRequest(adminId, req.request_id, { note: 'Valid admin approval note' });

      const reqActive = await pool.query('SELECT status FROM shop_mall_requests WHERE request_id = $1', [req.request_id]);
      expect(reqActive.rows[0].status).toBe('APPROVED');

      const shopActive = await pool.query('SELECT tier, tier_override FROM shops WHERE shop_id = $1', [shop1Id]);
      expect(shopActive.rows[0].tier).toBe('MALL');
      expect(shopActive.rows[0].tier_override).toBe(true);

      const auditActive = await pool.query(
        "SELECT * FROM admin_logs WHERE target_id = $1 AND action = 'SHOP_MALL_REQUEST_APPROVE'",
        [shop1Id],
      );
      expect(auditActive.rows).toHaveLength(1);
    });
  });

  describe('Idempotency & Retry Semantics (Real PostgreSQL)', () => {
    it('returns existing result on replay with same key & identical payload', async () => {
      const idempotencyKey = `idem_${randomUUID()}`;
      const payload = {
        document_url: 'https://cdn.dino.test/idempotent-doc.pdf',
        reason: 'Testing idempotency replay with same key and payload',
      };

      const first = await service.submitRequest(seller1Ctx, payload, idempotencyKey);
      const second = await service.submitRequest(seller1Ctx, payload, idempotencyKey);

      expect(first.request_id).toBe(second.request_id);
      expect(second.status).toBe('PENDING');
    });

    it('rejects replay with same key & different payload (Conflict 409)', async () => {
      const idempotencyKey = `idem_diff_${randomUUID()}`;
      const payload1 = {
        document_url: 'https://cdn.dino.test/idempotent-orig.pdf',
        reason: 'Original payload with proper character length',
      };
      const payload2 = {
        document_url: 'https://cdn.dino.test/idempotent-modified.pdf',
        reason: 'Modified payload with completely different url',
      };

      await service.submitRequest(seller1Ctx, payload1, idempotencyKey);

      await expect(
        service.submitRequest(seller1Ctx, payload2, idempotencyKey),
      ).rejects.toThrow();
    });

    it('rejects commands on an already processed request', async () => {
      const req = await service.submitRequest(seller1Ctx, {
        document_url: 'https://cdn.dino.test/processed-check.pdf',
        reason: 'Testing that processed request rejects further state mutations',
      });

      await service.rejectRequest(adminId, req.request_id, { reason: 'Application rejected by reviewer' });

      // Cannot cancel an already rejected request
      await expect(service.cancelRequest(seller1Ctx, req.request_id)).rejects.toThrow();

      // Cannot approve an already rejected request
      await expect(
        service.approveRequest(adminId, req.request_id, { note: 'Belated approval' }),
      ).rejects.toThrow();
    });
  });
});
