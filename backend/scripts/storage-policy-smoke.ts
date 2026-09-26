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
let cleanupError: unknown;
const fixtureIds: {
  shopId?: string;
  categoryId?: string;
  productId?: string;
  variantId?: string;
  orderId?: string;
  orderItemId?: string;
  reviewId?: string;
} = {};

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
  const accessToken = signIn.data.session.access_token;
  const tokenClaims = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8')) as {
    sub?: string;
    role?: string;
  };
  if (tokenClaims.sub !== userId || tokenClaims.role !== 'authenticated') {
    throw new Error('Storage smoke sign-in returned an unexpected JWT identity or role');
  }
  return { userId, fixture, client: user, tokenClaims };
};

const expectDenied = async (operation: () => Promise<unknown>): Promise<void> => {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error('Expected Storage RLS to reject the operation');
};

const expectMoveDenied = async (
  user: SupabaseClient,
  bucket: string,
  source: string,
  destination: string,
): Promise<void> => {
  const { error } = await user.storage.from(bucket).move(source, destination);
  if (error) return;
  const directory = source.slice(0, source.lastIndexOf('/'));
  const listing = await user.storage.from(bucket).list(directory);
  if (listing.error) throw listing.error;
  const names = new Set(listing.data.map((object) => object.name));
  const sourceName = source.split('/').at(-1);
  const destinationName = destination.split('/').at(-1);
  if (!sourceName || !destinationName || !names.has(sourceName) || names.has(destinationName)) {
    throw new Error('Non-owner Storage move changed object path despite RLS');
  }
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
  fixtureIds.shopId = shop.shopId;
  const category = await createFixtureCategory(db);
  fixtureIds.categoryId = category.categoryId;
  const product = await createFixtureProduct(db, shop.shopId, category.categoryId);
  fixtureIds.productId = product.productId;
  const variant = await createFixtureVariant(db, product.productId);
  fixtureIds.variantId = variant.variantId;
  const order = await createFixtureOrder(db, buyer.userId, shop.shopId, { status: 'COMPLETED' });
  fixtureIds.orderId = order.orderId;
  const item = await createFixtureOrderItem(db, order.orderId, product.productId, variant.variantId);
  fixtureIds.orderItemId = item.orderItemId;
  const review = await createFixtureReview(db, buyer.userId, product.productId, item.orderItemId);
  fixtureIds.reviewId = review.reviewId;

  // Supabase Storage evaluates RLS on its own database connection. Commit these
  // test-only rows first so policy subqueries can see the owning shop/product/review.
  await db.query('COMMIT');
  await db.query('BEGIN READ ONLY');

  process.stdout.write('Storage smoke fixtures ready.\n');
  await db.query('SET LOCAL ROLE authenticated');
  await db.query(
    "SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
    [seller.tokenClaims.sub, JSON.stringify(seller.tokenClaims)],
  );
  const ownership = await db.query<{ allowed: boolean; auth_uid: string; auth_role: string; folder_parts: string[] }>(
    `SELECT public.can_manage_product_media($1, $2) AS allowed,
       auth.uid()::text AS auth_uid, auth.role() AS auth_role,
       storage.foldername($3) AS folder_parts`,
    [shop.shopId, product.productId, `shops/${shop.shopId}/products/${product.productId}/${randomUUID()}.png`],
  );
  await db.query('RESET ROLE');
  if (!ownership.rows[0]?.allowed || ownership.rows[0]?.auth_uid !== seller.userId || ownership.rows[0]?.auth_role !== 'authenticated') {
    throw new Error('Storage ownership preflight did not match the authenticated seller and product fixture');
  }
  if (ownership.rows[0]?.folder_parts.length !== 4) throw new Error('Storage product path did not parse to four folders');
  await db.query('ROLLBACK');
  const apiUser = await seller.client.auth.getUser();
  if (apiUser.error || apiUser.data.user?.id !== seller.userId) {
    throw new Error('Storage API client identity did not match the seller fixture');
  }
  const apiOwnership = await seller.client.rpc('can_manage_product_media', {
    target_shop_id: shop.shopId,
    target_product_id: product.productId,
  });
  if (apiOwnership.error || apiOwnership.data !== true) {
    throw new Error(`Supabase API ownership helper check failed: ${apiOwnership.error?.code ?? 'false'} ${apiOwnership.error?.message ?? ''}`);
  }
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
  await expectMoveDenied(
    otherSeller.client,
    'product-media',
    movedProductPath,
    `shops/${shop.shopId}/products/${product.productId}/${randomUUID()}.png`,
  );
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
  await expectMoveDenied(
    otherBuyer.client,
    'review-media',
    movedReviewPath,
    `users/${otherBuyer.userId}/reviews/${review.reviewId}/${randomUUID()}.png`,
  );
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

} finally {
  try {
    await db.query('ROLLBACK').catch(() => undefined);
    for (const object of uploaded) {
      const { error } = await admin.storage.from(object.bucket).remove([object.path]);
      if (error) cleanupError ??= error;
    }
    await db.query('BEGIN');
    if (fixtureIds.reviewId) {
      await db.query('DELETE FROM review_images WHERE review_id = $1', [fixtureIds.reviewId]);
      await db.query('DELETE FROM reviews WHERE review_id = $1', [fixtureIds.reviewId]);
    }
    if (fixtureIds.orderItemId) await db.query('DELETE FROM order_items WHERE order_item_id = $1', [fixtureIds.orderItemId]);
    if (fixtureIds.orderId) await db.query('DELETE FROM orders WHERE order_id = $1', [fixtureIds.orderId]);
    if (fixtureIds.variantId) await db.query('DELETE FROM product_variants WHERE variant_id = $1', [fixtureIds.variantId]);
    if (fixtureIds.productId) await db.query('DELETE FROM product_images WHERE product_id = $1', [fixtureIds.productId]);
    if (fixtureIds.productId) await db.query('DELETE FROM products WHERE product_id = $1', [fixtureIds.productId]);
    if (fixtureIds.shopId) await db.query('DELETE FROM shops WHERE shop_id = $1', [fixtureIds.shopId]);
    if (fixtureIds.categoryId) await db.query('DELETE FROM categories WHERE category_id = $1', [fixtureIds.categoryId]);
    if (createdUsers.length > 0) await db.query('DELETE FROM app_users WHERE user_id = ANY($1::uuid[])', [createdUsers]);
    await db.query('COMMIT');
    for (const userId of createdUsers) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) cleanupError ??= error;
    }
  } catch (error) {
    cleanupError = error;
  } finally {
    db.release();
    await pool.end();
  }
}

if (cleanupError) throw cleanupError;
process.stdout.write(`Storage ownership smoke passed for test project ${projectRef}.\n`);
