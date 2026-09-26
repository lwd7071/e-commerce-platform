import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../db/client.js';
import { PostgresNotificationRepository } from '../../src/modules/buyer/infrastructure/postgres-notification.repository.ts';
import { NotificationService } from '../../src/modules/buyer/services/notification.service.ts';
import { createFixtureUser, ensureAuthUser } from './fixtures/database-fixtures.js';

const remoteDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

remoteDescribe('Notification event idempotency PostgreSQL acceptance (T3)', () => {
  let pool: Pool | undefined;
  const fixtureUserIds: string[] = [];

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 4 } });
  }, 45_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM notifications WHERE recipient_id = ANY($1::uuid[])', [fixtureUserIds]);
    await pool.query('DELETE FROM app_users WHERE user_id = ANY($1::uuid[])', [fixtureUserIds]);
    await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [fixtureUserIds]);
    await closeDatabasePool(pool);
  }, 20_000);

  it('persists one notification when two service instances consume the same event', async () => {
    if (!pool) throw new Error('Pool not initialized');
    const buyerId = randomUUID();
    const buyerEmail = `buyer_${buyerId.slice(0, 8)}@fixture.test`;
    await ensureAuthUser(pool, buyerId, buyerEmail);
    const buyer = await createFixtureUser(pool, { userId: buyerId, email: buyerEmail, role: 'BUYER' });
    fixtureUserIds.push(buyer.userId);
    const eventId = `evt-${randomUUID()}`;
    const firstRepo = new PostgresNotificationRepository(pool);
    const secondRepo = new PostgresNotificationRepository(pool);
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
  }, 20_000);
});
