import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ReviewService } from '../../../../src/modules/buyer/services/review.service.ts';
import { InMemoryReviewRepository } from '../in-memory-repos.ts';
import { OrderQueryService } from '../../../../src/modules/order/services/order-query.service.ts';
import { InMemoryOrderRepository } from '../../../../src/modules/order/repositories/in-memory-order.repository.ts';
import {
  ReviewNotEligibleError,
  ReviewAlreadyExistsError,
} from '../../../../src/modules/buyer/domain/errors.ts';
import type { OrderRecord, OrderItemRecord } from '../../../../src/modules/order/domain/repositories.ts';
import type { OrderStatusHistoryRecord } from '../../../../src/modules/order/domain/order-snapshot.ts';

describe('OrderQueryService ↔ ReviewService Cross-Domain Integration Tests (TDD - QD14, RB-LB09)', () => {
  let orderRepo: InMemoryOrderRepository;
  let orderQueryService: OrderQueryService;
  let reviewRepo: InMemoryReviewRepository;
  let reviewService: ReviewService;

  const validBuyerId = '11111111-1111-4111-8111-111111111111';
  const otherBuyerId = '88888888-8888-4888-8888-888888888888';
  const shopId = '22222222-2222-4222-8222-222222222222';
  const productId = '33333333-3333-4333-8333-333333333333';
  const variantId = '44444444-4444-4444-8444-444444444444';
  const completedOrderId = '55555555-5555-4555-8555-555555555555';
  const completedOrderItemId = '66666666-6666-4666-8666-666666666666';
  const shippingOrderId = '77777777-7777-4777-8777-777777777777';
  const shippingOrderItemId = '88888888-7777-4888-8888-777777777777';

  beforeEach(async () => {
    orderRepo = new InMemoryOrderRepository();
    orderQueryService = new OrderQueryService(orderRepo);
    reviewRepo = new InMemoryReviewRepository();
    reviewService = new ReviewService(reviewRepo, orderQueryService);

    // 1. Tạo đơn hàng COMPLETED sở hữu bởi validBuyerId
    const completedOrder: OrderRecord = {
      orderId: completedOrderId,
      buyerId: validBuyerId,
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
    const completedItem: OrderItemRecord = {
      orderItemId: completedOrderItemId,
      orderId: completedOrderId,
      productId,
      variantId,
      productNameSnapshot: 'Ao Thun Cotton',
      variantSnapshot: 'Trang - L',
      unitPrice: '100000.00',
      quantity: 1,
      lineTotal: '100000.00',
    };
    const initialHistory: OrderStatusHistoryRecord = {
      historyId: 'hist-1',
      orderId: completedOrderId,
      oldStatus: null,
      newStatus: 'COMPLETED',
      changedBy: null,
      reason: 'Delivered',
      changedAt: new Date().toISOString(),
    };
    await orderRepo.createOrder(completedOrder, [completedItem], initialHistory);

    // 2. Tạo đơn hàng SHIPPING sở hữu bởi validBuyerId
    const shippingOrder: OrderRecord = {
      orderId: shippingOrderId,
      buyerId: validBuyerId,
      shopId,
      subtotal: '200000.00',
      discountAmount: '0.00',
      shippingFee: '20000.00',
      totalAmount: '220000.00',
      status: 'SHIPPING',
      recipientName: 'Nguyen Van A',
      recipientPhone: '0901234567',
      province: 'Ha Noi',
      district: 'Ba Dinh',
      ward: 'Kim Ma',
      deliveryAddress: '123 Kim Ma',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const shippingItem: OrderItemRecord = {
      orderItemId: shippingOrderItemId,
      orderId: shippingOrderId,
      productId,
      variantId,
      productNameSnapshot: 'Quan Jean Denim',
      variantSnapshot: 'Xanh - 32',
      unitPrice: '200000.00',
      quantity: 1,
      lineTotal: '200000.00',
    };
    await orderRepo.createOrder(shippingOrder, [shippingItem], {
      historyId: 'hist-2',
      orderId: shippingOrderId,
      oldStatus: null,
      newStatus: 'SHIPPING',
      changedBy: null,
      reason: 'Dispatched',
      changedAt: new Date().toISOString(),
    });
  });

  it('[QD14 Happy Path] Buyer sở hữu đơn COMPLETED đánh giá thành công', async () => {
    const review = await reviewService.createReview(
      validBuyerId,
      completedOrderItemId,
      productId,
      {
        rating: 5,
        content: 'Hàng chuẩn chất lượng cao!',
        images: ['https://cdn.example.com/review1.jpg'],
      }
    );

    assert.ok(review.reviewId);
    assert.equal(review.buyerId, validBuyerId);
    assert.equal(review.orderItemId, completedOrderItemId);
    assert.equal(review.productId, productId);
    assert.equal(review.rating, 5);
    assert.equal(review.status, 'VISIBLE');

    // Kiểm tra đã lưu vào repository
    const found = await reviewRepo.findById(review.reviewId);
    assert.ok(found);
    assert.equal(found.content, 'Hàng chuẩn chất lượng cao!');
  });

  it('[QD14] Buyer khác cố đánh giá đơn không thuộc sở hữu của mình -> REVIEW_NOT_ELIGIBLE', async () => {
    await assert.rejects(
      async () => reviewService.createReview(
        otherBuyerId, // Sai buyer
        completedOrderItemId,
        productId,
        { rating: 5 }
      ),
      (err: unknown) => err instanceof ReviewNotEligibleError && err.code === 'REVIEW_NOT_ELIGIBLE'
    );
  });

  it('[QD14] Đơn hàng đang ở trạng thái SHIPPING (chưa COMPLETED) -> REVIEW_NOT_ELIGIBLE', async () => {
    await assert.rejects(
      async () => reviewService.createReview(
        validBuyerId,
        shippingOrderItemId,
        productId,
        { rating: 5 }
      ),
      (err: unknown) => err instanceof ReviewNotEligibleError && err.code === 'REVIEW_NOT_ELIGIBLE'
    );
  });

  it('[RB-LB09] Đánh giá lần 2 trên cùng một OrderItem -> REVIEW_ALREADY_EXISTS', async () => {
    // Đánh giá lần 1
    await reviewService.createReview(
      validBuyerId,
      completedOrderItemId,
      productId,
      { rating: 5, content: 'Đánh giá lần 1' }
    );

    // Đánh giá lần 2
    await assert.rejects(
      async () => reviewService.createReview(
        validBuyerId,
        completedOrderItemId,
        productId,
        { rating: 4, content: 'Đánh giá lần 2 trùng lặp' }
      ),
      (err: unknown) => err instanceof ReviewAlreadyExistsError && err.code === 'REVIEW_ALREADY_EXISTS'
    );
  });

  it('[QD14] orderItemId không tồn tại trong hệ thống Order -> REVIEW_NOT_ELIGIBLE', async () => {
    const nonExistentItemId = '99999999-9999-4999-8999-999999999999';
    await assert.rejects(
      async () => reviewService.createReview(
        validBuyerId,
        nonExistentItemId,
        productId,
        { rating: 5 }
      ),
      (err: unknown) => err instanceof ReviewNotEligibleError && err.code === 'REVIEW_NOT_ELIGIBLE'
    );
  });
});
