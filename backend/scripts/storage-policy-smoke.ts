import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadDatabaseConfig } from '../db/config.ts';
import { assertStoragePolicyDeploymentAllowed } from '../db/storage-policy-safety.ts';
import {
  createFixtureCategory,
  createFixtureOrder,
  createFixtureOrderItem,
  createFixtureProduct,
  createFixtureReview,
  createFixtureShop,
  createFixtureUser,
  createFixtureVariant,
  ensureAuthUser,
} from '../tests/db/fixtures/database-fixtures.ts';

const config = loadDatabaseConfig(process.env);
const projectRef = config.supabaseUrl.hostname.split('.')[0];
assertStoragePolicyDeploymentAllowed({
  databaseEnvironment: process.env.DATABASE_ENVIRONMENT,
  expectedProjectRef: process.env.EXPECTED_SUPABASE_PROJECT_REF,
  configuredProjectRef: process.env.SUPABASE_PROJECT_REF,
  allowStoragePolicyDeploy: process.env.ALLOW_STORAGE_POLICY_DEPLOY,
}, projectRef);

const pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 1 });
const client = await pool.connect();

const setAuthenticatedUser = async (userId: string): Promise<void> => {
  await client.query('SET LOCAL ROLE authenticated');
  await client.query(
    "SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
    [userId, JSON.stringify({ sub: userId, role: 'authenticated' })],
  );
};

const resetRole = async (): Promise<void> => {
  await client.query('RESET ROLE');
};

const expectRlsRejection = async (operation: () => Promise<unknown>): Promise<void> => {
  await client.query('SAVEPOINT storage_rejection');
  try {
    await operation();
    throw new Error('Expected Storage RLS to reject the operation');
  } catch (error: unknown) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code !== '42501') throw error;
    await client.query('ROLLBACK TO SAVEPOINT storage_rejection');
  }
};

const createUser = async (role: 'BUYER' | 'SELLER') => {
  const userId = randomUUID();
  const email = `${role.toLowerCase()}_${userId.slice(0, 8)}@storage-smoke.test`;
  await ensureAuthUser(client, userId, email);
  return createFixtureUser(client, { userId, email, role });
};

try {
  await client.query('BEGIN');
  const policies = await client.query<{ policyname: string }>(
    `SELECT policyname FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname = ANY($1::text[])`,
    [[
      'Public Access Product Media', 'Public Access Review Media',
      'Seller Insert Product Media', 'Seller Update Product Media', 'Seller Delete Product Media',
      'Buyer Insert Review Media', 'Buyer Update Review Media', 'Buyer Delete Review Media',
    ]],
  );
  if (policies.rowCount !== 8) throw new Error(`Expected 8 Storage policies, found ${policies.rowCount}`);

  const seller = await createUser('SELLER');
  const otherSeller = await createUser('SELLER');
  const buyer = await createUser('BUYER');
  const otherBuyer = await createUser('BUYER');
  const shop = await createFixtureShop(client, seller.userId);
  const category = await createFixtureCategory(client);
  const product = await createFixtureProduct(client, shop.shopId, category.categoryId);
  const variant = await createFixtureVariant(client, product.productId);
  const order = await createFixtureOrder(client, buyer.userId, shop.shopId, { status: 'COMPLETED' });
  const item = await createFixtureOrderItem(client, order.orderId, product.productId, variant.variantId);
  const review = await createFixtureReview(client, buyer.userId, product.productId, item.orderItemId);
  const productObjectId = randomUUID();
  const reviewObjectId = randomUUID();
  const productPath = `shops/${shop.shopId}/products/${product.productId}/${productObjectId}.webp`;
  const reviewPath = `users/${buyer.userId}/reviews/${review.reviewId}/${reviewObjectId}.jpg`;
  const updatedProductPath = `shops/${shop.shopId}/products/${product.productId}/${randomUUID()}.png`;
  const updatedReviewPath = `users/${buyer.userId}/reviews/${review.reviewId}/${randomUUID()}.webp`;

  await setAuthenticatedUser(seller.userId);
  await client.query(
    'INSERT INTO storage.objects (id, bucket_id, name, owner, owner_id) VALUES ($1, $2, $3, $4, $5)',
    [productObjectId, 'product-media', productPath, seller.userId, seller.userId],
  );
  await client.query('UPDATE storage.objects SET name = $1 WHERE id = $2', [updatedProductPath, productObjectId]);
  await expectRlsRejection(() => client.query(
    'UPDATE storage.objects SET name = $1 WHERE id = $2',
    [`shops/${otherSeller.userId}/logo.png`, productObjectId],
  ));
  await resetRole();

  await setAuthenticatedUser(otherSeller.userId);
  await expectRlsRejection(() => client.query(
    'INSERT INTO storage.objects (bucket_id, name, owner, owner_id) VALUES ($1, $2, $3, $4)',
    ['product-media', productPath.replace(productObjectId, randomUUID()), otherSeller.userId, otherSeller.userId],
  ));
  const deniedProductDelete = await client.query('DELETE FROM storage.objects WHERE id = $1', [productObjectId]);
  if (deniedProductDelete.rowCount !== 0) throw new Error('Non-owner unexpectedly deleted product media');
  await resetRole();

  await setAuthenticatedUser(buyer.userId);
  await client.query(
    'INSERT INTO storage.objects (id, bucket_id, name, owner, owner_id) VALUES ($1, $2, $3, $4, $5)',
    [reviewObjectId, 'review-media', reviewPath, buyer.userId, buyer.userId],
  );
  await client.query('UPDATE storage.objects SET name = $1 WHERE id = $2', [updatedReviewPath, reviewObjectId]);
  await expectRlsRejection(() => client.query(
    'UPDATE storage.objects SET name = $1 WHERE id = $2',
    [`users/${otherBuyer.userId}/reviews/${review.reviewId}/${randomUUID()}.jpg`, reviewObjectId],
  ));
  await expectRlsRejection(() => client.query(
    'INSERT INTO storage.objects (bucket_id, name, owner, owner_id) VALUES ($1, $2, $3, $4)',
    ['product-media', reviewPath, buyer.userId, buyer.userId],
  ));
  await resetRole();

  await setAuthenticatedUser(otherBuyer.userId);
  await expectRlsRejection(() => client.query(
    'INSERT INTO storage.objects (bucket_id, name, owner, owner_id) VALUES ($1, $2, $3, $4)',
    ['review-media', reviewPath.replace(reviewObjectId, randomUUID()), otherBuyer.userId, otherBuyer.userId],
  ));
  await resetRole();

  await setAuthenticatedUser(otherBuyer.userId);
  const deniedDelete = await client.query('DELETE FROM storage.objects WHERE id = $1', [reviewObjectId]);
  if (deniedDelete.rowCount !== 0) throw new Error('Non-owner unexpectedly deleted review media');
  await resetRole();

  await setAuthenticatedUser(buyer.userId);
  const ownerDelete = await client.query('DELETE FROM storage.objects WHERE id = $1', [reviewObjectId]);
  if (ownerDelete.rowCount !== 1) throw new Error('Review owner could not delete review media');
  await resetRole();

  await setAuthenticatedUser(seller.userId);
  const productOwnerDelete = await client.query('DELETE FROM storage.objects WHERE id = $1', [productObjectId]);
  if (productOwnerDelete.rowCount !== 1) throw new Error('Product owner could not delete product media');
  await resetRole();

  await client.query('ROLLBACK');
  process.stdout.write(`Storage ownership smoke passed for test project ${projectRef}.\n`);
} catch (error) {
  await resetRole().catch(() => undefined);
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
