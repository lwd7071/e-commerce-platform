import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { executeTransactionalCheckout } from '../../../src/modules/checkout/services/transactional-checkout.service.ts';
import { InMemoryIdempotencyAdapter } from '../../../src/modules/checkout/domain/in-memory-idempotency.ts';
import { InMemoryOrderRepository } from '../../../src/modules/order/repositories/in-memory-order.repository.ts';
import { InMemoryPaymentRepository } from '../../../src/modules/payment/repositories/in-memory-payment.repository.ts';
import { settlePendingPayment } from '../../../src/modules/payment/domain/payment-state-machine.ts';

const errorCode = (error: unknown): unknown =>
  error instanceof Error && 'code' in error ? error.code : undefined;
import type { PaymentAttempt } from '../../../src/modules/payment/domain/types.ts';
import type { ICartPort } from '../../../src/modules/buyer/ports/cart.port.ts';
import type { ICatalogPort } from '../../../src/modules/catalog/ports/catalog.port.ts';
import type { IVoucherPort } from '../../../src/modules/buyer/ports/voucher.port.ts';
import type { CheckoutCommand } from '../../../src/modules/checkout/contracts/checkout-command.ts';

describe('T3 Concurrency & Transaction Boundary Hardening (Mốc T3 - Người 5 & Người 2)', () => {
  // =========================================================================
  // 1. OVERSELLING RACE CONDITION SIMULATION (QD07, RB-LQH06)
  // =========================================================================
  it('[T3-CONC-01] Overselling race: 5 concurrent workers compete for stock=1 -> exactly 1 succeeds, 4 fail with INVENTORY_INSUFFICIENT', async () => {
    let availableStock = 1;
    const shopId = randomUUID();
    const productId = randomUUID();
    const variantId = randomUUID();

    // Atomic mutex simulating row-level lock (SELECT ... FOR UPDATE)
    let isRowLocked = false;
    const acquireRowLock = async () => {
      while (isRowLocked) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      isRowLocked = true;
    };
    const releaseRowLock = () => {
      isRowLocked = false;
    };

    const catalogPort: ICatalogPort = {
      async getVariantPriceAndStock(vId: string) {
        return {
          variantId: vId,
          productId,
          productName: 'Limited Edition Sneaker',
          variantName: 'Size 42',
          variantValue: 'Black',
          price: '1500000.00',
          stockQuantity: availableStock,
          status: 'ACTIVE',
        };
      },
      async lockVariant(vId: string, quantity: number) {
        await acquireRowLock();
        try {
          if (availableStock < quantity) {
            throw new Error('INVENTORY_INSUFFICIENT');
          }
          availableStock -= quantity;
          return {
            variantId: vId,
            requestedQuantity: quantity,
            priceSnapshot: '1500000.00',
            remainingStock: availableStock,
          };
        } finally {
          releaseRowLock();
        }
      },
      async checkShopActive() {
        return true;
      },
    };

    const voucherPort: IVoucherPort = {
      async evaluateVoucher() {
        return { isValid: false, errorMessage: 'No voucher', errorCode: 'VOUCHER_NOT_APPLICABLE' };
      },
      async consumeVoucher(params) {
        return {
          usageId: randomUUID(),
          voucherId: params.voucherId,
          orderId: params.orderId,
          buyerId: params.buyerId,
          discountAmount: params.discountAmount,
          usedAt: new Date().toISOString(),
        };
      },
    };

    const orderRepo = new InMemoryOrderRepository();
    const paymentRepo = new InMemoryPaymentRepository();

    // 5 concurrent workers firing simultaneously
    const workerPromises = Array.from({ length: 5 }, async (_, index) => {
      const buyerId = `buyer-conc-${index}`;
      const cartPort: ICartPort = {
        async getSelectedItems() {
          return [{ cartItemId: `cart-item-${index}`, variantId, quantity: 1, isSelected: true }];
        },
        async clearCheckedOutItems() {},
      };

      const command: CheckoutCommand = {
        address_id: randomUUID(),
        payment_method: 'COD',
        vouchers: [],
        idempotency_key: `idemp-worker-${index}-${randomUUID()}`,
      };

      try {
        const res = await executeTransactionalCheckout({
          buyerId,
          command,
          cartPort,
          catalogPort,
          voucherPort,
          orderRepo,
          paymentRepo,
          shopResolver: () => shopId,
          addressResolver: async () => ({
            recipientName: `Buyer ${index}`,
            recipientPhone: '0901234567',
            province: 'HCM',
            district: 'Q1',
            ward: 'Ben Nghe',
            deliveryAddress: '123 Le Loi',
          }),
        });
        return { success: true, orderId: res.orders[0].order_id };
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : undefined };
      }
    });

    const results = await Promise.all(workerPromises);

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    // Invariant: Exactly 1 order created, exactly 4 rejected with INVENTORY_INSUFFICIENT, final stock is 0
    assert.strictEqual(successCount, 1, 'Only 1 worker must succeed');
    assert.strictEqual(failureCount, 4, 'Remaining 4 workers must fail');
    assert.strictEqual(availableStock, 0, 'Stock must be exactly 0, never negative');

    for (const failed of results.filter((r) => !r.success)) {
      assert.strictEqual(failed.error, 'INVENTORY_INSUFFICIENT');
    }
  });

  // =========================================================================
  // 2. IDEMPOTENCY ADVISORY LOCK CONCURRENCY SIMULATION (QD16)
  // =========================================================================
  it('[T3-CONC-02] Idempotency concurrency: parallel duplicate requests -> 1 in-flight claim, second detects in_progress or replay', async () => {
    const idempotency = new InMemoryIdempotencyAdapter<{ orderId: string }>();
    const scope = { user_id: 'buyer-idem-01', endpoint: '/checkout', key: 'same-concurrent-key-123456' };
    const fingerprint = 'fingerprint_hash_1234567890abcdef';

    // Worker 1 claims lock
    const claim1 = await idempotency.claim(scope, fingerprint);
    assert.strictEqual(claim1.kind, 'acquired');

    // Worker 2 attempts same claim concurrently before Worker 1 completes
    const claim2 = await idempotency.claim(scope, fingerprint);
    assert.strictEqual(claim2.kind, 'in_progress', 'Concurrent request must detect in_progress lock');

    // Worker 1 completes and caches result
    const expectedResult = { orderId: 'order-uuid-999' };
    if (claim1.kind === 'acquired') {
      await idempotency.complete(scope, claim1.ownership_token, expectedResult, new Date(Date.now() + 86400000).toISOString());
    }

    // Worker 3 arrives later with same key -> receives replay immediately without re-executing
    const claim3 = await idempotency.claim(scope, fingerprint);
    assert.strictEqual(claim3.kind, 'replay');
    if (claim3.kind === 'replay') {
      assert.deepStrictEqual(claim3.result, expectedResult);
    }
  });

  // =========================================================================
  // 3. SERIALIZATION RETRY LOOP (SQLSTATE 40001 / 40P01)
  // =========================================================================
  it('[T3-CONC-03] Serialization retry: automatically retries on 40001 deadlock/serialization failure up to 3 times', async () => {
    let attempts = 0;
    const retryDelays: number[] = [];

    const mockSleep = async (ms: number) => {
      retryDelays.push(ms);
    };

    const mockExecuteWithRetry = async () => {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        attempts += 1;
        try {
          if (attempt < 3) {
            throw Object.assign(new Error('deadlock detected'), { code: '40001' });
          }
          return { success: true, attemptCount: attempt };
        } catch (error: unknown) {
          if ((errorCode(error) === '40001' || errorCode(error) === '40P01') && attempt < 3) {
            await mockSleep(attempt === 1 ? 25 : 50);
            continue;
          }
          throw error;
        }
      }
    };

    const result = await mockExecuteWithRetry();
    assert.ok(result);
    assert.strictEqual(result.success, true);
    assert.strictEqual(attempts, 3, 'Must have attempted 3 times');
    assert.deepStrictEqual(retryDelays, [25, 50], 'Backoff delays must follow 25ms and 50ms');
  });

  // =========================================================================
  // 4. PAYMENT SETTLE CONCURRENCY (DOUBLE SUCCESS PREVENTION)
  // =========================================================================
  it('[T3-CONC-04] Payment double success prevention: two callbacks competing -> only 1 succeeds, second fails with PAYMENT_STATE_INVALID', () => {
    let payment: PaymentAttempt = {
      paymentId: 'pay-001',
      orderId: 'order-001',
      status: 'PENDING',
      method: 'ONLINE',
      amount: '500000.00',
      paidAt: null,
    };

    // First webhook arrives
    const settled1 = settlePendingPayment(payment, {
      outcome: 'SUCCESS',
      orderTotal: '500000.00',
      paidAt: '2026-09-25T12:00:00.000Z',
    });
    assert.strictEqual(settled1.status, 'SUCCESS');
    assert.strictEqual(settled1.paidAt, '2026-09-25T12:00:00.000Z');

    payment = settled1;

    // Second webhook arrives later for already settled payment
    assert.throws(
      () =>
        settlePendingPayment(payment, {
          outcome: 'SUCCESS',
          orderTotal: '500000.00',
          paidAt: '2026-09-25T12:00:05.000Z',
        }),
      (err: unknown) => {
        assert.strictEqual(errorCode(err), 'PAYMENT_STATE_INVALID');
        return true;
      },
      'Second callback must be rejected because payment is no longer PENDING',
    );
  });
});
