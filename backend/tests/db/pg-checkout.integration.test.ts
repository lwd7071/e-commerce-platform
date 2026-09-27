import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { runConcurrentTransactions } from '../../db/concurrency-harness.ts';
import { PgCheckoutService } from '../../src/modules/checkout/services/pg-checkout.service.ts';
import type { RequestContext } from '../../src/contracts/request-context.contract.ts';
import {
  createFixtureUser, createFixtureShop, createFixtureCategory, createFixtureProduct,
  createFixtureVariant, createFixtureAddress, createFixtureCart, createFixtureCartItem,
  createFixtureOrder, createFixtureOrderItem, createFixturePayment, createFixtureVoucher,
} from './fixtures/database-fixtures.ts';

const dbDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

dbDescribe('PgCheckoutService transaction release gate (real PostgreSQL)', { timeout: 45_000, sequential: true }, () => {
  const schema = `p5_checkout_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let service: PgCheckoutService;
  let buyer: RequestContext;
  let seller: RequestContext;
  let variantId: string;
  let productId: string;
  let shopId: string;
  let addressId: string;
  const retryDelays: number[] = [];

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 8,
      connectionTimeoutMillis: 10_000, options: `-c search_path=${schema} -c statement_timeout=15000`,
      application_name: schema });
    await pool.query(`CREATE SCHEMA ${schema}`);
    // Use the real DDL and constraints, replacing only the external auth FK.
    // No public table or auth user is changed by this suite.
    await pool.query('CREATE TABLE fixture_auth_users (id uuid PRIMARY KEY)');
    const initial = await readFile(new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url), 'utf8');
    await pool.query(initial.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '').replaceAll('auth.users', 'fixture_auth_users'));
    for (const migration of ['20260918170000_add_api_idempotency_records', '20260922120000_t2_performance_indexes', '20260924120000_t3_idempotency_rls_hardening']) {
      await pool.query(await readFile(new URL(`../../prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8'));
    }
    service = new PgCheckoutService(pool, async ms => { retryDelays.push(ms); });
  }, 60_000);

  afterAll(async () => {
    if (pool) {
      try { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
      finally { await pool.end(); }
    }
  }, 30_000);

  async function user(role: 'BUYER' | 'SELLER'): Promise<RequestContext> {
    const id = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1)', [id]);
    await createFixtureUser(pool, { userId: id, role });
    return { user_id: id, role, request_id: randomUUID() };
  }

  beforeEach(async () => {
    await pool.query('TRUNCATE fixture_auth_users, categories CASCADE');
    retryDelays.length = 0;
    buyer = await user('BUYER');
    seller = await user('SELLER');
    shopId = (await createFixtureShop(pool, seller.user_id)).shopId;
    seller = { ...seller, shop_id: shopId };
    const category = await createFixtureCategory(pool);
    productId = (await createFixtureProduct(pool, shopId, category.categoryId)).productId;
    variantId = (await createFixtureVariant(pool, productId, { stockQuantity: 5 })).variantId;
    addressId = (await createFixtureAddress(pool, buyer.user_id)).addressId;
  }, 30_000);

  async function order(status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'DELIVERY_FAILED' = 'PENDING_CONFIRMATION') {
    const result = await createFixtureOrder(pool, buyer.user_id, shopId, { status });
    await createFixtureOrderItem(pool, result.orderId, productId, variantId, { quantity: 2, lineTotal: '200000.00' });
    return result.orderId;
  }

  async function stock() {
    return (await pool.query('SELECT stock_quantity FROM product_variants WHERE variant_id=$1', [variantId])).rows[0].stock_quantity;
  }

  async function state(id: string) {
    return (await pool.query('SELECT status FROM orders WHERE order_id=$1', [id])).rows[0].status;
  }

  async function count(table: string) {
    return (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
  }

  // Trigger faults happen inside PostgreSQL, after the target statement wrote data.
  async function failWrite(table: string, operation = 'INSERT') {
    await pool.query(`CREATE OR REPLACE FUNCTION fail_write() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'intentional write failure'; END $$`);
    await pool.query(`CREATE TRIGGER test_fail AFTER ${operation} ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION fail_write()`);
    return async () => { await pool.query(`DROP TRIGGER test_fail ON ${table}`); };
  }

  it('cancels concurrently and restocks exactly once, including subsequent retries', async () => {
    const id = await order();
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => service.cancelOrder(buyer, id, { reason: ' Changed mind ' })));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await stock()).toBe(7);
    expect(await state(id)).toBe('CANCELLED');
    expect(await count('order_status_history')).toBe(1);
    await expect(service.cancelOrder(buyer, id, { reason: 'again' })).rejects.toThrow();
    expect(await stock()).toBe(7);
  });

  it.each(['cancel', 'confirm', 'transition'] as const)('%s rolls back status, stock and history when history insertion fails', async action => {
    const id = await order(action === 'transition' ? 'CONFIRMED' : 'PENDING_CONFIRMATION');
    const remove = await failWrite('order_status_history');
    try {
      const operation = action === 'cancel' ? service.cancelOrder(buyer, id, { reason: 'cancel' })
        : action === 'confirm' ? service.confirmOrder(seller, id)
        : service.transitionOrder(seller, id, { to: 'CANCELLED', reason: 'cancel' });
      await expect(operation).rejects.toThrow('intentional write failure');
      expect(await state(id)).toBe(action === 'transition' ? 'CONFIRMED' : 'PENDING_CONFIRMATION');
      expect(await stock()).toBe(5);
      expect(await count('order_status_history')).toBe(0);
    } finally { await remove(); }
  });

  it('confirmation writes history and concurrent confirmation cannot duplicate it', async () => {
    const id = await order();
    const results = await Promise.allSettled([service.confirmOrder(seller, id), service.confirmOrder(seller, id)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await pool.query('SELECT old_status,new_status,changed_by FROM order_status_history')).toMatchObject({ rows: [
      { old_status: 'PENDING_CONFIRMATION', new_status: 'CONFIRMED', changed_by: seller.user_id },
    ] });
  });

  it('seller cancellation through transition also restores stock only once', async () => {
    const id = await order('CONFIRMED');
    const results = await Promise.allSettled([1, 2].map(() => service.transitionOrder(seller, id, { to: 'CANCELLED', reason: 'Unavailable' })));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await stock()).toBe(7);
    expect(await count('order_status_history')).toBe(1);
  });

  it.each(['CANCELLED', 'COMPLETED', 'DELIVERY_FAILED'] as const)('rejects payment retry on terminal order %s', async status => {
    const id = await order(status);
    await createFixturePayment(pool, id, { status: 'FAILED' });
    await expect(service.retryPayment(buyer, id, {})).rejects.toMatchObject({ code: 'PAYMENT_STATE_INVALID' });
    expect(await count('payments')).toBe(1);
  });

  it.each(['SUCCESS', 'PENDING'] as const)('rejects retry when a %s payment exists', async status => {
    const id = await order();
    await createFixturePayment(pool, id, { status });
    await expect(service.retryPayment(buyer, id, {})).rejects.toMatchObject({ code: status === 'SUCCESS' ? 'PAYMENT_ALREADY_COMPLETED' : 'PAYMENT_STATE_INVALID' });
    expect(await count('payments')).toBe(1);
  });

  it('concurrent retries create one new pending attempt and preserve failed attempts', async () => {
    const id = await order();
    await createFixturePayment(pool, id, { status: 'FAILED' });
    const results = await Promise.allSettled([1, 2, 3].map(() => service.retryPayment(buyer, id, { payment_method: 'ONLINE' })));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await pool.query('SELECT status,amount::text FROM payments ORDER BY status')).rows).toEqual([
      { status: 'FAILED', amount: '120000.00' }, { status: 'PENDING', amount: '120000.00' },
    ]);
  });

  it('payment retry waits for the Order lock and rechecks a concurrent cancellation', async () => {
    const id = await order();
    await createFixturePayment(pool, id, { status: 'FAILED' });
    const blocker = await pool.connect();
    let retry: Promise<unknown> | undefined;
    try {
      await blocker.query('BEGIN');
      const { rows: [{ pid }] } = await blocker.query('SELECT pg_backend_pid() AS pid');
      await blocker.query("UPDATE orders SET status='CANCELLED',cancel_reason='concurrent cancellation' WHERE order_id=$1", [id]);
      retry = service.retryPayment(buyer, id, {});
      void retry.catch(() => undefined);
      await waitForBlockedBy(pid);
      await blocker.query('COMMIT');
      await expect(retry).rejects.toMatchObject({ code: 'PAYMENT_STATE_INVALID' });
      expect(await count('payments')).toBe(1);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await retry?.catch(() => undefined);
    }
  });

  it('payment retry waits for Payment locks and rechecks a concurrent success', async () => {
    const id = await order();
    const payment = await createFixturePayment(pool, id, { status: 'PENDING' });
    const blocker = await pool.connect();
    let retry: Promise<unknown> | undefined;
    try {
      await blocker.query('BEGIN');
      const { rows: [{ pid }] } = await blocker.query('SELECT pg_backend_pid() AS pid');
      await blocker.query("UPDATE payments SET status='SUCCESS',paid_at=now() WHERE payment_id=$1", [payment.paymentId]);
      retry = service.retryPayment(buyer, id, {});
      void retry.catch(() => undefined);
      await waitForBlockedBy(pid);
      await blocker.query('COMMIT');
      await expect(retry).rejects.toMatchObject({ code: 'PAYMENT_ALREADY_COMPLETED' });
      expect(await count('payments')).toBe(1);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await retry?.catch(() => undefined);
    }
  });

  it('guards ownership and invalid payment methods without writing', async () => {
    const id = await order();
    await createFixturePayment(pool, id, { status: 'FAILED' });
    const other = await user('BUYER');
    await expect(service.cancelOrder(other, id, { reason: 'cancel' })).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    await expect(service.retryPayment(other, id, {})).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    await expect(service.confirmOrder(other, id)).rejects.toMatchObject({ code: 'ORDER_CONFIRM_FORBIDDEN' });
    await expect(service.transitionOrder(other, id, { to: 'CONFIRMED' })).rejects.toMatchObject({ code: 'RESOURCE_FORBIDDEN' });
    await expect(service.retryPayment(buyer, id, { payment_method: 'INVALID' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(await state(id)).toBe('PENDING_CONFIRMATION');
    expect(await count('payments')).toBe(1);
    expect(await count('order_status_history')).toBe(0);
  });

  async function cart(context = buyer, targetVariant = variantId) {
    const c = await createFixtureCart(pool, context.user_id);
    await createFixtureCartItem(pool, c.cartId, targetVariant);
  }

  function command(address = addressId) {
    return { address_id: address, payment_method: 'ONLINE' as const, vouchers: [], idempotency_key: randomUUID() };
  }

  it('five buyers on independent connections cannot oversell stock=1', async () => {
    await pool.query('UPDATE product_variants SET stock_quantity=1 WHERE variant_id=$1', [variantId]);
    const buyers = await Promise.all(Array.from({ length: 5 }, async () => {
      const context = await user('BUYER');
      const address = await createFixtureAddress(pool, context.user_id);
      await cart(context);
      return { context, input: command(address.addressId) };
    }));
    const results = await Promise.allSettled(buyers.map(b => service.createOrder(b.context, b.input)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of results) if (r.status === 'rejected') expect(r.reason).toMatchObject({ code: 'INVENTORY_INSUFFICIENT' });
    expect(await stock()).toBe(0);
    expect(await count('orders')).toBe(1);
    expect(await count('cart_items')).toBe(4);
  });

  it('duplicate idempotency keys yield one checkout, replay and payload conflict', async () => {
    await cart();
    const input = command();
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => service.createOrder(buyer, input)));
    const successes = results.filter(r => r.status === 'fulfilled');
    expect(successes.length).toBeGreaterThan(0);
    for (const r of results) if (r.status === 'rejected') expect(r.reason).toMatchObject({ code: 'REQUEST_IN_PROGRESS' });
    const replay = await service.createOrder(buyer, input);
    for (const r of successes) expect(r.value).toEqual(replay);
    await expect(service.createOrder(buyer, { ...input, payment_method: 'COD' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    expect(await count('orders')).toBe(1);
    expect(await count('api_idempotency_records')).toBe(1);
    expect(await stock()).toBe(4);
  });

  it.each([
    ['orders', 'INSERT'], ['product_variants', 'UPDATE'], ['order_items', 'INSERT'],
    ['cart_items', 'DELETE'], ['order_status_history', 'INSERT'], ['payments', 'INSERT'],
    ['notifications', 'INSERT'], ['api_idempotency_records', 'INSERT'],
  ])('checkout rolls back all writes when %s fails', async (table, operation) => {
    await cart();
    const input = command();
    const remove = await failWrite(table, operation);
    try {
      await expect(service.createOrder(buyer, input)).rejects.toThrow('intentional write failure');
      expect(await stock()).toBe(5);
      expect(await count('cart_items')).toBe(1);
      for (const target of ['orders', 'order_items', 'order_status_history', 'payments', 'notifications', 'api_idempotency_records']) {
        expect(await count(target), target).toBe(0);
      }
    } finally { await remove(); }
    // Failure must release the advisory lock and allow the SAME key to succeed.
    await service.createOrder(buyer, input);
    expect(await count('orders')).toBe(1);
    expect(await stock()).toBe(4);
  });

  it.each([1, 3])('database serialization fault after writes: %s failures exercise retry and exhaustion', async failures => {
    await cart();
    const input = command();
    await pool.query('CREATE SEQUENCE retry_probe');
    await pool.query(`CREATE FUNCTION serialization_fault() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF nextval('retry_probe') <= ${failures} THEN
          RAISE EXCEPTION 'serialization fault' USING ERRCODE='40001';
        END IF;
        RETURN NEW;
      END $$`);
    await pool.query('CREATE TRIGGER retry_fault AFTER INSERT ON payments FOR EACH ROW EXECUTE FUNCTION serialization_fault()');
    try {
      if (failures === 1) {
        const result = await service.createOrder(buyer, input);
        expect(retryDelays).toEqual([25]);
        expect(await service.createOrder(buyer, input)).toEqual(result);
        expect(await stock()).toBe(4);
        expect(await count('payments')).toBe(1);
        expect(await count('order_status_history')).toBe(1);
      } else {
        await expect(service.createOrder(buyer, input)).rejects.toMatchObject({ code: '40001' });
        expect(retryDelays).toEqual([25, 50]);
        expect(await stock()).toBe(5);
        expect(await count('orders')).toBe(0);
        expect(await count('cart_items')).toBe(1);
        expect(await count('api_idempotency_records')).toBe(0);
      }
    } finally {
      await pool.query('DROP TRIGGER retry_fault ON payments; DROP FUNCTION serialization_fault(); DROP SEQUENCE retry_probe');
    }
  });

  it.each(['vouchers', 'voucher_usages', 'api_idempotency_records'])('multi-shop checkout rolls back both shops and voucher when %s fails', async table => {
    const secondSeller = await user('SELLER');
    const secondShop = await createFixtureShop(pool, secondSeller.user_id);
    const category = await createFixtureCategory(pool);
    const secondProduct = await createFixtureProduct(pool, secondShop.shopId, category.categoryId);
    // Ensure voucher processing happens on the SECOND shop, after the first has written everything.
    await pool.query('UPDATE product_variants SET variant_id=$1 WHERE variant_id=$2', ['00000000-0000-4000-8000-000000000001', variantId]);
    variantId = '00000000-0000-4000-8000-000000000001';
    const secondVariant = await createFixtureVariant(pool, secondProduct.productId, { variantId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', stockQuantity: 3 });
    await cart();
    await cart(buyer, secondVariant.variantId);
    const voucher = await createFixtureVoucher(pool, { code: 'CHECKOUT_TEST', scope: 'SHOP', shopId: secondShop.shopId, quantity: 2 });
    const input = { ...command(), vouchers: [{ shop_id: secondShop.shopId, code: voucher.code }] };
    const remove = await failWrite(table, table === 'vouchers' ? 'UPDATE' : 'INSERT');
    try {
      await expect(service.createOrder(buyer, input)).rejects.toThrow();
      expect(await count('orders')).toBe(0);
      expect(await count('order_items')).toBe(0);
      expect(await count('order_status_history')).toBe(0);
      expect(await count('payments')).toBe(0);
      expect(await count('notifications')).toBe(0);
      expect(await count('voucher_usages')).toBe(0);
      expect(await count('api_idempotency_records')).toBe(0);
      expect(await count('cart_items')).toBe(2);
      expect((await pool.query('SELECT stock_quantity FROM product_variants ORDER BY variant_id')).rows).toEqual([{ stock_quantity: 5 }, { stock_quantity: 3 }]);
      expect((await pool.query('SELECT quantity FROM vouchers')).rows[0].quantity).toBe(2);
    } finally { await remove(); }
    expect((await service.createOrder(buyer, input)).orders).toHaveLength(2);
    expect(await count('orders')).toBe(2);
    expect(await count('voucher_usages')).toBe(1);
    expect((await pool.query('SELECT quantity FROM vouchers')).rows[0].quantity).toBe(1);
  });

  it('Person 2 multi-connection harness observes native PostgreSQL serialization failure', async () => {
    let arrived = 0;
    let release!: () => void;
    const bothRead = new Promise<void>(resolve => { release = resolve; });
    const timer = setTimeout(release, 10_000);
    try {
      const result = await runConcurrentTransactions(pool, { concurrency: 2, isolationLevel: 'SERIALIZABLE' }, async client => {
        const { rows: [{ pid }] } = await client.query('SELECT pg_backend_pid() AS pid');
        await client.query('SELECT stock_quantity FROM product_variants WHERE variant_id=$1', [variantId]);
        if (++arrived === 2) release();
        await bothRead;
        await client.query('UPDATE product_variants SET stock_quantity=stock_quantity-1 WHERE variant_id=$1', [variantId]);
        return pid;
      });
      expect(result.succeeded).toBe(1);
      expect(result.errorCodesCount).toEqual({ '40001': 1 });
      expect(await stock()).toBe(4);
    } finally { clearTimeout(timer); }
  });

  async function waitForBlockedBy(pid: number) {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      // Session poolers may overwrite application_name; the blocker PID is unique.
      const result = await pool.query('SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))', [pid]);
      if (result.rows[0]) return result.rows[0].pid as number;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('Expected PostgreSQL lock wait was not observed');
  }

  it('a real PostgreSQL deadlock aborts checkout, then its retry commits exactly once', async () => {
    await cart();
    const input = command();
    await pool.query('CREATE TABLE deadlock_probe (id int PRIMARY KEY, value int NOT NULL)');
    await pool.query('INSERT INTO deadlock_probe VALUES (1, 0)');
    await pool.query(`CREATE FUNCTION force_deadlock() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE deadlock_probe SET value=value+1 WHERE id=1;
        RETURN NEW;
      END $$`);
    await pool.query('CREATE TRIGGER deadlock_fault AFTER INSERT ON payments FOR EACH ROW EXECUTE FUNCTION force_deadlock()');
    const blocker = await pool.connect();
    let checkout: Promise<unknown> | undefined;
    try {
      await blocker.query('BEGIN');
      const { rows: [{ pid }] } = await blocker.query('SELECT pg_backend_pid() AS pid');
      await blocker.query('UPDATE deadlock_probe SET value=value+1 WHERE id=1');
      checkout = service.createOrder(buyer, input);
      // Attach a handler immediately, including on failed synchronization paths.
      void checkout.catch(() => undefined);
      const checkoutPid = await Promise.race([
        waitForBlockedBy(pid),
        checkout.then(() => { throw new Error('Checkout completed without the expected lock wait'); }),
      ]);
      expect(checkoutPid).not.toBe(pid);
      // Checkout holds the variant, blocker holds the probe: an actual cycle.
      await blocker.query('UPDATE product_variants SET stock_quantity=stock_quantity WHERE variant_id=$1', [variantId]);
      await blocker.query('COMMIT');
      const result = await checkout;
      expect(retryDelays).toEqual([25]);
      expect(await service.createOrder(buyer, input)).toEqual(result);
      expect(await count('orders')).toBe(1);
      expect(await count('payments')).toBe(1);
      expect(await count('order_status_history')).toBe(1);
      expect(await stock()).toBe(4);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await checkout?.catch(() => undefined);
      await pool.query('DROP TRIGGER deadlock_fault ON payments; DROP FUNCTION force_deadlock(); DROP TABLE deadlock_probe');
    }
  });
});
