import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrderItemSnapshot,
  buildOrderAddressSnapshot,
  createOrderStatusHistoryRecord,
} from '../../../src/modules/order/domain/order-snapshot.ts';
import { OrderDomainError } from '../../../src/modules/order/domain/errors.ts';
import { InMemoryIdempotencyAdapter } from '../../../src/modules/checkout/domain/in-memory-idempotency.ts';
import type { IOrderQueryPort, ReviewOrderItemDTO } from '../../../src/modules/order/contracts/order-query.contract.ts';
import type { OrderCreatedEvent } from '../../../src/modules/order/contracts/order-events.contract.ts';

describe('Order T2 Domain Services — Snapshot, History, Query & Events', () => {
  describe('OrderItem Snapshot (QD08, RB-MG06, RB-MG07)', () => {
    it('creates a frozen, valid snapshot for order item', () => {
      const snapshot = buildOrderItemSnapshot({
        orderId: 'order-1',
        productId: 'prod-100',
        variantId: 'var-200',
        productName: 'Áo Thun Nam Cao Cấp',
        variantName: 'Size XL',
        variantValue: 'Màu Đen',
        unitPrice: '150000.00',
        quantity: 2,
      });

      assert.equal(snapshot.orderId, 'order-1');
      assert.equal(snapshot.productId, 'prod-100');
      assert.equal(snapshot.variantId, 'var-200');
      assert.equal(snapshot.productNameSnapshot, 'Áo Thun Nam Cao Cấp');
      assert.equal(snapshot.variantSnapshot, 'Size XL - Màu Đen');
      assert.equal(snapshot.unitPrice, '150000.00');
      assert.equal(snapshot.quantity, 2);
      assert.equal(snapshot.lineTotal, '300000.00');
      assert.ok(Object.isFrozen(snapshot));
    });

    it('creates snapshot without variantValue when it is not provided', () => {
      const snapshot = buildOrderItemSnapshot({
        orderId: 'order-1',
        productId: 'prod-100',
        variantId: 'var-200',
        productName: 'Sách Lập Trình',
        variantName: 'Bìa cứng',
        unitPrice: '99000.00',
        quantity: 1,
      });

      assert.equal(snapshot.variantSnapshot, 'Bìa cứng');
      assert.equal(snapshot.lineTotal, '99000.00');
    });

    it('rejects empty product name or variant name', () => {
      assert.throws(
        () =>
          buildOrderItemSnapshot({
            orderId: 'order-1',
            productId: 'prod-1',
            variantId: 'var-1',
            productName: '   ',
            variantName: 'Size M',
            unitPrice: '10000.00',
            quantity: 1,
          }),
        (err: any) => err instanceof OrderDomainError && err.code === 'VALIDATION_FAILED',
      );

      assert.throws(
        () =>
          buildOrderItemSnapshot({
            orderId: 'order-1',
            productId: 'prod-1',
            variantId: 'var-1',
            productName: 'Áo thun',
            variantName: '',
            unitPrice: '10000.00',
            quantity: 1,
          }),
        (err: any) => err instanceof OrderDomainError && err.code === 'VALIDATION_FAILED',
      );
    });

    it('rejects invalid or non-integer quantities (RB-MG06)', () => {
      assert.throws(
        () =>
          buildOrderItemSnapshot({
            orderId: 'order-1',
            productId: 'prod-1',
            variantId: 'var-1',
            productName: 'Áo',
            variantName: 'M',
            unitPrice: '10000.00',
            quantity: 0,
          }),
        (err: any) => err instanceof OrderDomainError && err.code === 'VALIDATION_FAILED',
      );

      assert.throws(
        () =>
          buildOrderItemSnapshot({
            orderId: 'order-1',
            productId: 'prod-1',
            variantId: 'var-1',
            productName: 'Áo',
            variantName: 'M',
            unitPrice: '10000.00',
            quantity: 1.5,
          }),
        (err: any) => err instanceof OrderDomainError && err.code === 'VALIDATION_FAILED',
      );
    });

    it('rejects malformed or invalid decimal unit price', () => {
      assert.throws(
        () =>
          buildOrderItemSnapshot({
            orderId: 'order-1',
            productId: 'prod-1',
            variantId: 'var-1',
            productName: 'Áo',
            variantName: 'M',
            unitPrice: '0.00',
            quantity: 1,
          }),
        (err: any) => err instanceof OrderDomainError && err.code === 'ORDER_TOTAL_INVALID',
      );

      assert.throws(
        () =>
          buildOrderItemSnapshot({
            orderId: 'order-1',
            productId: 'prod-1',
            variantId: 'var-1',
            productName: 'Áo',
            variantName: 'M',
            unitPrice: 'invalid-price',
            quantity: 1,
          }),
        (err: any) => err instanceof OrderDomainError && err.code === 'ORDER_TOTAL_INVALID',
      );
    });
  });

  describe('Address Snapshot', () => {
    it('creates a frozen, valid address snapshot', () => {
      const address = buildOrderAddressSnapshot({
        recipientName: 'Nguyễn Văn A',
        recipientPhone: '0901234567',
        province: 'Hồ Chí Minh',
        district: 'Thủ Đức',
        ward: 'Linh Chiểu',
        deliveryAddress: '1 Võ Văn Ngân',
      });

      assert.equal(address.recipientName, 'Nguyễn Văn A');
      assert.equal(address.recipientPhone, '0901234567');
      assert.ok(Object.isFrozen(address));
    });

    it('rejects blank address fields', () => {
      assert.throws(
        () =>
          buildOrderAddressSnapshot({
            recipientName: '',
            recipientPhone: '0901234567',
            province: 'Hồ Chí Minh',
            district: 'Thủ Đức',
            ward: 'Linh Chiểu',
            deliveryAddress: '1 Võ Văn Ngân',
          }),
        (err: any) => err instanceof OrderDomainError && err.code === 'VALIDATION_FAILED',
      );
    });
  });

  describe('Order Status History (QD11, QD20)', () => {
    it('creates initial history record without old status', () => {
      const record = createOrderStatusHistoryRecord({
        orderId: 'order-1',
        oldStatus: null,
        newStatus: 'PENDING_CONFIRMATION',
        changedBy: 'user-buyer-1',
      });

      assert.equal(record.orderId, 'order-1');
      assert.equal(record.oldStatus, null);
      assert.equal(record.newStatus, 'PENDING_CONFIRMATION');
      assert.equal(record.changedBy, 'user-buyer-1');
      assert.ok(record.historyId);
      assert.ok(record.changedAt);
      assert.ok(Object.isFrozen(record));
    });

    it('requires a reason when transitioning to CANCELLED or DELIVERY_FAILED', () => {
      assert.throws(
        () =>
          createOrderStatusHistoryRecord({
            orderId: 'order-1',
            oldStatus: 'CONFIRMED',
            newStatus: 'CANCELLED',
            reason: '',
          }),
        (err: any) => err instanceof OrderDomainError && err.code === 'REASON_REQUIRED',
      );

      assert.doesNotThrow(() =>
        createOrderStatusHistoryRecord({
          orderId: 'order-1',
          oldStatus: 'CONFIRMED',
          newStatus: 'CANCELLED',
          reason: 'Khách hàng đổi ý',
        }),
      );
    });
  });

  describe('Idempotency In-Memory Adapter', () => {
    it('handles claim, complete, and replay flow accurately', async () => {
      const adapter = new InMemoryIdempotencyAdapter<{ orderId: string }>();
      const scope = {
        user_id: 'user-1',
        endpoint: '/api/v1/orders',
        key: 'key-12345',
      };
      const fingerprint = JSON.stringify({ shopId: 'shop-1', total: '100.00' });

      // 1. Initial claim
      const claim1 = await adapter.claim(scope, fingerprint);
      assert.equal(claim1.kind, 'acquired');
      if (claim1.kind !== 'acquired') return;

      // 2. While in-progress, second claim returns in_progress
      const claim2 = await adapter.claim(scope, fingerprint);
      assert.equal(claim2.kind, 'in_progress');

      // 3. Complete claim
      await adapter.complete(scope, claim1.ownership_token, { orderId: 'ord-999' }, '2026-09-24T00:00:00.000Z');

      // 4. Replay with identical fingerprint returns replay
      const claim3 = await adapter.claim(scope, fingerprint);
      assert.equal(claim3.kind, 'replay');
      if (claim3.kind === 'replay') {
        assert.equal(claim3.result.orderId, 'ord-999');
      }

      // 5. Replay with different fingerprint returns conflict
      const claim4 = await adapter.claim(scope, 'different-fingerprint');
      assert.equal(claim4.kind, 'conflict');
    });

    it('releases in-progress claim on rollback', async () => {
      const adapter = new InMemoryIdempotencyAdapter<any>();
      const scope = {
        user_id: 'user-1',
        endpoint: '/api/v1/orders',
        key: 'key-rollback',
      };

      const claim = await adapter.claim(scope, 'fp');
      assert.equal(claim.kind, 'acquired');
      if (claim.kind !== 'acquired') return;

      await adapter.release(scope, claim.ownership_token);

      const reclaim = await adapter.claim(scope, 'fp');
      assert.equal(reclaim.kind, 'acquired');
    });
  });

  describe('Contracts for Other Members (P4 Review & Notification)', () => {
    it('OrderQueryPort interface correctly matches review requirements', async () => {
      const mockQueryPort: IOrderQueryPort = {
        async getOrderItemForReview(orderItemId: string, buyerId: string): Promise<ReviewOrderItemDTO | null> {
          if (orderItemId === 'oi-1' && buyerId === 'buyer-1') {
            return {
              orderItemId: 'oi-1',
              orderId: 'ord-1',
              productId: 'prod-1',
              buyerId: 'buyer-1',
              orderStatus: 'COMPLETED',
              hasExistingReview: false,
            };
          }
          return null;
        },
        async getOrderSummary() {
          return null;
        },
      };

      const item = await mockQueryPort.getOrderItemForReview('oi-1', 'buyer-1');
      assert.ok(item);
      assert.equal(item.orderStatus, 'COMPLETED');
    });

    it('OrderCreatedEvent adheres to event structure', () => {
      const event: OrderCreatedEvent = {
        type: 'ORDER_CREATED',
        eventId: crypto.randomUUID(),
        orderId: 'ord-1',
        buyerId: 'buyer-1',
        shopId: 'shop-1',
        totalAmount: '200000.00',
        occurredAt: new Date().toISOString(),
      };

      assert.equal(event.type, 'ORDER_CREATED');
      assert.equal(event.totalAmount, '200000.00');
    });
  });
});
