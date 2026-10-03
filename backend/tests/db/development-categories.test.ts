import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { DEVELOPMENT_CATEGORIES, seedDevelopmentCategories } from '../../db/seed/development-categories.js';

type CategoryRow = {
  category_id: string;
  parent_category_id: string | null;
  category_name: string;
  description: string | null;
  status: string;
};

function fakeClient(rows: CategoryRow[] = DEVELOPMENT_CATEGORIES.map((category) => ({
  category_id: category.categoryId,
  parent_category_id: null,
  category_name: category.categoryName,
  description: category.description,
  status: 'ACTIVE',
}))) {
  return { query: vi.fn().mockResolvedValue({ rows }) };
}

describe('seedDevelopmentCategories', () => {
  it('inserts stable categories idempotently and verifies their contents', async () => {
    const client = fakeClient();
    await seedDevelopmentCategories(client as unknown as PoolClient);

    expect(client.query).toHaveBeenCalledTimes(DEVELOPMENT_CATEGORIES.length + 1);
    for (const [sql, values] of client.query.mock.calls.slice(0, DEVELOPMENT_CATEGORIES.length)) {
      expect(sql).toContain('ON CONFLICT (category_id) DO NOTHING');
      expect(sql).not.toContain('DO UPDATE');
      expect(values).toEqual([
        expect.stringMatching(/^00000000-0000-0000-0000-00000000001[0-2]$/),
        expect.any(String),
        expect.any(String),
      ]);
    }
    expect(client.query.mock.calls.at(-1)?.[0]).toContain('SELECT category_id');
  });

  it('fails if a stable ID already belongs to different category data', async () => {
    const rows: CategoryRow[] = DEVELOPMENT_CATEGORIES.map((category) => ({
      category_id: category.categoryId,
      parent_category_id: null,
      category_name: category.categoryName,
      description: category.description,
      status: 'ACTIVE',
    }));
    rows[0] = { ...rows[0], category_name: 'Existing business category' };
    const client = fakeClient(rows);

    await expect(seedDevelopmentCategories(client as unknown as PoolClient))
      .rejects.toThrow('conflicts with existing category');
  });

  it('fails when one or more expected rows are missing', async () => {
    const client = fakeClient([]);
    await expect(seedDevelopmentCategories(client as unknown as PoolClient))
      .rejects.toThrow('did not create every expected category');
  });
});
