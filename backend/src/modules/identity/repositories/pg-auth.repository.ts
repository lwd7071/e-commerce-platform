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
    if (result.rows[0]) {
      return result.rows[0] as AuthUserRecord;
    }

    try {
      const bootstrap = await this.db.query(
        `INSERT INTO app_users (user_id, email, role, status)
         SELECT users.id, users.email, 'BUYER', 'ACTIVE'
         FROM auth.users AS users
         WHERE users.id = $1 AND users.email IS NOT NULL AND btrim(users.email) <> ''
         ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email
         RETURNING user_id AS id, email, role, status, created_at, updated_at`,
        [userId],
      );
      return bootstrap.rows[0] ? (bootstrap.rows[0] as AuthUserRecord) : null;
    } catch {
      return null;
    }
  }

  async findShopByOwnerId(ownerId: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT shop_id FROM shops WHERE owner_id = $1 AND status <> 'LOCKED' LIMIT 1`,
      [ownerId],
    );
    return result.rows[0]?.shop_id ?? null;
  }

  async findShopStatusByOwnerId(ownerId: string): Promise<string | null> {
    const result = await this.db.query('SELECT status FROM shops WHERE owner_id = $1 LIMIT 1', [ownerId]);
    return result.rows[0]?.status ?? null;
  }
}
