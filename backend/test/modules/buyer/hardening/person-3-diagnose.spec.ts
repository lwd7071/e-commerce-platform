import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryOrderRepository } from '../../../../src/modules/order/repositories/in-memory-order.repository.ts';
import { OrderLifecycleService } from '../../../../src/modules/order/services/order-lifecycle.service.ts';
import { OrderQueryService } from '../../../../src/modules/order/services/order-query.service.ts';
import { ReviewService } from '../../../../src/modules/buyer/services/review.service.ts';
import { InMemoryReviewRepository } from '../in-memory-repos.ts';
import type { OrderRecord, OrderItemRecord } from '../../../../src/modules/order/domain/repositories.ts';
import type { OrderStatusHistoryRecord } from '../../../../src/modules/order/domain/order-snapshot.ts';

describe('/diagnose Person 3 - Edge cases & Logic flaws', () => {
  const buyerId = '11111111-1111-4111-8111-111111111111';
  const shopId = '22222222-2222-4222-8222-222222222222';
  const orderId = '33333333-3333-4333-8333-333333333333';
  const orderItemId = '44444444-4444-4444-8444-444444444444';
  const productId = '55555555-5555-4555-8555-555555555555';

  it('Issue 1: Hủy đơn PENDING_CONFIRMATION phải cập nhật cancel_reason vào OrderRecord', async () => {
    const orderRepo = new InMemoryOrderRepository();
    const lifecycle = new OrderLifecycleService({ orderRepo });

    const order: OrderRecord = {
      orderId,
      buyerId,
      shopId,
      subtotal: '100000.00',
      discountAmount: '0.00',
      shippingFee: '20000.00',
      totalAmount: '120000.00',
      status: 'PENDING_CONFIRMATION',
      recipientName: 'Nguyen Van A',
      recipientPhone: '0901234567',
      province: 'Ha Noi',
      district: 'Ba Dinh',
      ward: 'Kim Ma',
      deliveryAddress: '123 Kim Ma',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const item: OrderItemRecord = {
      orderItemId,
      orderId,
      productId,
      variantId: 'var-1',
      productNameSnapshot: 'Ao Thun',
      variantSnapshot: 'Trang',
      unitPrice: '100000.00',
      quantity: 1,
      lineTotal: '100000.00',
    };
    const hist: OrderStatusHistoryRecord = {
      historyId: 'h-1',
      orderId,
      oldStatus: null,
      newStatus: 'PENDING_CONFIRMATION',
      changedBy: buyerId,
      reason: null,
      changedAt: new Date().toISOString(),
    };
    await orderRepo.createOrder(order, [item], hist);

    // Buyer cancels order with reason
    const cancelReason = 'Doi y dinh khong mua nua';
    await lifecycle.cancelOrder(orderId, { kind: 'BUYER', userId: buyerId }, cancelReason);

    const cancelledOrder = await orderRepo.findById(orderId);
    assert.ok(cancelledOrder);
    assert.strictEqual(cancelledOrder.status, 'CANCELLED');
    // Kiểm tra cancelReason có được lưu vào OrderRecord không
    assert.strictEqual(cancelledOrder.cancelReason, cancelReason, 'cancelReason must be persisted on order entity');
  });

  it('Issue 2: ReviewService.createReview phải chấp nhận khi productId không truyền (optional)', async () => {
    const orderRepo = new InMemoryOrderRepository();
    const orderQuery = new OrderQueryService(orderRepo);
    const reviewRepo = new InMemoryReviewRepository();
    const reviewService = new ReviewService(reviewRepo, orderQuery);

    const completedOrderId = 'ord-completed-1';
    const completedOrderItemId = 'item-completed-1';
    const order: OrderRecord = {
      orderId: completedOrderId,
      buyerId,
      shopId,
      subtotal: '100000.00',
      discountAmount: '0.00',
      shippingFee: '20000.00',
      totalAmount: '120000.00',
      status: 'COMPLETED',
      recipientName: 'Nguyen Van A',
      recipientPhone: '0901234567',
      province: 'Ha Noi',
      district: 'Ba Dinh',
      ward: 'Kim Ma',
      deliveryAddress: '123 Kim Ma',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const item: OrderItemRecord = {
      orderItemId: completedOrderItemId,
      orderId: completedOrderId,
      productId,
      variantId: 'var-1',
      productNameSnapshot: 'Ao Thun',
      variantSnapshot: 'Trang',
      unitPrice: '100000.00',
      quantity: 1,
      lineTotal: '100000.00',
    };
    await orderRepo.createOrder(order, [item], {
      historyId: 'h-2',
      orderId: completedOrderId,
      oldStatus: null,
      newStatus: 'COMPLETED',
      changedBy: null,
      reason: null,
      changedAt: new Date().toISOString(),
    });

    // Client gọi createReview mà không truyền productId (chỉ truyền orderItemId)
    const review = await reviewService.createReview(
      buyerId,
      completedOrderItemId,
      undefined as unknown as string, // productId omitted
      { rating: 5, content: 'Sản phẩm quá tuyệt vời!' }
    );

    assert.ok(review);
    assert.strictEqual(review.productId, productId);
    assert.strictEqual(review.rating, 5);
  });
});
