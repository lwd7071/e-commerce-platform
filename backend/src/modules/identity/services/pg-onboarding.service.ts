import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { withTransaction } from '../../../../db/transaction.ts';
import { ConflictError, NotFoundError, UserLockedError, ValidationFailedError } from '../../../platform/errors/app-error.ts';

export type OnboardingInput = {
  full_name: string;
  requested_role: 'BUYER' | 'SELLER';
  shop_name: string | null;
};

export type OnboardingResult = {
  user_id: string;
  email: string;
  role: 'BUYER' | 'SELLER';
  profile_completed: true;
  shop: { shop_id: string; shop_name: string; status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED' } | null;
};

const parseInput = (input: unknown): OnboardingInput => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationFailedError('Onboarding payload must be an object');
  }
  const record = input as Record<string, unknown>;
  const unknown = Object.keys(record).find(key => !['full_name', 'requested_role', 'shop_name'].includes(key));
  if (unknown) throw new ValidationFailedError(`Unknown field: ${unknown}`, { field: unknown });
  const fullName = typeof record.full_name === 'string' ? record.full_name.trim() : '';
  if (fullName.length < 2 || fullName.length > 150) {
    throw new ValidationFailedError('Full name must contain 2 to 150 characters', { field: 'full_name' });
  }
  if (record.requested_role !== 'BUYER' && record.requested_role !== 'SELLER') {
    throw new ValidationFailedError('Requested role must be BUYER or SELLER', { field: 'requested_role' });
  }
  const shopName = record.shop_name === null || record.shop_name === undefined
    ? null
    : typeof record.shop_name === 'string' ? record.shop_name.trim() : '';
  if (record.requested_role === 'SELLER' && (!shopName || shopName.length < 2 || shopName.length > 150)) {
    throw new ValidationFailedError('Seller onboarding requires a shop name of 2 to 150 characters', { field: 'shop_name' });
  }
  if (record.requested_role === 'BUYER' && shopName !== null) {
    throw new ValidationFailedError('Buyer onboarding does not accept a shop name', { field: 'shop_name' });
  }
  return { full_name: fullName, requested_role: record.requested_role, shop_name: shopName };
};

export class PgOnboardingService {
  constructor(private readonly pool: Pool) {}

  async isProfileCompleted(userId: string): Promise<boolean> {
    const result = await this.pool.query('SELECT 1 FROM user_profiles WHERE user_id=$1', [userId]);
    return result.rowCount === 1;
  }

  async completeOnboarding(userId: string, rawInput: unknown): Promise<OnboardingResult> {
    const input = parseInput(rawInput);
    return withTransaction(this.pool, async client => {
      const userResult = await client.query<{ user_id: string; email: string; role: string; status: string }>(
        'SELECT user_id,email,role,status FROM app_users WHERE user_id=$1 FOR UPDATE', [userId],
      );
      const user = userResult.rows[0];
      if (!user) throw new NotFoundError('Auth user has not been provisioned');
      if (user.status !== 'ACTIVE') throw new UserLockedError();

      const profileResult = await client.query<{ full_name: string }>(
        'SELECT full_name FROM user_profiles WHERE user_id=$1', [userId],
      );
      const shopResult = await client.query<{ shop_id: string; shop_name: string; status: string }>(
        'SELECT shop_id,shop_name,status FROM shops WHERE owner_id=$1', [userId],
      );
      if (profileResult.rows[0]) {
        const existingShop = shopResult.rows[0] ?? null;
        const matches = user.role === input.requested_role
          && profileResult.rows[0].full_name === input.full_name
          && (input.requested_role === 'BUYER'
            ? existingShop === null && input.shop_name === null
            : existingShop?.shop_name === input.shop_name);
        if (!matches) throw new ConflictError('ONBOARDING_ALREADY_COMPLETED', 'Onboarding data conflicts with the completed profile');
        return {
          user_id: user.user_id,
          email: user.email,
          role: user.role as 'BUYER' | 'SELLER',
          profile_completed: true,
          shop: existingShop ? { shop_id: existingShop.shop_id, shop_name: existingShop.shop_name, status: existingShop.status as 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED' } : null,
        };
      }
      if (user.role !== 'BUYER') {
        throw new ConflictError('ONBOARDING_STATE_CONFLICT', 'Account role is not eligible for first-time onboarding');
      }
      if (shopResult.rows[0]) {
        throw new ConflictError('SHOP_ALREADY_EXISTS', 'An account can own only one shop');
      }

      await client.query(
        `INSERT INTO user_profiles (user_id,full_name,phone,avatar_url,updated_at)
         VALUES ($1,$2,NULL,NULL,now())`, [userId, input.full_name],
      );

      let shop: OnboardingResult['shop'] = null;
      if (input.requested_role === 'SELLER' && input.shop_name) {
        await client.query(`UPDATE app_users SET role='SELLER',updated_at=now() WHERE user_id=$1`, [userId]);
        const shopId = randomUUID();
        const result = await client.query<{ shop_id: string; shop_name: string }>(
          `INSERT INTO shops (shop_id,owner_id,shop_name,status,created_at,updated_at)
           VALUES ($1,$2,$3,'PENDING',now(),now()) RETURNING shop_id,shop_name`, [shopId, userId, input.shop_name],
        );
        shop = { ...result.rows[0], status: 'PENDING' };
      }

      return {
        user_id: user.user_id,
        email: user.email,
        role: input.requested_role,
        profile_completed: true,
        shop,
      };
    });
  }
}
