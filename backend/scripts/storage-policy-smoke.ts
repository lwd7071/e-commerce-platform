import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
} from '../tests/db/fixtures/database-fixtures.ts';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Storage smoke`);
  return value;
};

const config = loadDatabaseConfig(process.env);
const projectRef = config.supabaseUrl.hostname.split('.')[0];
assertStoragePolicyDeploymentAllowed({
  databaseEnvironment: process.env.DATABASE_ENVIRONMENT,
  expectedProjectRef: process.env.EXPECTED_SUPABASE_PROJECT_REF,
  configuredProjectRef: process.env.SUPABASE_PROJECT_REF,
  allowStoragePolicyDeploy: process.env.ALLOW_STORAGE_POLICY_DEPLOY,
}, projectRef);

const admin = createClient(config.supabaseUrl.toString(), required('SUPABASE_TEST_SECRET_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const publishableKey = required('SUPABASE_TEST_PUBLISHABLE_KEY');
const pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 1 });
const db = await pool.connect();
const createdUsers: string[] = [];
const uploaded: Array<{ bucket: string; path: string }> = [];

const createUser = async (role: 'BUYER' | 'SELLER') => {
  const email = `${role.toLowerCase()}_${randomUUID()}@storage-smoke.test`;
  const password = `Storage-${randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('Supabase did not create the Storage smoke user');
  const userId = data.user.id;
  createdUsers.push(userId);
  const fixture = await createFixtureUser(db, { userId, email, role });
  const user = createClient(config.supabaseUrl.toString(), publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await user.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { userId, fixture, client: user };
};

const expectDenied = async (operation: () => Promise<unknown>): Promise<void> => {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error('Expected Storage RLS to reject the operation');
};

const upload = async (user: SupabaseClient, bucket: string, path: string): Promise<void> => {
  const { error } = await user.storage.from(bucket).upload(path, new Uint8Array([1, 2, 3]), {
    contentType: 'image/png',
  });
  if (error) throw new Error(`Storage upload denied for ${bucket}/${path}: ${error.message}`);
  uploaded.push({ bucket, path });
};

try {
  await db.query('BEGIN');
  const seller = await createUser('SELLER');
  const otherSeller = await createUser('SELLER');
  const buyer = await createUser('BUYER');
  const otherBuyer = await createUser('BUYER');
  const shop = await createFixtureShop(db, seller.userId);
  const category = await createFixtureCategory(db);
  const product = await createFixtureProduct(db, shop.shopId, category.categoryId);
  const variant = await createFixtureVariant(db, product.productId);
  const order = await createFixtureOrder(db, buyer.userId, shop.shopId, { status: 'COMPLETED' });
  const item = await createFixtureOrderItem(db, order.orderId, product.productId, variant.variantId);
  const review = await createFixtureReview(db, buyer.userId, product.productId, item.orderItemId);

  process.stdout.write('Storage smoke fixtures ready.\n');
  await db.query('SET LOCAL ROLE authenticated');
  await db.query(
    "SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
    [seller.userId, JSON.stringify({ sub: seller.userId, role: 'authenticated' })],
  );
  const ownership = await db.query<{ allowed: boolean }>(
    'SELECT public.can_manage_product_media($1, $2) AS allowed',
    [shop.shopId, product.productId],
  );
  await db.query('RESET ROLE');
  if (!ownership.rows[0]?.allowed) throw new Error('Storage ownership helper rejected the fixture seller/product');
  const productPath = `shops/${shop.shopId}/products/${product.productId}/${randomUUID()}.png`;
  await upload(seller.client, 'product-media', productPath);
  process.stdout.write('Product owner upload passed.\n');
  const movedProductPath = `shops/${shop.shopId}/products/${product.productId}/${randomUUID()}.png`;
  const productMove = await seller.client.storage.from('product-media').move(productPath, movedProductPath);
  if (productMove.error) throw productMove.error;
  process.stdout.write('Product owner move passed.\n');
  uploaded.splice(uploaded.findIndex((object) => object.path === productPath), 1, {
    bucket: 'product-media', path: movedProductPath,
  });
  await expectDenied(() => otherSeller.client.storage.from('product-media').move(
    movedProductPath,
    `shops/${shop.shopId}/products/${product.productId}/${randomUUID()}.png`,
  ));
  await expectDenied(() => upload(otherSeller.client, 'product-media', productPath.replace(/[^/]+$/, `${randomUUID()}.png`)));
  await expectDenied(() => upload(seller.client, 'review-media', productPath));
  const { error: productDeleteDenied } = await otherSeller.client.storage.from('product-media').remove([movedProductPath]);
  if (productDeleteDenied) throw productDeleteDenied;
  const productCheck = await seller.client.storage.from('product-media').list(
    `shops/${shop.shopId}/products/${product.productId}`,
  );
  if (productCheck.error || !productCheck.data.some((object) => object.name === movedProductPath.split('/').at(-1))) {
    throw productCheck.error ?? new Error('Non-owner unexpectedly removed product media');
  }
  const { error: productDeleteError } = await seller.client.storage.from('product-media').remove([movedProductPath]);
  if (productDeleteError) throw productDeleteError;

  const reviewPath = `users/${buyer.userId}/reviews/${review.reviewId}/${randomUUID()}.png`;
  await upload(buyer.client, 'review-media', reviewPath);
  process.stdout.write('Review owner upload passed.\n');
  const movedReviewPath = `users/${buyer.userId}/reviews/${review.reviewId}/${randomUUID()}.png`;
  const reviewMove = await buyer.client.storage.from('review-media').move(reviewPath, movedReviewPath);
  if (reviewMove.error) throw reviewMove.error;
  uploaded.splice(uploaded.findIndex((object) => object.path === reviewPath), 1, {
    bucket: 'review-media', path: movedReviewPath,
  });
  await expectDenied(() => otherBuyer.client.storage.from('review-media').move(
    movedReviewPath,
    `users/${otherBuyer.userId}/reviews/${review.reviewId}/${randomUUID()}.png`,
  ));
  await expectDenied(() => upload(otherBuyer.client, 'review-media', reviewPath.replace(/[^/]+$/, `${randomUUID()}.png`)));
  await expectDenied(() => upload(buyer.client, 'product-media', reviewPath));
  const { error: reviewDeleteDenied } = await otherBuyer.client.storage.from('review-media').remove([movedReviewPath]);
  if (reviewDeleteDenied) throw reviewDeleteDenied;
  const reviewCheck = await buyer.client.storage.from('review-media').list(
    `users/${buyer.userId}/reviews/${review.reviewId}`,
  );
  if (reviewCheck.error || !reviewCheck.data.some((object) => object.name === movedReviewPath.split('/').at(-1))) {
    throw reviewCheck.error ?? new Error('Non-owner unexpectedly removed review media');
  }
  const { error: reviewDeleteError } = await buyer.client.storage.from('review-media').remove([movedReviewPath]);
  if (reviewDeleteError) throw reviewDeleteError;

  await db.query('ROLLBACK');
  process.stdout.write(`Storage ownership smoke passed for test project ${projectRef}.\n`);
} catch (error) {
  for (const object of uploaded) {
    await admin.storage.from(object.bucket).remove([object.path]).catch(() => undefined);
  }
  await db.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  for (const userId of createdUsers) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  db.release();
  await pool.end();
}
