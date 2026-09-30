import type { PoolClient } from 'pg';

/**
 * Stable category fixtures shared with the frontend's development category adapter.
 * These rows are development/test data and must never be seeded into production.
 */
export const DEVELOPMENT_CATEGORIES = [
  {
    categoryId: '00000000-0000-0000-0000-000000000010',
    categoryName: 'Mỹ phẩm & Chăm sóc sắc đẹp',
    description: 'Sản phẩm chăm sóc da và làm đẹp chính hãng',
  },
  {
    categoryId: '00000000-0000-0000-0000-000000000011',
    categoryName: 'Thời trang & Phụ kiện',
    description: 'Quần áo, giày dép thời trang',
  },
  {
    categoryId: '00000000-0000-0000-0000-000000000012',
    categoryName: 'Thiết bị điện tử',
    description: 'Điện thoại, bàn phím và phụ kiện công nghệ',
  },
] as const;

/**
 * Inserts the stable development categories without changing existing rows.
 * The caller owns the transaction. Conflicting IDs fail closed instead of
 * silently renaming or reactivating business data.
 */
export async function seedDevelopmentCategories(client: PoolClient): Promise<void> {
  for (const category of DEVELOPMENT_CATEGORIES) {
    await client.query(
      `INSERT INTO categories (category_id, parent_category_id, category_name, description, status)
       VALUES ($1, NULL, $2, $3, 'ACTIVE')
       ON CONFLICT (category_id) DO NOTHING`,
      [category.categoryId, category.categoryName, category.description],
    );
  }

  const expectedById = new Map(DEVELOPMENT_CATEGORIES.map((category) => [category.categoryId, category]));
  const result = await client.query<{
    category_id: string;
    parent_category_id: string | null;
    category_name: string;
    description: string | null;
    status: string;
  }>(
    `SELECT category_id, parent_category_id, category_name, description, status
       FROM categories
      WHERE category_id = ANY($1::uuid[])`,
    [[...expectedById.keys()]],
  );

  if (result.rows.length !== DEVELOPMENT_CATEGORIES.length) {
    throw new Error('Development category seed did not create every expected category');
  }

  for (const row of result.rows) {
    const expected = expectedById.get(row.category_id as (typeof DEVELOPMENT_CATEGORIES)[number]['categoryId']);
    if (
      !expected || row.parent_category_id !== null || row.category_name !== expected.categoryName ||
      row.description !== expected.description || row.status !== 'ACTIVE'
    ) {
      throw new Error(`Development category seed conflicts with existing category ${row.category_id}`);
    }
  }
}
