import type { INotificationRepository } from '../domain/repositories';
import type { UUID, Notification } from '../domain/types';
import type { IDbClient } from './db-client';
import { mapNotification } from './row-mappers';

/**
 * SOLID Design Principles:
 * - Single Responsibility (S): Quản lý đọc/ghi Notification vào PostgreSQL.
 * - Dependency Inversion (D): Nhận IDbClient trừu tượng qua constructor injection.
 * - Liskov Substitution (L): Tuân thủ hoàn toàn INotificationRepository interface contract.
 */
export class PostgresNotificationRepository implements INotificationRepository {
  constructor(private readonly db: IDbClient) {}

  async findById(notificationId: UUID): Promise<Notification | null> {
    const sql = `SELECT notification_id, recipient_id, type, title, content, is_read, created_at, read_at FROM notifications WHERE notification_id = $1`;
    const result = await this.db.query(sql, [notificationId]);
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    return mapNotification(result.rows[0]);
  }

  async findByRecipientId(recipientId: UUID, isRead?: boolean): Promise<Notification[]> {
    let sql = `SELECT notification_id, recipient_id, type, title, content, is_read, created_at, read_at FROM notifications WHERE recipient_id = $1`;
    const params: any[] = [recipientId];
    if (isRead !== undefined) {
      params.push(isRead);
      sql += ` AND is_read = $${params.length}`;
    }
    sql += ` ORDER BY created_at DESC`;
    const result = await this.db.query(sql, params);
    return (result.rows ?? []).map(mapNotification);
  }

  async create(notification: Notification): Promise<Notification> {
    const sql = `
      INSERT INTO notifications (
        notification_id, recipient_id, type, title, content, is_read, created_at, read_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, now()), $8::timestamptz)
      RETURNING notification_id, recipient_id, type, title, content, is_read, created_at, read_at
    `;
    const params = [
      notification.notificationId,
      notification.recipientId,
      notification.type,
      notification.title,
      notification.content,
      notification.isRead ?? false,
      notification.createdAt ?? null,
      notification.readAt ?? null,
    ];
    const result = await this.db.query(sql, params);
    return mapNotification(result.rows[0]);
  }

  async markAsRead(notificationId: UUID, readAt?: string): Promise<Notification> {
    const sql = `
      UPDATE notifications
      SET is_read = TRUE,
          read_at = COALESCE($2::timestamptz, now())
      WHERE notification_id = $1
      RETURNING notification_id, recipient_id, type, title, content, is_read, created_at, read_at
    `;
    const params = [notificationId, readAt ?? null];
    const result = await this.db.query(sql, params);
    if (!result.rows || result.rows.length === 0) {
      throw new Error(`Notification not found: ${notificationId}`);
    }
    return mapNotification(result.rows[0]);
  }
}
