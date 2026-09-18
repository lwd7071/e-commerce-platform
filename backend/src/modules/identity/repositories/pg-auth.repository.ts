import type { Pool, PoolClient } from 'pg';
import type { IAuthRepository } from './auth.repository.ts';
import type { AuthUserRecord } from '../domain/types.ts';

type QueryRunner = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export class PgAuthRepository implements IAuthRepository {
  constructor(private readonly db: QueryRunner) {}

  async findUserById(userId: string): Promise<AuthUserRecord | null> {
    const result = await this.db.query(
      `SELECT user_id AS id, email, role, status, created_at, updated_at
         FROM app_users WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0] ? (result.rows[0] as AuthUserRecord) : null;
  }

  async findShopByOwnerId(ownerId: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT shop_id FROM shops WHERE owner_id = $1 AND status <> 'LOCKED' LIMIT 1`,
      [ownerId],
    );
    return result.rows[0]?.shop_id ?? null;
  }
}
