import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { createFixtureUser } from './fixtures/database-fixtures.ts';
import { createApp } from '../../src/platform/http/app.ts';
import { AdminNotificationCampaignService } from '../../src/modules/moderation/services/admin-notification-campaign.service.ts';

const dbDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

dbDescribe('Admin Notification Campaign: Idempotency & Batch Worker (isolated PostgreSQL schema)', { sequential: true, timeout: 60_000 }, () => {
  const schema = `admin_cmp_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let app: ReturnType<typeof createApp>;
  let adminId: string;
  let campaignService: AdminNotificationCampaignService;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({
      connectionString: config.directUrl.toString(),
      max: 4,
      connectionTimeoutMillis: 10_000,
      options: `-c search_path=${schema} -c statement_timeout=20000`,
      application_name: schema,
    });
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query('CREATE TABLE fixture_auth_users (id uuid PRIMARY KEY)');

    const initial = await readFile(new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url), 'utf8');
    await pool.query(initial.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '').replaceAll('auth.users', 'fixture_auth_users'));

    const hardening = await readFile(new URL('../../prisma/migrations/20260926100000_t3_cross_domain_hardening/migration.sql', import.meta.url), 'utf8');
    await pool.query(hardening);

    const campaignSql = await readFile(new URL('../../prisma/migrations/20261002100000_admin_notification_campaigns/migration.sql', import.meta.url), 'utf8');
    await pool.query(campaignSql);

    adminId = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1)', [adminId]);
    await createFixtureUser(pool, { userId: adminId, role: 'ADMIN' });

    campaignService = new AdminNotificationCampaignService(pool);

    app = createApp({
      pool,
      adminCampaigns: campaignService,
      rateLimiter: false,
      auth: (req, _res, next) => {
        req.context = { user_id: adminId, role: 'ADMIN', request_id: req.requestId ?? 'admin-cmp-pg' };
        next();
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (pool) {
      try {
        await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      } finally {
        await pool.end();
      }
    }
  }, 30_000);

  it('[ADMIN-09] creates campaign with idempotency, logs audit, replays idempotency and prevents key collision', async () => {
    // Tạo 3 buyer active để nhận notification
    const b1 = randomUUID();
    const b2 = randomUUID();
    const b3 = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1), ($2), ($3)', [b1, b2, b3]);
    await createFixtureUser(pool, { userId: b1, role: 'BUYER' });
    await createFixtureUser(pool, { userId: b2, role: 'BUYER' });
    await createFixtureUser(pool, { userId: b3, role: 'BUYER' });

    const key = `campaign-idem-${randomUUID()}`;
    const payload = {
      audience_role: 'BUYER',
      title: 'Đại tiệc siêu sale 10.10',
      content: 'Nhận ngay hàng ngàn voucher giảm tới 50% hôm nay!',
      reason: 'Chiến dịch kích cầu mua sắm quý 4',
    };

    // 1. Tạo campaign lần đầu -> 201
    const createRes = await request(app)
      .post('/api/v1/admin/notification-campaigns')
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);

    const campaignId = createRes.body.data.campaign_id;
    expect(createRes.body.data.audience_role).toBe('BUYER');
    expect(createRes.body.data.recipient_count).toBeGreaterThanOrEqual(3);
    expect(createRes.body.data.status).toBe('PENDING');

    // Kiểm tra audit log
    const auditRes = await pool.query(
      "SELECT * FROM admin_logs WHERE target_id = $1 AND action = 'CREATE_NOTIFICATION_CAMPAIGN'",
      [campaignId]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].reason).toBe('Chiến dịch kích cầu mua sắm quý 4');

    // 2. Replay cùng Idempotency-Key và cùng payload -> Trả về campaign đã tạo, không tạo duplicate
    const replayRes = await request(app)
      .post('/api/v1/admin/notification-campaigns')
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);

    expect(replayRes.body.data.campaign_id).toBe(campaignId);

    // Đảm bảo không bị nhân bản campaign trong DB
    const countRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM admin_notification_campaigns WHERE admin_id = $1 AND idempotency_key = $2',
      [adminId, key]
    );
    expect(countRes.rows[0].count).toBe(1);

    // 3. Tái sử dụng cùng Idempotency-Key nhưng khác payload -> 409 IDEMPOTENCY_KEY_REUSED
    const conflictRes = await request(app)
      .post('/api/v1/admin/notification-campaigns')
      .set('Idempotency-Key', key)
      .send({
        ...payload,
        title: 'Tiêu đề đã bị thay đổi gian lận',
      })
      .expect(409);

    expect(conflictRes.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('[ADMIN-09] batch worker dispatches notifications with FOR UPDATE SKIP LOCKED and completes campaign', async () => {
    const s1 = randomUUID();
    const s2 = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1), ($2)', [s1, s2]);
    await createFixtureUser(pool, { userId: s1, role: 'SELLER' });
    await createFixtureUser(pool, { userId: s2, role: 'SELLER' });

    const key = `seller-camp-${randomUUID()}`;
    const createRes = await request(app)
      .post('/api/v1/admin/notification-campaigns')
      .set('Idempotency-Key', key)
      .send({
        audience_role: 'SELLER',
        title: 'Cập nhật chính sách người bán mới',
        content: 'Chính sách vận chuyển và thời gian đóng gói hàng.',
        reason: 'Thông báo quy chuẩn vận hành người bán',
      })
      .expect(201);

    const campaignId = createRes.body.data.campaign_id;
    expect(createRes.body.data.recipient_count).toBeGreaterThanOrEqual(2);

    // Chạy processBatch để worker xử lý recipients đang PENDING
    const processedCount = await campaignService.processBatch(100);
    expect(processedCount).toBeGreaterThanOrEqual(2);

    // Kiểm tra status của campaign sau khi xử lý xong toàn bộ recipients
    const progressRes = await campaignService.getProgress(campaignId);
    expect(progressRes.status).toBe('COMPLETED');
    expect(progressRes.delivered_count).toBe(progressRes.recipient_count);

    // Kiểm tra notifications thực tế đã được insert vào bảng notifications
    const notifs = await pool.query(
      "SELECT * FROM notifications WHERE type = 'SYSTEM' AND recipient_id = ANY($1::uuid[])",
      [[s1, s2]]
    );
    expect(notifs.rows.length).toBe(2);
    expect(notifs.rows[0].title).toBe('Cập nhật chính sách người bán mới');
  });
});
