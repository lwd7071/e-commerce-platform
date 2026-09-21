import type { Pool, PoolClient } from 'pg';
import type {
  ITargetLookupRepository,
  ModerationRecord,
  UserStatus,
  UserStatusUpdateResult
} from '../domain/moderation.types.ts';
import { NotFoundError } from '../../../platform/errors/app-error.ts';

type Queryable = Pool | PoolClient;

export class PgModerationTargetRepository implements ITargetLookupRepository {
  constructor(private readonly pool: Pool) {}

  private getExecutor(trx?: unknown): Queryable {
    if (trx && typeof (trx as Queryable).query === 'function') {
      return trx as Queryable;
    }
    return this.pool;
  }

  async userExists(userId: string): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 FROM app_users WHERE user_id = $1', [userId]);
    return (res.rowCount ?? 0) > 0;
  }

  async getUserStatus(userId: string): Promise<UserStatus | null> {
    const res = await this.pool.query('SELECT status FROM app_users WHERE user_id = $1', [userId]);
    if (!res.rows || res.rows.length === 0) return null;
    return res.rows[0].status as UserStatus;
  }

  async updateUserStatus(trx: unknown, userId: string, status: UserStatus): Promise<UserStatusUpdateResult> {
    const executor = this.getExecutor(trx);
    const res = await executor.query(
      'UPDATE app_users SET status = $1, updated_at = NOW() WHERE user_id = $2 RETURNING user_id, status, updated_at',
      [status, userId]
    );
    if (!res.rows || res.rows.length === 0) {
      throw new NotFoundError(`User with id '${userId}' not found for status update`);
    }
    const row = res.rows[0];
    return {
      user_id: row.user_id,
      status: row.status as UserStatus,
      updated_at: new Date(row.updated_at).toISOString(),
    };
  }

  async shopExists(shopId: string): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 FROM shops WHERE shop_id = $1', [shopId]);
    return (res.rowCount ?? 0) > 0;
  }

  async productExists(productId: string): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 FROM products WHERE product_id = $1', [productId]);
    return (res.rowCount ?? 0) > 0;
  }

  async reviewExists(reviewId: string): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 FROM reviews WHERE review_id = $1', [reviewId]);
    return (res.rowCount ?? 0) > 0;
  }

  async insertModerationRecord(trx: unknown, record: ModerationRecord): Promise<void> {
    const executor = this.getExecutor(trx);
    await executor.query(
      `INSERT INTO moderation_records (moderation_id, target_type, target_id, reason, action, admin_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        record.moderation_id,
        record.target_type,
        record.target_id,
        record.reason,
        record.action,
        record.admin_id,
      ]
    );
  }
}
