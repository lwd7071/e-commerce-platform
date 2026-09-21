import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PostgresNotificationRepository } from '../../../../src/modules/buyer/infrastructure/postgres-notification.repository';
import { mapNotification } from '../../../../src/modules/buyer/infrastructure/row-mappers';
import { mockNotification, mockBuyerId } from '../fixtures';
import type { IDbClient } from '../../../../src/modules/buyer/infrastructure/db-client';

class MockDbClient {
  public queries: { sql: string; params: unknown[] }[] = [];
  public customHandler?: (sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

  async query(sql: string, params: unknown[] = []): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
    this.queries.push({ sql: sql.trim(), params });
    if (this.customHandler) {
      return this.customHandler(sql, params);
    }
    return { rows: [], rowCount: 0 };
  }
}

describe('Phase 5 — PostgresNotificationRepository (SOLID: S, L, D)', () => {
  describe('Row Mappers (SOLID: S — Single Responsibility)', () => {
    it('mapNotification: chuyển đổi snake_case sang Notification domain model', () => {
      const row = {
        notification_id: mockNotification.notificationId,
        recipient_id: mockBuyerId,
        type: 'ORDER',
        title: 'Đơn hàng mới',
        content: 'Bạn có một đơn hàng mới cần xử lý.',
        is_read: false,
        created_at: new Date('2026-09-17T10:00:00.000Z'),
        read_at: null,
      };
      const noti = mapNotification(row);
      assert.strictEqual(noti.notificationId, mockNotification.notificationId);
      assert.strictEqual(noti.type, 'ORDER');
      assert.strictEqual(noti.isRead, false);
      assert.strictEqual(noti.readAt, null);
    });
  });

  describe('PostgresNotificationRepository operations (SOLID: L, D)', () => {
    it('[TEST-INT-17] findById: trả về notification nếu tìm thấy hoặc null nếu không tồn tại', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({
        rows: [{
          notification_id: mockNotification.notificationId,
          recipient_id: mockBuyerId,
          type: 'ORDER',
          title: mockNotification.title,
          content: mockNotification.content,
          is_read: false,
          created_at: new Date(mockNotification.createdAt),
          read_at: null,
        }],
        rowCount: 1,
      });

      const repo = new PostgresNotificationRepository(client as IDbClient);
      const res = await repo.findById(mockNotification.notificationId);

      assert.ok(res);
      assert.strictEqual(res.notificationId, mockNotification.notificationId);
      assert.ok(client.queries[0].sql.includes('FROM notifications WHERE notification_id = $1'));
    });

    it('[TEST-INT-17] findByRecipientId: lọc theo recipient_id và trạng thái isRead (true/false)', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({ rows: [], rowCount: 0 });

      const repo = new PostgresNotificationRepository(client as IDbClient);
      await repo.findByRecipientId(mockBuyerId, false);

      const sql = client.queries[0].sql;
      assert.ok(sql.includes('recipient_id = $1'));
      assert.ok(sql.includes('is_read = $2'));
      assert.ok(sql.includes('ORDER BY created_at DESC'));
      assert.deepStrictEqual(client.queries[0].params, [mockBuyerId, false]);
    });

    it('[TEST-INT-18] create: tạo notification mới', async () => {
      const client = new MockDbClient();
      client.customHandler = async (_sql, params) => ({
        rows: [{
          notification_id: params[0],
          recipient_id: params[1],
          type: params[2],
          title: params[3],
          content: params[4],
          is_read: params[5],
          created_at: new Date('2026-09-17T10:00:00.000Z'),
          read_at: null,
        }],
        rowCount: 1,
      });

      const repo = new PostgresNotificationRepository(client as IDbClient);
      const created = await repo.create(mockNotification);

      assert.strictEqual(created.notificationId, mockNotification.notificationId);
      assert.ok(client.queries[0].sql.includes('INSERT INTO notifications'));
    });

    it('[TEST-INT-18] markAsRead: cập nhật is_read = TRUE và read_at = now() hoặc readAt được truyền vào', async () => {
      const customReadTime = '2026-09-17T15:30:00.000Z';
      const client = new MockDbClient();
      client.customHandler = async (_sql, params) => ({
        rows: [{
          notification_id: params[0],
          recipient_id: mockBuyerId,
          type: 'ORDER',
          title: mockNotification.title,
          content: mockNotification.content,
          is_read: true,
          created_at: new Date('2026-09-17T10:00:00.000Z'),
          read_at: new Date(customReadTime),
        }],
        rowCount: 1,
      });

      const repo = new PostgresNotificationRepository(client as IDbClient);
      const updated = await repo.markAsRead(mockNotification.notificationId, customReadTime);

      assert.strictEqual(updated.isRead, true);
      assert.strictEqual(updated.readAt, customReadTime);
      assert.ok(client.queries[0].sql.includes('UPDATE notifications'));
      assert.ok(client.queries[0].sql.includes('is_read = TRUE'));
      assert.ok(client.queries[0].sql.includes('read_at ='));
    });

    it('[TEST-INT-19] Check constraint violation (RB-LTT07): lan truyền lỗi check constraint 23514', async () => {
      const client = new MockDbClient();
      const checkError = Object.assign(new Error('new row for relation "notifications" violates check constraint "ck_notifications__read_at"'), {
        code: '23514',
        constraint: 'ck_notifications__read_at',
      });
      client.customHandler = async () => { throw checkError; };

      const repo = new PostgresNotificationRepository(client as IDbClient);
      await assert.rejects(
        () => repo.create({ ...mockNotification, isRead: true, readAt: null }),
        (err: unknown) => {
          const e = err as { code?: string; constraint?: string };
          return e.code === '23514' && e.constraint === 'ck_notifications__read_at';
        }
      );
    });
  });
});
