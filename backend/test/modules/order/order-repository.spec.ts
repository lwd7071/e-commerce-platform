import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryOrderRepository } from '../../../src/modules/order/repositories/in-memory-order.repository.ts';
import { OrderQueryService } from '../../../src/modules/order/services/order-query.service.ts';
import {
  buildOrderItemSnapshot,
  buildOrderAddressSnapshot,
  createOrderStatusHistoryRecord,
} from '../../../src/modules/order/domain/order-snapshot.ts';
import type { OrderRecord } from '../../../src/modules/order/domain/repositories.ts';

describe('Order Repository & Order Query Service Tests (T2 Persistence & Review QD14)', () => {
  let orderRepo: InMemoryOrderRepository;
  let queryService: OrderQueryService;

  const mockBuyerId = 'buyer-uuid-1';
  const mockShopId = 'shop-uuid-10';
  const mockOrderId = 'order-uuid-999';

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepository();
    queryService = new OrderQueryService(orderRepo);
  });

  it('creates an order with frozen snapshots and retrieves it correctly', async () => {
    const addressSnapshot = buildOrderAddressSnapshot({
      recipientName: 'Trần Văn B',
      recipientPhone: '0987654321',
      province: 'Hà Nội',
      district: 'Cầu Giấy',
      ward: 'Dịch Vọng',
      deliveryAddress: '123 Đường Xuân Thủy',
    });

    const itemSnapshot = buildOrderItemSnapshot({
      orderId: mockOrderId,
      productId: 'prod-1',
      variantId: 'var-1',
      productName: 'Tai nghe Bluetooth',
      variantName: 'Màu Trắng',
      unitPrice: '500000.00',
      quantity: 1,
    });

    const historyRecord = createOrderStatusHistoryRecord({
      orderId: mockOrderId,
      oldStatus: null,
      newStatus: 'PENDING_CONFIRMATION',
      changedBy: mockBuyerId,
    });

    const orderRecord: OrderRecord = {
      orderId: mockOrderId,
      buyerId: mockBuyerId,
      shopId: mockShopId,
      ...addressSnapshot,
      subtotal: '500000.00',
      discountAmount: '0.00',
      shippingFee: '20000.00',
      totalAmount: '520000.00',
      status: 'PENDING_CONFIRMATION',
      cancelReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Create order
    const created = await orderRepo.createOrder(orderRecord, [itemSnapshot], historyRecord);
    assert.equal(created.orderId, mockOrderId);
    assert.equal(created.totalAmount, '520000.00');

    // 2. Query order by ID
    const found = await orderRepo.findById(mockOrderId);
    assert.ok(found);
    assert.equal(found.recipientName, 'Trần Văn B');

    // 3. Query items
    const items = await orderRepo.findItemsByOrderId(mockOrderId);
    assert.equal(items.length, 1);
    assert.equal(items[0].productNameSnapshot, 'Tai nghe Bluetooth');
    assert.equal(items[0].variantSnapshot, 'Màu Trắng');

    // 4. Query history
    const history = await orderRepo.findHistoryByOrderId(mockOrderId);
    assert.equal(history.length, 1);
    assert.equal(history[0].newStatus, 'PENDING_CONFIRMATION');
  });

  it('updates order status and appends status history record', async () => {
    const orderRecord: OrderRecord = {
      orderId: mockOrderId,
      buyerId: mockBuyerId,
      shopId: mockShopId,
      recipientName: 'A',
      recipientPhone: '090',
      province: 'HCM',
      district: '1',
      ward: 'Bến Nghé',
      deliveryAddress: 'Lê Lợi',
      subtotal: '100.00',
      discountAmount: '0.00',
      shippingFee: '0.00',
      totalAmount: '100.00',
      status: 'PENDING_CONFIRMATION',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const initHistory = createOrderStatusHistoryRecord({
      orderId: mockOrderId,
      oldStatus: null,
      newStatus: 'PENDING_CONFIRMATION',
    });
    await orderRepo.createOrder(orderRecord, [], initHistory);

    // Update to CONFIRMED
    const confirmHistory = createOrderStatusHistoryRecord({
      orderId: mockOrderId,
      oldStatus: 'PENDING_CONFIRMATION',
      newStatus: 'CONFIRMED',
      changedBy: 'seller-user-id',
    });
    await orderRepo.updateStatus(mockOrderId, 'CONFIRMED', confirmHistory);

    const updated = await orderRepo.findById(mockOrderId);
    assert.equal(updated?.status, 'CONFIRMED');

    const history = await orderRepo.findHistoryByOrderId(mockOrderId);
    assert.equal(history.length, 2);
    assert.equal(history[1].newStatus, 'CONFIRMED');
  });

  it('OrderQueryService.getOrderItemForReview returns correct DTO for owner and completed order (QD14)', async () => {
    const itemSnapshot = buildOrderItemSnapshot({
      orderId: mockOrderId,
      productId: 'prod-xyz',
      variantId: 'var-abc',
      productName: 'Giày Thể Thao',
      variantName: 'Size 42',
      unitPrice: '800000.00',
      quantity: 1,
    });

    const orderRecord: OrderRecord = {
      orderId: mockOrderId,
      buyerId: mockBuyerId,
      shopId: mockShopId,
      recipientName: 'A',
      recipientPhone: '090',
      province: 'HCM',
      district: '1',
      ward: 'Bến Nghé',
      deliveryAddress: 'Lê Lợi',
      subtotal: '800000.00',
      discountAmount: '0.00',
      shippingFee: '0.00',
      totalAmount: '800000.00',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const history = createOrderStatusHistoryRecord({
      orderId: mockOrderId,
      oldStatus: 'SHIPPING',
      newStatus: 'COMPLETED',
    });

    await orderRepo.createOrder(orderRecord, [itemSnapshot], history);

    // 1. Valid review request by order owner
    const reviewData = await queryService.getOrderItemForReview(itemSnapshot.orderItemId, mockBuyerId);
    assert.ok(reviewData);
    assert.equal(reviewData.orderStatus, 'COMPLETED');
    assert.equal(reviewData.productId, 'prod-xyz');
    assert.equal(reviewData.buyerId, mockBuyerId);

    // 2. Request by wrong buyer -> returns null (forbidden / not found)
    const wrongBuyerResult = await queryService.getOrderItemForReview(itemSnapshot.orderItemId, 'different-buyer');
    assert.equal(wrongBuyerResult, null);

    // 3. Non-existent order item -> returns null
    const nonExistentResult = await queryService.getOrderItemForReview('non-existent-item', mockBuyerId);
    assert.equal(nonExistentResult, null);
  });
});
