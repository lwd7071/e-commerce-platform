import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { executeTransactionalCheckout } from '../../../src/modules/checkout/services/transactional-checkout.service.ts';
import { OrderLifecycleService } from '../../../src/modules/order/services/order-lifecycle.service.ts';
import { OrderQueryService } from '../../../src/modules/order/services/order-query.service.ts';
import { PaymentService } from '../../../src/modules/payment/services/payment.service.ts';
import { InMemoryOrderRepository } from '../../../src/modules/order/repositories/in-memory-order.repository.ts';
import { InMemoryPaymentRepository } from '../../../src/modules/payment/repositories/in-memory-payment.repository.ts';
import { InMemoryIdempotencyAdapter } from '../../../src/modules/checkout/domain/in-memory-idempotency.ts';
import { ReviewService } from '../../../src/modules/buyer/services/review.service.ts';
import { NotificationService } from '../../../src/modules/buyer/services/notification.service.ts';
import type { ICartPort } from '../../../src/modules/buyer/ports/cart.port.ts';
import type { ICatalogPort } from '../../../src/modules/catalog/ports/catalog.port.ts';
import type { IVoucherPort } from '../../../src/modules/buyer/ports/voucher.port.ts';
import type { IReviewRepository } from '../../../src/modules/buyer/domain/repositories.ts';
import type { INotificationRepository } from '../../../src/modules/buyer/domain/repositories.ts';
import type { CheckoutCommand } from '../../../src/modules/checkout/contracts/checkout-command.ts';
import type { TransactionDomainEvent } from '../../../src/modules/order/contracts/order-events.contract.ts';
import type { ITransactionEventPort } from '../../../src/modules/buyer/ports/buyer-event.port.ts';
import type { Review, Notification } from '../../../src/modules/buyer/domain/types.ts';
import type { CheckoutResult } from '../../../src/modules/checkout/contracts/checkout-result.ts';

// In-Memory Review Repository
class MockReviewRepository implements IReviewRepository {
  private reviews: Review[] = [];

  async create(review: Review): Promise<Review> {
    this.reviews.push({ ...review });
    return review;
  }
  async findById(reviewId: string): Promise<Review | null> {
    return this.reviews.find(r => r.reviewId === reviewId) ?? null;
  }
  async findByOrderItemId(orderItemId: string): Promise<Review | null> {
    return this.reviews.find(r => r.orderItemId === orderItemId) ?? null;
  }
  async findByProductId(productId: string): Promise<Review[]> {
    return this.reviews.filter(r => r.productId === productId);
  }
}

// In-Memory Notification Repository
class MockNotificationRepository implements INotificationRepository {
  private notifications: Notification[] = [];

  async create(notification: Notification): Promise<Notification> {
    this.notifications.push({ ...notification });
    return notification;
  }
  async findById(notificationId: string): Promise<Notification | null> {
    return this.notifications.find(n => n.notificationId === notificationId) ?? null;
  }
  async findByRecipientId(recipientId: string, isRead?: boolean): Promise<Notification[]> {
    return this.notifications.filter(n => n.recipientId === recipientId && (isRead === undefined || n.isRead === isRead));
  }
  async markAsRead(notificationId: string): Promise<Notification> {
    const noti = this.notifications.find(n => n.notificationId === notificationId);
    if (!noti) throw new Error('Notification not found');
    const updated = { ...noti, isRead: true, readAt: noti.readAt ?? new Date().toISOString() };
    this.notifications = this.notifications.map((item) => item.notificationId === notificationId ? updated : item);
    return updated;
  }
}

// In-Memory Event Bus
class MockEventBus implements ITransactionEventPort {
  private handlers: ((event: TransactionDomainEvent) => Promise<void>)[] = [];

  async publish(event: TransactionDomainEvent): Promise<void> {
    for (const h of this.handlers) {
      await h(event);
    }
  }

  subscribe(handler: (event: TransactionDomainEvent) => Promise<void>): void {
    this.handlers.push(handler);
  }
}

describe('End-to-End Happy Path Integration Test Suite (MVP Mốc T2 - All 5 Members)', () => {
  let orderRepo: InMemoryOrderRepository;
  let paymentRepo: InMemoryPaymentRepository;
  let idempotencyPort: InMemoryIdempotencyAdapter<CheckoutResult>;
  let orderLifecycleService: OrderLifecycleService;
  let orderQueryService: OrderQueryService;
  let paymentService: PaymentService;
  let reviewRepo: MockReviewRepository;
  let reviewService: ReviewService;
  let notiRepo: MockNotificationRepository;
  let eventBus: MockEventBus;

  const buyerId = '11111111-1111-4111-8111-111111111111';
  const sellerShopId = '22222222-2222-4222-8222-222222222222';
  const sellerUserId = '33333333-3333-4333-8333-333333333333';
  const productId = '44444444-4444-4444-8444-444444444444';
  const variantId = '55555555-5555-4555-8555-555555555555';
  const voucherId = '66666666-6666-4666-8666-666666666666';

  let currentStock = 10;
  let cartItems = [{ cartItemId: 'cart-item-01', variantId, quantity: 2, isSelected: true }];
  let consumedVouchers: string[] = [];

  const cartPort: ICartPort = {
    async getSelectedItems(_bId: string) {
      return cartItems.filter(c => c.isSelected);
    },
    async clearCheckedOutItems(bId: string, itemIds: string[]) {
      cartItems = cartItems.filter(c => !itemIds.includes(c.cartItemId));
    },
  };

  const catalogPort: ICatalogPort = {
    async getVariantPriceAndStock(vId: string) {
      return {
        variantId: vId,
        productId,
        productName: 'Áo Polo Premium',
        variantName: 'Size XL',
        variantValue: 'Xanh Navy',
        price: '200000.00',
        stockQuantity: currentStock,
        status: 'ACTIVE',
      };
    },
    async lockVariant(vId: string, quantity: number) {
      if (currentStock < quantity) throw new Error('INVENTORY_INSUFFICIENT');
      currentStock -= quantity;
      return {
        variantId: vId,
        requestedQuantity: quantity,
        priceSnapshot: '200000.00',
        remainingStock: currentStock,
      };
    },
    async checkShopActive(_sId: string) {
      return true;
    },
  };

  const voucherPort: IVoucherPort = {
    async evaluateVoucher(_params) {
      return {
        isValid: true,
        voucherId,
        discountAmount: '50000.00',
      };
    },
    async consumeVoucher(params) {
      consumedVouchers.push(params.voucherId);
      return {
        usageId: 'usage-01',
        voucherId: params.voucherId,
        orderId: params.orderId,
        buyerId: params.buyerId,
        discountAmount: params.discountAmount,
        usedAt: new Date().toISOString(),
      };
    },
  };

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepository();
    paymentRepo = new InMemoryPaymentRepository();
    idempotencyPort = new InMemoryIdempotencyAdapter();
    currentStock = 10;
    cartItems = [{ cartItemId: 'cart-item-01', variantId, quantity: 2, isSelected: true }];
    consumedVouchers = [];

    orderLifecycleService = new OrderLifecycleService({
      orderRepo,
      restockHandler: async (_vId, qty) => {
        currentStock += qty;
      },
    });

    orderQueryService = new OrderQueryService(orderRepo);

    paymentService = new PaymentService({
      paymentRepo,
      orderRepo,
    });

    reviewRepo = new MockReviewRepository();
    reviewService = new ReviewService(reviewRepo, orderQueryService);

    notiRepo = new MockNotificationRepository();
    eventBus = new MockEventBus();
    new NotificationService(notiRepo, eventBus, orderQueryService);
  });

  it('Happy Path: Cart -> Checkout (ACID) -> Settle Payment -> Seller Confirm -> Transition Shipping -> Completed -> Review & Notification', async () => {
    // ----------------------------------------------------
    // Giai đoạn 1: Checkout 12 bước ACID nguyên tử (Người 5 + Người 3 + Người 4)
    // ----------------------------------------------------
    const checkoutCmd: CheckoutCommand = {
      address_id: '77777777-7777-4777-8777-777777777777',
      payment_method: 'ONLINE',
      vouchers: [{ shop_id: sellerShopId, code: 'SALE50K' }],
      idempotency_key: 'idemp-e2e-happy-path-001',
    };

    const checkoutResult = await executeTransactionalCheckout({
      buyerId,
      command: checkoutCmd,
      cartPort,
      catalogPort,
      voucherPort,
      orderRepo,
      paymentRepo,
      idempotencyPort,
      shopResolver: async () => sellerShopId,
      addressResolver: async () => ({
        recipientName: 'Nguyen Van A',
        recipientPhone: '0901234567',
        province: 'Ha Noi',
        district: 'Ba Dinh',
        ward: 'Kim Ma',
        deliveryAddress: '123 Kim Ma',
      }),
    });

    assert.strictEqual(checkoutResult.orders.length, 1);
    const orderInfo = checkoutResult.orders[0];
    const orderId = orderInfo.order_id;
    const paymentId = orderInfo.payment_id;

    // Xác nhận giỏ hàng đã được dọn sạch và voucher đã tiêu thụ
    assert.strictEqual(cartItems.length, 0);
    assert.strictEqual(consumedVouchers.includes(voucherId), true);
    // Tồn kho giảm từ 10 xuống 8
    assert.strictEqual(currentStock, 8);

    // Xác minh trạng thái ban đầu của Đơn hàng và Thanh toán
    const createdOrder = await orderRepo.findById(orderId);
    assert.ok(createdOrder);
    assert.strictEqual(createdOrder.status, 'PENDING_CONFIRMATION');
    // Subtotal = 2 * 200.000 = 400.000; Discount = 50.000; Total = 350.000
    assert.strictEqual(createdOrder.subtotal, '400000.00');
    assert.strictEqual(createdOrder.discountAmount, '50000.00');
    assert.strictEqual(createdOrder.totalAmount, '350000.00');

    const paymentRecord = await paymentRepo.findById(paymentId);
    assert.ok(paymentRecord);
    assert.strictEqual(paymentRecord.status, 'PENDING');
    assert.strictEqual(paymentRecord.amount, '350000.00');

    // ----------------------------------------------------
    // Giai đoạn 2: Khách hàng thanh toán Online thành công (Người 5)
    // ----------------------------------------------------
    const settledPayment = await paymentService.settlePayment(
      paymentId,
      'SUCCESS',
      new Date().toISOString(),
    );
    assert.strictEqual(settledPayment.status, 'SUCCESS');
    assert.ok(settledPayment.paidAt);

    // Bắn event thanh toán thành công cho NotificationService
    const paymentEvent: TransactionDomainEvent = {
      type: 'PAYMENT_STATUS_CHANGED',
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      paymentId,
      orderId,
      status: 'SUCCESS',
      amount: '350000.00',
    };
    await eventBus.publish(paymentEvent);

    // ----------------------------------------------------
    // Giai đoạn 3: Seller xác nhận đơn hàng (Người 5)
    // ----------------------------------------------------
    const sellerActor = { kind: 'SELLER' as const, userId: sellerUserId, shopId: sellerShopId };
    const confirmedOrder = await orderLifecycleService.confirmOrder(orderId, sellerActor);
    assert.strictEqual(confirmedOrder.status, 'CONFIRMED');

    // ----------------------------------------------------
    // Giai đoạn 4: Vòng đời vận chuyển -> Hoàn tất đơn hàng COMPLETED (Người 5)
    // ----------------------------------------------------
    // 4.1. Seller chuẩn bị hàng (CONFIRMED -> PREPARING)
    const preparingOrder = await orderLifecycleService.transitionOrder(orderId, sellerActor, {
      to: 'PREPARING',
    });
    assert.strictEqual(preparingOrder.status, 'PREPARING');

    // 4.2. Giao hàng cho đối tác vận chuyển (PREPARING -> SHIPPING)
    const shippingOrder = await orderLifecycleService.transitionOrder(orderId, sellerActor, {
      to: 'SHIPPING',
      shipmentStatus: 'HANDED_OVER',
    });
    assert.strictEqual(shippingOrder.status, 'SHIPPING');

    // 4.3. Giao hàng thành công (SHIPPING -> COMPLETED)
    const integrationActor = { kind: 'ADMIN' as const, userId: 'system-carrier-bot' };
    const completedOrder = await orderLifecycleService.transitionOrder(orderId, integrationActor, {
      to: 'COMPLETED',
      shipmentStatus: 'DELIVERED',
      reason: 'Delivered successfully by carrier',
    });
    assert.strictEqual(completedOrder.status, 'COMPLETED');

    // Bắn event hoàn tất đơn hàng cho NotificationService
    const completedEvent: TransactionDomainEvent = {
      type: 'ORDER_STATUS_CHANGED',
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      orderId,
      buyerId,
      shopId: sellerShopId,
      oldStatus: 'SHIPPING',
      newStatus: 'COMPLETED',
    };
    await eventBus.publish(completedEvent);

    // ----------------------------------------------------
    // Giai đoạn 5: Buyer đánh giá sản phẩm sau khi đơn COMPLETED (Người 4 + Người 5)
    // ----------------------------------------------------
    const items = await orderRepo.findItemsByOrderId(orderId);
    assert.strictEqual(items.length, 1);
    const orderItemId = items[0].orderItemId;

    // Kiểm tra điều kiện đánh giá qua OrderQueryService
    const reviewContext = await orderQueryService.getOrderItemForReview(orderItemId, buyerId);
    assert.ok(reviewContext);
    assert.strictEqual(reviewContext.orderStatus, 'COMPLETED');

    // Buyer gửi đánh giá 5 sao
    const reviewResult = await reviewService.createReview(
      buyerId,
      orderItemId,
      productId,
      {
        rating: 5,
        content: 'Sản phẩm vải rất đẹp, giao hàng siêu nhanh!',
        images: [],
      },
    );

    assert.ok(reviewResult.reviewId);
    assert.strictEqual(reviewResult.rating, 5);
    assert.strictEqual(reviewResult.productId, productId);

    // ----------------------------------------------------
    // Giai đoạn 6: Xác nhận thông báo đã được gửi đến Buyer (Người 4)
    // ----------------------------------------------------
    const buyerNotifications = await notiRepo.findByRecipientId(buyerId);
    assert.ok(buyerNotifications.length >= 2);
    const notiTypes = buyerNotifications.map(n => n.type);
    assert.strictEqual(notiTypes.includes('ORDER'), true);
    assert.strictEqual(notiTypes.includes('PAYMENT'), true);
  });
});
