import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { PgCatalogHttpService } from '../../../src/modules/catalog/services/pg-catalog-http.service.ts';
import { ResourceNotFoundError } from '../../../src/modules/catalog/domain/errors.ts';
import { PgProductRepository } from '../../../src/modules/catalog/repositories/pg-catalog.repository.ts';

describe('Public shop storefront API', () => {
  it('returns only public identity fields for an active shop', async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const pool = {
      query: async (sql: string, values: unknown[]) => {
        calls.push({ sql, values });
        return { rows: [{ shop_id: 'shop-1', shop_name: 'Dino Shop', shop_tier: 'PREFERRED' }] };
      },
    } as unknown as Pool;

    const result = await new PgCatalogHttpService(pool).getPublicShop('shop-1');

    assert.deepEqual(result, { shop_id: 'shop-1', shop_name: 'Dino Shop', shop_tier: 'PREFERRED' });
    assert.deepEqual(calls[0].values, ['shop-1']);
    assert.match(calls[0].sql, /status = 'ACTIVE'/);
    assert.doesNotMatch(JSON.stringify(result), /contact|pickup|owner/i);
  });

  it('returns not found when the shop is inactive or absent', async () => {
    const pool = { query: async () => ({ rows: [] }) } as unknown as Pool;

    await assert.rejects(() => new PgCatalogHttpService(pool).getPublicShop('shop-closed'), ResourceNotFoundError);
  });

  it('applies shop_id as a bound filter to both page and count queries', async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const pool = {
      query: async (sql: string, values: unknown[]) => {
        calls.push({ sql, values: [...values] });
        return { rows: sql.includes('COUNT(*)') ? [{ count: '0' }] : [] };
      },
    } as unknown as Pool;

    const page = await new PgProductRepository(pool).queryPublic({ shopId: 'shop-1', limit: 20 });

    assert.equal(page.total, 0);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.match(call.sql, /p\.shop_id = \$1/);
      assert.equal(call.values[0], 'shop-1');
    }
  });
});
