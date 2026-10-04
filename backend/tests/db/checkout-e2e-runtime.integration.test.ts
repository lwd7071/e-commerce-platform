import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { PgCheckoutService } from '../../src/modules/checkout/services/pg-checkout.service.ts';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import type { RequestContext } from '../../src/contracts/request-context.contract.ts';
import {
  createFixtureUser, createFixtureShop, createFixtureCategory, createFixtureProduct,
  createFixtureVariant, createFixtureAddress, createFixtureCart, createFixtureCartItem, applyShippingMigration,
} from './fixtures/database-fixtures.ts';

const dbDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

/**
 * Checkout E2E Integration Suite on Real PostgreSQL (B-408, A-206)
 * Verifies the 7 core invariants agreed in frontend-spec 01, 05, 08:
 *  1. Multi-shop order splitting: creates one order per shop.
 *  2. Selective cart cleanup: deletes only is_selected = true items.
 *  3. Accurate inventory deduction: decrements stock_quantity correctly.
 *  4. Concurrent stock race on last item: exactly 1 winner, loser receives 409 INVENTORY_INSUFFICIENT.
 *  5. Atomic multi-shop rollback: all-or-nothing transaction when any shop in cart fails.
 *  6. Idempotent replay with deterministic fingerprint: replays original response on same key.
 *  7. Idempotent mismatch conflict: rejects modified payload on same key with 409 IDEMPOTENCY_KEY_REUSED.
 */
dbDescribe('Checkout E2E Runtime & Invariants Gate (B-408 / A-206 on real PostgreSQL)', { timeout: 60_000, sequential: true }, () => {
  const schema = `p4_checkout_e2e_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let service: PgCheckoutService;
  let buyerContext: RequestContext;
  let buyerId: string;
  let addressId: string;

  // Shop 1 fixture references
  let seller1Id: string;
  let shop1Id: string;
  let product1Id: string;
  let variant1Id: string;

  // Shop 2 fixture references
  let seller2Id: string;
  let shop2Id: string;
  let product2Id: string;
  let variant2Id: string;

  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({
      connectionString: config.directUrl.toString(),
      max: 10,
      connectionTimeoutMillis: 10_000,
      options: `-c search_path=${schema} -c statement_timeout=20000`,
      application_name: schema,
    });

    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query('CREATE TABLE fixture_auth_users (id uuid PRIMARY KEY)');

    const initial = await readFile(new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url), 'utf8');
    await pool.query(initial.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '').replaceAll('auth.users', 'fixture_auth_users'));

    for (const migration of [
      '20260918170000_add_api_idempotency_records',
      '20260922120000_t2_performance_indexes',
      '20260924120000_t3_idempotency_rls_hardening',
    ]) {
      await pool.query(await readFile(new URL(`../../prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8'));
    }
    await applyShippingMigration(pool);

    service = new PgCheckoutService(pool);

    app = createApp({
      pool,
      auth: (req, _res, next) => {
        req.context = createRequestContext({
          request_id: (req.headers['x-request-id'] as string) || req.requestId || 'req_checkout_e2e',
          user_id: buyerId,
          role: 'BUYER',
        });
        next();
      },
      orderServices: {
        checkoutService: service,
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (pool) {
      try {
        await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      } finally {
        await pool.end();
      }
    }
  }, 30_000);

  async function createUser(role: 'BUYER' | 'SELLER'): Promise<string> {
    const id = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1)', [id]);
    await createFixtureUser(pool, { userId: id, role });
    return id;
  }

  beforeEach(async () => {
    await pool.query('TRUNCATE fixture_auth_users, categories CASCADE');

    buyerId = await createUser('BUYER');
    buyerContext = { user_id: buyerId, role: 'BUYER', request_id: randomUUID() };
    addressId = (await createFixtureAddress(pool, buyerId, { isDefault: true })).addressId;

    seller1Id = await createUser('SELLER');
    shop1Id = (await createFixtureShop(pool, seller1Id, { shopName: 'Dino Fashion Shop' })).shopId;

    seller2Id = await createUser('SELLER');
    shop2Id = (await createFixtureShop(pool, seller2Id, { shopName: 'Dino Book Store' })).shopId;

    const category = await createFixtureCategory(pool);

    const prod1 = await createFixtureProduct(pool, shop1Id, category.categoryId, { productName: 'Ao Phong Dino' });
    product1Id = prod1.productId;
    const v1 = await createFixtureVariant(pool, product1Id, { stockQuantity: 10, price: '150000.00' });
    variant1Id = v1.variantId;

    const prod2 = await createFixtureProduct(pool, shop2Id, category.categoryId, { productName: 'Sach Hoc React 19' });
    product2Id = prod2.productId;
    const v2 = await createFixtureVariant(pool, product2Id, { stockQuantity: 5, price: '200000.00' });
    variant2Id = v2.variantId;
  }, 30_000);

  async function getStock(vId: string): Promise<number> {
    const res = await pool.query('SELECT stock_quantity FROM product_variants WHERE variant_id = $1', [vId]);
    return res.rows[0].stock_quantity;
  }

  async function shippingFees(context: RequestContext, targetAddressId: string) {
    const quote = await service.quoteShipping(context, { address_id: targetAddressId }) as {
      quotes: Array<{ shop_id: string; fee: string }>;
    };
    return quote.quotes.map(({ shop_id, fee }) => ({ shop_id, fee }));
  }

  // =========================================================================
  // Invariant 1: Multi-shop splitting & Invariant 2: Selective cart cleanup
  // =========================================================================
  it('Invariant 1 & 2: splits orders by shop and cleans up only is_selected = true items', async () => {
    const cart = await createFixtureCart(pool, buyerId);
    // 2 selected items from Shop 1 and Shop 2
    await createFixtureCartItem(pool, cart.cartId, variant1Id, { quantity: 2, isSelected: true });
    await createFixtureCartItem(pool, cart.cartId, variant2Id, { quantity: 1, isSelected: true });

    // 1 unselected item that MUST remain after checkout
    const prodUnselected = await createFixtureProduct(pool, shop1Id, (await createFixtureCategory(pool)).categoryId);
    const varUnselected = await createFixtureVariant(pool, prodUnselected.productId, { stockQuantity: 20 });
    const unselectedItem = await createFixtureCartItem(pool, cart.cartId, varUnselected.variantId, { quantity: 3, isSelected: false });

    const idempotencyKey = randomUUID();
    const res = await request(app)
      .post('/api/v1/checkout')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        address_id: addressId,
        payment_method: 'COD',
        expected_shipping_fees: await shippingFees(buyerContext, addressId),
      })
      .expect(201);

    expect(res.body.data.orders).toHaveLength(2);

    const orderShops = res.body.data.orders.map((o: { shop_id: string }) => o.shop_id).sort();
    expect(orderShops).toEqual([shop1Id, shop2Id].sort());

    const sellerNotifications = await pool.query(`SELECT recipient_id,title,content FROM notifications WHERE recipient_id=ANY($1::uuid[]) AND title='Có đơn hàng mới'`, [[seller1Id, seller2Id]]);
    expect(sellerNotifications.rows).toHaveLength(2);
    expect(sellerNotifications.rows.map((row) => row.recipient_id).sort()).toEqual([seller1Id, seller2Id].sort());

    // Invariant 2: Cart items check - selected are removed, unselected remains
    const remainingCartItems = await pool.query('SELECT cart_item_id, is_selected FROM cart_items WHERE cart_id = $1', [cart.cartId]);
    expect(remainingCartItems.rows).toHaveLength(1);
    expect(remainingCartItems.rows[0].cart_item_id).toBe(unselectedItem.cartItemId);
    expect(remainingCartItems.rows[0].is_selected).toBe(false);

    // Invariant 3: Stock deduction
    expect(await getStock(variant1Id)).toBe(8); // 10 - 2
    expect(await getStock(variant2Id)).toBe(4); // 5 - 1
  });

  // =========================================================================
  // Invariant 4: Concurrent Stock Race on last item
  // =========================================================================
  it('Invariant 4: concurrent checkout for the last item allows exactly one 201 and rejects the other with 409 INVENTORY_INSUFFICIENT', async () => {
    // Set variant1 stock to exactly 1
    await pool.query('UPDATE product_variants SET stock_quantity = 1 WHERE variant_id = $1', [variant1Id]);

    // Buyer A
    const cartA = await createFixtureCart(pool, buyerId);
    await createFixtureCartItem(pool, cartA.cartId, variant1Id, { quantity: 1, isSelected: true });

    // Buyer B
    const buyerBId = await createUser('BUYER');
    const addressBId = (await createFixtureAddress(pool, buyerBId, { isDefault: true })).addressId;
    const cartB = await createFixtureCart(pool, buyerBId);
    await createFixtureCartItem(pool, cartB.cartId, variant1Id, { quantity: 1, isSelected: true });

    const keyA = randomUUID();
    const keyB = randomUUID();

    const buyerBContext: RequestContext = { user_id: buyerBId, role: 'BUYER', request_id: randomUUID() };

    // Fire 2 concurrent checkouts at the same time
    const [resultA, resultB] = await Promise.allSettled([
      service.createOrder(buyerContext, {
        address_id: addressId,
        payment_method: 'COD',
        vouchers: [],
        expected_shipping_fees: await shippingFees(buyerContext, addressId),
        idempotency_key: keyA,
      }),
      service.createOrder(buyerBContext, {
        address_id: addressBId,
        payment_method: 'COD',
        vouchers: [],
        expected_shipping_fees: await shippingFees(buyerBContext, addressBId),
        idempotency_key: keyB,
      }),
    ]);

    const fulfilled = [resultA, resultB].filter(r => r.status === 'fulfilled');
    const rejected = [resultA, resultB].filter(r => r.status === 'rejected');

    // Exactly one winner, one 409 loser
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'INVENTORY_INSUFFICIENT',
    });

    // Stock must be exactly 0, not negative
    expect(await getStock(variant1Id)).toBe(0);
  });

  // =========================================================================
  // Invariant 5: Atomic Multi-Shop Rollback (All-or-Nothing)
  // =========================================================================
  it('Invariant 5: multi-shop checkout rolls back atomically (all-or-nothing) if any shop has insufficient stock', async () => {
    const cart = await createFixtureCart(pool, buyerId);
    // Shop 1 has 10 items, buyer requests 2 (valid)
    await createFixtureCartItem(pool, cart.cartId, variant1Id, { quantity: 2, isSelected: true });
    // Shop 2 has only 5 items, buyer requests 99 (invalid/insufficient)
    await createFixtureCartItem(pool, cart.cartId, variant2Id, { quantity: 99, isSelected: true });

    const key = randomUUID();

    await expect(service.createOrder(buyerContext, {
      address_id: addressId,
      payment_method: 'COD',
      vouchers: [],
      expected_shipping_fees: await shippingFees(buyerContext, addressId),
      idempotency_key: key,
    })).rejects.toMatchObject({
      code: 'INVENTORY_INSUFFICIENT',
    });

    // All-or-Nothing assertion: 0 orders created in DB
    const ordersCount = await pool.query('SELECT count(*)::int AS count FROM orders WHERE buyer_id = $1', [buyerId]);
    expect(ordersCount.rows[0].count).toBe(0);

    // Stock of Shop 1 must NOT be deducted
    expect(await getStock(variant1Id)).toBe(10);
    expect(await getStock(variant2Id)).toBe(5);

    // Cart items must remain untouched
    const cartItemsCount = await pool.query('SELECT count(*)::int AS count FROM cart_items WHERE cart_id = $1', [cart.cartId]);
    expect(cartItemsCount.rows[0].count).toBe(2);
  });

  it('rejects a changed shipping quote without creating an order or mutating cart and stock', async () => {
    const cart = await createFixtureCart(pool, buyerId);
    await createFixtureCartItem(pool, cart.cartId, variant1Id, { quantity: 1, isSelected: true });
    const expected = await shippingFees(buyerContext, addressId);
    const changed = expected.map(quote => ({ ...quote, fee: (Number(quote.fee) + 1).toFixed(2) }));

    await expect(service.createOrder(buyerContext, {
      address_id: addressId,
      payment_method: 'COD',
      vouchers: [],
      expected_shipping_fees: changed,
      idempotency_key: randomUUID(),
    })).rejects.toMatchObject({ code: 'SHIPPING_QUOTE_CHANGED' });

    const ordersCount = await pool.query('SELECT count(*)::int AS count FROM orders WHERE buyer_id=$1', [buyerId]);
    const cartItemsCount = await pool.query('SELECT count(*)::int AS count FROM cart_items WHERE cart_id=$1', [cart.cartId]);
    expect(ordersCount.rows[0].count).toBe(0);
    expect(cartItemsCount.rows[0].count).toBe(1);
    expect(await getStock(variant1Id)).toBe(10);
  });

  // =========================================================================
  // Invariant 6 & 7: Idempotency Replay and Mismatch Conflict
  // =========================================================================
  it('Invariant 6 & 7: replays on duplicate key with identical payload, and rejects modified payload with 409 IDEMPOTENCY_KEY_REUSED', async () => {
    const cart = await createFixtureCart(pool, buyerId);
    await createFixtureCartItem(pool, cart.cartId, variant1Id, { quantity: 1, isSelected: true });

    const idempotencyKey = randomUUID();
    const payload = {
      address_id: addressId,
      payment_method: 'COD' as const,
      vouchers: [],
      expected_shipping_fees: await shippingFees(buyerContext, addressId),
      idempotency_key: idempotencyKey,
    };

    // First call: succeeds and creates order
    const firstResult = await service.createOrder(buyerContext, payload);
    expect(firstResult.orders).toHaveLength(1);
    expect(await getStock(variant1Id)).toBe(9);

    // Invariant 6: Replay same payload with same idempotency key
    const replayResult = await service.createOrder(buyerContext, payload);
    expect(replayResult).toEqual(firstResult);

    // Assert no additional order was created, stock was NOT deducted again
    const ordersRes = await pool.query('SELECT count(*)::int AS count FROM orders WHERE buyer_id = $1', [buyerId]);
    expect(ordersRes.rows[0].count).toBe(1);
    expect(await getStock(variant1Id)).toBe(9);

    // Invariant 7: Idempotency mismatch conflict (modified payment method)
    const modifiedPayload = {
      ...payload,
      payment_method: 'ONLINE' as const,
    };

    await expect(service.createOrder(buyerContext, modifiedPayload)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
  });
});
