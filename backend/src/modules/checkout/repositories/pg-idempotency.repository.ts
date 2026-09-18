import type { PoolClient } from 'pg';
import { createHash } from 'node:crypto';
import type { CheckoutResult } from '../contracts/checkout-result.ts';
import type { IdempotencyScope } from '../contracts/idempotency.port.ts';

export type TransactionalIdempotencyClaim<T> =
  | { readonly kind: 'acquired' }
  | { readonly kind: 'replay'; readonly result: T }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'in_progress' };

export function checkoutIdempotencyScope(userId: string, key: string): IdempotencyScope {
  return { user_id: userId, endpoint: '/api/v1/orders', key };
}

export function canonicalCheckoutFingerprint(command: {
  address_id: string;
  payment_method: 'COD' | 'ONLINE';
  vouchers: readonly { shop_id: string; code: string }[];
}): string {
  const payload = {
    address_id: command.address_id.toLowerCase(),
    payment_method: command.payment_method,
    vouchers: [...command.vouchers]
      .map((voucher) => ({ shop_id: voucher.shop_id.toLowerCase(), code: voucher.code.trim() }))
      .sort((left, right) => left.shop_id.localeCompare(right.shop_id) || left.code.localeCompare(right.code)),
  };
  return createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

export class PgIdempotencyRepository {
  constructor(private readonly client: PoolClient) {}

  async claim<T>(scope: IdempotencyScope, fingerprint: string): Promise<TransactionalIdempotencyClaim<T>> {
    const lockScope = JSON.stringify(['v1', scope.user_id, scope.endpoint, scope.key]);
    const lock = await this.client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired',
      [lockScope],
    );
    if (!lock.rows[0]?.acquired) return { kind: 'in_progress' };

    await this.client.query(
      `DELETE FROM api_idempotency_records
        WHERE user_id = $1 AND endpoint = $2 AND idempotency_key = $3 AND expires_at <= now()`,
      [scope.user_id, scope.endpoint, scope.key],
    );
    const existing = await this.client.query<{ fingerprint: string; result: T }>(
      `SELECT fingerprint, result FROM api_idempotency_records
        WHERE user_id = $1 AND endpoint = $2 AND idempotency_key = $3`,
      [scope.user_id, scope.endpoint, scope.key],
    );
    if (!existing.rows[0]) return { kind: 'acquired' };
    return existing.rows[0].fingerprint === fingerprint
      ? { kind: 'replay', result: existing.rows[0].result }
      : { kind: 'conflict' };
  }

  async complete(scope: IdempotencyScope, fingerprint: string, result: CheckoutResult, expiresAt: string): Promise<void> {
    await this.client.query(
      `INSERT INTO api_idempotency_records
        (user_id, endpoint, idempotency_key, fingerprint, result, expires_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [scope.user_id, scope.endpoint, scope.key, fingerprint, JSON.stringify(result), expiresAt],
    );
  }
}
