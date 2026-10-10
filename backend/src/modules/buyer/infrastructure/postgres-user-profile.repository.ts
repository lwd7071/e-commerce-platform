import type { IUserProfileRepository } from '../domain/repositories';
import type { UUID, UserProfile } from '../domain/types';
import type { IDbClient } from './db-client';
import { mapUserProfile } from './row-mappers';

/**
 * SOLID Design Principles:
 * - Single Responsibility (S): Chỉ chịu trách nhiệm tương tác và lưu trữ UserProfile aggregate vào PostgreSQL.
 * - Dependency Inversion (D): Nhận IDbClient trừu tượng thông qua constructor injection.
 * - Liskov Substitution (L): Tuân thủ hoàn toàn IUserProfileRepository interface contract.
 */
export class PostgresUserProfileRepository implements IUserProfileRepository {
  constructor(private readonly db: IDbClient) {}

  async findByUserId(userId: UUID): Promise<UserProfile | null> {
    const sql = `SELECT user_id, full_name, phone, avatar_url, updated_at FROM user_profiles WHERE user_id = $1`;
    const result = await this.db.query(sql, [userId]);
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    return mapUserProfile(result.rows[0]);
  }

  async upsert(profile: UserProfile): Promise<UserProfile> {
    const sql = `
      INSERT INTO user_profiles (user_id, full_name, phone, avatar_url, updated_at)
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT (user_id) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone,
          avatar_url = EXCLUDED.avatar_url,
          updated_at = now()
      RETURNING user_id, full_name, phone, avatar_url, updated_at
    `;
    const params = [
      profile.userId,
      profile.fullName,
      profile.phone,
      profile.avatarUrl,
    ];
    const result = await this.db.query(sql, params);
    return mapUserProfile(result.rows[0]);
  }
}
