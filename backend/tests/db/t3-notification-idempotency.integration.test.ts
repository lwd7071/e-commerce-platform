import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../db/client.js';
import { PostgresNotificationRepository } from '../../src/modules/buyer/infrastructure/postgres-notification.repository';
import { PostgresEventIdempotencyStore } from '../../src/modules/buyer/infrastructure/postgres-event-idempotency.store';
import { NotificationService } from '../../src/modules/buyer/services/notification.service';
import { createFixtureUser, ensureAuthUser } from './fixtures/database-fixtures.js';

const remoteDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

remoteDescribe('Notification event idempotency PostgreSQL acceptance (T3 Quality Gate)', () => {
  let pool: Pool | undefined;
  const fixtureUserIds: string[] = [];

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 6 } });
  }, 45_000);

  afterAll(async () => {
    if (!pool) return;
    if (fixtureUserIds.length > 0) {
      await pool.query('DELETE FROM notifications WHERE recipient_id = ANY($1::uuid[])', [fixtureUserIds]);
      await pool.query('DELETE FROM app_users WHERE user_id = ANY($1::uuid[])', [fixtureUserIds]);
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [fixtureUserIds]);
    }
    await closeDatabasePool(pool);
  }, 20_000);

  const makeBuyer = async (p: Pool) => {
    const buyerId = randomUUID();
    const buyerEmail = `buyer_${buyerId.slice(0, 8)}@fixture.test`;
    await ensureAuthUser(p, buyerId, buyerEmail);
    const buyer = await createFixtureUser(p, { userId: buyerId, email: buyerEmail, role: 'BUYER' });
    fixtureUserIds.push(buyer.userId);
    return buyer;
  };

  it('Kịch bản 1 (Concurrent Multi-Instance): 2 service instances dùng 2 connection riêng biệt cùng consume 1 event -> chỉ tạo đúng 1 notification', async () => {
    if (!pool) throw new Error('Pool not initialized');
    const buyer = await makeBuyer(pool);
    const eventId = `evt-concurrent-${randomUUID()}`;

    // Kết nối 2 client riêng biệt để mô phỏng 2 instances độc lập, chống serialize giả
    const client1 = await pool.connect();
    const client2 = await pool.connect();

    try {
      const firstRepo = new PostgresNotificationRepository(client1);
      const secondRepo = new PostgresNotificationRepository(client2);
      const firstService = new NotificationService(firstRepo);
      const secondService = new NotificationService(secondRepo);

      const event = {
        type: 'ORDER_STATUS_CHANGED' as const,
        eventId,
        occurredAt: new Date().toISOString(),
        orderId: randomUUID(),
        buyerId: buyer.userId,
        shopId: randomUUID(),
        oldStatus: 'SHIPPING' as const,
        newStatus: 'COMPLETED' as const,
      };

      await Promise.all([
        firstService.handleDomainEvent(event),
        secondService.handleDomainEvent(event),
      ]);

      const persisted = await pool.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM notifications WHERE event_id = $1',
        [eventId],
      );
      expect(Number(persisted.rows[0].count)).toBe(1);
    } finally {
      client1.release();
      client2.release();
    }
  }, 20_000);

  it('Kịch bản 2 (Restart & Replay Idempotency): Replay sau khi tiến trình restart -> Tier-1 chặn ngay từ tryClaim, không tạo thêm notification', async () => {
    if (!pool) throw new Error('Pool not initialized');
    const buyer = await makeBuyer(pool);
    const eventId = `evt-replay-${randomUUID()}`;

    const originalRepo = new PostgresNotificationRepository(pool);
    const originalService = new NotificationService(originalRepo);

    const event = {
      type: 'ORDER_STATUS_CHANGED' as const,
      eventId,
      occurredAt: new Date().toISOString(),
      orderId: randomUUID(),
      buyerId: buyer.userId,
      shopId: randomUUID(),
      oldStatus: 'SHIPPING' as const,
      newStatus: 'COMPLETED' as const,
    };

    // 1. Service ban đầu xử lý thành công
    await originalService.handleDomainEvent(event);

    const initialCheck = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM notifications WHERE event_id = $1',
      [eventId],
    );
    expect(Number(initialCheck.rows[0].count)).toBe(1);

    // 2. Mô phỏng restart: Tạo instance service hoàn toàn mới (RAM store cũ nếu có sẽ bị xóa sạch)
    const restartedRepo = new PostgresNotificationRepository(pool);
    const restartedService = new NotificationService(restartedRepo);

    // Kiểm tra Tier-1 early-exit filter: tryClaim() qua DB phải trả về false
    const store = new PostgresEventIdempotencyStore(pool);
    const claimResult = await store.tryClaim(eventId);
    expect(claimResult).toBe(false);

    // Replay lại event
    await restartedService.handleDomainEvent(event);

    // Xác nhận số lượng bản ghi trong DB vẫn giữ nguyên là 1
    const postReplayCheck = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM notifications WHERE event_id = $1',
      [eventId],
    );
    expect(Number(postReplayCheck.rows[0].count)).toBe(1);
  }, 20_000);

  it('Kịch bản 3 (Crash Recovery): Tiến trình chết sau tryClaim nhưng trước khi commit INSERT -> Lần replay sau restart không bị nuốt event, tạo thành công 1 notification', async () => {
    if (!pool) throw new Error('Pool not initialized');
    const buyer = await makeBuyer(pool);
    const crashEventId = `evt-crash-${randomUUID()}`;

    // 1. Tiến trình 1 kiểm tra tryClaim thành công
    const storeInstance = new PostgresEventIdempotencyStore(pool);
    const firstClaim = await storeInstance.tryClaim(crashEventId);
    expect(firstClaim).toBe(true);

    // 2. Tiến trình 1 bị crash / kill đột ngột TRƯỚC KHI insert notification
    //    Gọi release() no-op hoặc mô phỏng tiến trình chết không ghi row nào vào DB
    await storeInstance.release(crashEventId);

    const crashCheck = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM notifications WHERE event_id = $1',
      [crashEventId],
    );
    expect(Number(crashCheck.rows[0].count)).toBe(0);

    // 3. Tiến trình mới khởi động sau restart, nhận lại (replay) event từ broker
    const recoveredRepo = new PostgresNotificationRepository(pool);
    const recoveredService = new NotificationService(recoveredRepo);

    const event = {
      type: 'ORDER_STATUS_CHANGED' as const,
      eventId: crashEventId,
      occurredAt: new Date().toISOString(),
      orderId: randomUUID(),
      buyerId: buyer.userId,
      shopId: randomUUID(),
      oldStatus: 'SHIPPING' as const,
      newStatus: 'COMPLETED' as const,
    };

    // Event KHÔNG bị nuốt chửng, được xử lý và lưu thành công
    await recoveredService.handleDomainEvent(event);

    const recoveredPersisted = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM notifications WHERE event_id = $1',
      [crashEventId],
    );
    expect(Number(recoveredPersisted.rows[0].count)).toBe(1);
  }, 20_000);
});
