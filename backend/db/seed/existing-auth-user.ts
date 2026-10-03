import type { PoolClient } from 'pg';

export type SeedUserRole = 'BUYER' | 'SELLER' | 'ADMIN';
export type SeedUserStatus = 'ACTIVE' | 'LOCKED';

export type ExistingAuthUserSeed = {
  userId: string;
  email: string;
  role: SeedUserRole;
  status: SeedUserStatus;
  fullName: string;
};

const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const requiredText = (name: string, value: unknown, maxLength: number): string => {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new RangeError(`${name} must contain between 1 and ${maxLength} characters`);
  }
  return normalized;
};

const validateSeed = (seed: ExistingAuthUserSeed): ExistingAuthUserSeed => {
  if (typeof seed !== 'object' || seed === null) throw new TypeError('seed must be an object');
  if (typeof seed.userId !== 'string' || !canonicalUuid.test(seed.userId)) {
    throw new TypeError('userId must be a canonical lowercase UUID');
  }
  const email = requiredText('email', seed.email, 255).toLowerCase();
  const fullName = requiredText('fullName', seed.fullName, 150);
  if (!['BUYER', 'SELLER', 'ADMIN'].includes(seed.role)) throw new TypeError('role is invalid');
  if (!['ACTIVE', 'LOCKED'].includes(seed.status)) throw new TypeError('status is invalid');
  return { ...seed, email, fullName };
};

/**
 * Synchronizes an existing Supabase Auth identity into the business tables.
 * The caller owns BEGIN/COMMIT/ROLLBACK; this function never controls the parent transaction.
 * Role and status are intentionally insert-only so a repeated seed cannot silently change access.
 */
export async function seedExistingAuthUser(client: PoolClient, seed: ExistingAuthUserSeed): Promise<void> {
  const normalized = validateSeed(seed);

  await client.query(
    `INSERT INTO app_users (user_id, email, role, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
       SET email = EXCLUDED.email,
           updated_at = now()`,
    [normalized.userId, normalized.email, normalized.role, normalized.status],
  );

  await client.query(
    `INSERT INTO user_profiles (user_id, full_name)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           updated_at = now()`,
    [normalized.userId, normalized.fullName],
  );
}
