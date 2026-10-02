import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { RequestHandler } from 'express';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { OrderLifecycleService } from '../../src/modules/order/services/order-lifecycle.service.ts';
import { OrderQueryService } from '../../src/modules/order/services/order-query.service.ts';
import type { IOrderRepository, OrderRecord, OrderItemRecord } from '../../src/modules/order/domain/repositories.ts';
import { InMemoryPaymentRepository } from '../../src/modules/payment/repositories/in-memory-payment.repository.ts';
import { PaymentService } from '../../src/modules/payment/services/payment.service.ts';
import type { RequestContext } from '../../src/platform/context/request-context.ts';
import type { CheckoutCommand } from '../../src/modules/checkout/contracts/checkout-command.ts';

const BUYER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_BUYER_ID = '99999999-9999-4999-8999-999999999999';
const SELLER_SHOP_ID = '00000000-0000-4000-8000-000000000002';
const OTHER_SHOP_ID = '00000000-0000-4000-8000-000000000009';
const SELLER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';

const buyerAuth: RequestHandler = (req, _res, next) => {
  req.context = createRequestContext({
    request_id: req.requestId ?? 'req_order_test',
    user_id: BUYER_ID,
    role: 'BUYER',
  });
  next();
};

const sellerAuth: RequestHandler = (req, _res, next) => {
  req.context = createRequestContext({
    request_id: req.requestId ?? 'req_seller_test',
    user_id: SELLER_ID,
    shop_id: SELLER_SHOP_ID,
    role: 'SELLER',
  });
  next();
};

const otherSellerAuth: RequestHandler = (req, _res, next) => {
  req.context = createRequestContext({
    request_id: req.requestId ?? 'req_order_test_other_seller',
    user_id: 'seller-user-0002',
    shop_id: OTHER_SHOP_ID,
    role: 'SELLER',
  });
  next();
};

const adminAuth: RequestHandler = (req, _res, next) => {
  req.context = createRequestContext({
    request_id: req.requestId ?? 'req_admin_test',
    user_id: ADMIN_ID,
    role: 'ADMIN',
  });
  next();
};

function createMockOrderServices() {
  const orders: OrderRecord[] = [
    {
      orderId: '00000000-0000-4000-8000-000000000001',
      buyerId: BUYER_ID,
      shopId: SELLER_SHOP_ID,
      subtotal: '100000',
      discountAmount: '10000',
      shippingFee: '15000',
      totalAmount: '105000',
      status: 'PENDING_CONFIRMATION',
      recipientName: 'Nguyen Van A',
      recipientPhone: '0901234567',
      province: 'Ha Noi',
      district: 'Ba Dinh',
      ward: 'Kim Ma',
      deliveryAddress: '12 Kim Ma',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      orderId: '00000000-0000-4000-8000-000000000099',
      buyerId: OTHER_BUYER_ID,
      shopId: SELLER_SHOP_ID,
      subtotal: '50000',
      discountAmount: '0',
      shippingFee: '15000',
      totalAmount: '65000',
      status: 'PENDING_CONFIRMATION',
      recipientName: 'Other User',
      recipientPhone: '0909999999',
      province: 'HCM',
      district: 'Q1',
      ward: 'Ben Nghe',
      deliveryAddress: '45 Le Loi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const orderItems: OrderItemRecord[] = [
    {
      orderItemId: '00000000-0000-4000-8000-000000000011',
      orderId: '00000000-0000-4000-8000-000000000001',
      variantId: '00000000-0000-4000-8000-000000000021',
      productId: '00000000-0000-4000-8000-000000000031',
      productNameSnapshot: 'Ao thun',
      variantSnapshot: 'Size M: M',
      unitPrice: '50000',
      quantity: 2,
      lineTotal: '100000',
    },
  ];

  let restockCalled = false;

  const orderRepo: IOrderRepository = {
    async createOrder(order, items) {
      orders.push(order);
      orderItems.push(...items);
      return order;
    },
    async findById(orderId) {
      return orders.find(o => o.orderId === orderId) ?? null;
    },
    async findItemsByOrderId(orderId) {
      return orderItems.filter(i => i.orderId === orderId);
    },
    async findItemById(itemId) {
      return orderItems.find(i => i.orderItemId === itemId) ?? null;
    },
    async findByBuyerId(buyerId) {
      return orders.filter(o => o.buyerId === buyerId);
    },
    async findByShopId(shopId) {
      return orders.filter(o => o.shopId === shopId);
    },
    async updateStatus(orderId, status, _history) {
      const index = orders.findIndex(o => o.orderId === orderId);
      if (index >= 0) orders[index] = { ...orders[index], status };
    },
    async findHistoryByOrderId(_orderId) {
      return [];
    },
  };

  const orderLifecycleService = new OrderLifecycleService({
    orderRepo,
    restockHandler: async () => {
      restockCalled = true;
    },
  });

  const orderQueryService = new OrderQueryService(orderRepo);

  const paymentRepo = new InMemoryPaymentRepository();
  const paymentService = new PaymentService({
    paymentRepo,
    orderRepo,
  });

  const checkoutService = {
    async createOrder(_context: RequestContext, command: CheckoutCommand) {
      return {
        orders: [
          {
            order_id: '00000000-0000-4000-8000-000000000001',
            shop_id: SELLER_SHOP_ID,
            status: 'PENDING_CONFIRMATION',
            total_amount: '105000',
            payment_id: '00000000-0000-4000-8000-000000000041',
          },
        ],
        command_processed: command.idempotency_key,
      };
    },
  };

  const retryPayment = async (_context: RequestContext, orderId: string, input?: Record<string, unknown>) => {
    const order = orders.find(o => o.orderId === orderId);
    if (!order) return null;
    return {
      payment_id: '00000000-0000-4000-8000-000000000042',
      order_id: orderId,
      method: input?.payment_method ?? 'ONLINE',
      amount: order.totalAmount,
      status: 'PENDING',
    };
  };

  return {
    orderRepo,
    paymentRepo,
    paymentService,
    orderLifecycleService,
    orderQueryService,
    checkoutService,
    retryPayment,
    getRestockCalled: () => restockCalled,
  };
}

describe('Order & Checkout Domain Routes Integration (/api/v1/...) [Mốc T2]', () => {
  it('POST /api/v1/checkout: executes checkout and returns 201', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    const res = await request(app)
      .post('/api/v1/checkout')
      .set('Idempotency-Key', 'idemp-test-12345678')
      .send({
        address_id: '00000000-0000-4000-8000-000000000005',
        payment_method: 'COD',
      })
      .expect(201);

    assert.ok(res.body.data.orders);
    assert.strictEqual(res.body.data.orders.length, 1);
    assert.strictEqual(res.body.data.command_processed, 'idemp-test-12345678');
  });

  it('POST /api/v1/checkout: returns 400 IDEMPOTENCY_KEY_REQUIRED when header is missing', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    const res = await request(app)
      .post('/api/v1/checkout')
      .send({
        address_id: '00000000-0000-4000-8000-000000000005',
        payment_method: 'COD',
      })
      .expect(400);

    assert.strictEqual(res.body.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
  });

  it('POST /api/v1/orders: alias creates order from checkout and returns 201', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Idempotency-Key', 'idemp-test-87654321')
      .send({
        address_id: '00000000-0000-4000-8000-000000000005',
        payment_method: 'COD',
      })
      .expect(201);

    assert.ok(res.body.data.orders);
  });

  it('GET /api/v1/orders: refuses to return repository-only rows without a configured read database', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    const res = await request(app).get('/api/v1/orders').expect(503);
    assert.strictEqual(res.body.error.code, 'DEPENDENCY_UNAVAILABLE');
  });

  it('GET /api/v1/orders/:id: refuses to return a placeholder without a configured read database', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    const res = await request(app)
      .get('/api/v1/orders/00000000-0000-4000-8000-000000000001')
      .expect(503);
    assert.strictEqual(res.body.error.code, 'DEPENDENCY_UNAVAILABLE');
  });

  it('GET /api/v1/orders/:id: reports dependency unavailable instead of reading through a command repository', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    const res = await request(app)
      .get('/api/v1/orders/00000000-0000-4000-8000-000000000099')
      .expect(503);
    assert.strictEqual(res.body.error.code, 'DEPENDENCY_UNAVAILABLE');
  });

  it('POST /api/v1/orders/:id/cancel: returns 422 REASON_REQUIRED when reason is missing (RB-LTT08, QD12)', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    const res = await request(app)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/cancel')
      .send({ reason: '   ' })
      .expect(422);

    assert.strictEqual(res.body.error.code, 'REASON_REQUIRED');
  });

  it('POST /api/v1/orders/:id/cancel: cancels order and triggers restock handler (QD12, QD13)', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    const res = await request(app)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/cancel')
      .send({ reason: 'Doi y dinh khong mua nua' })
      .expect(200);

    assert.strictEqual(res.body.data.status, 'CANCELLED');
    assert.strictEqual(services.getRestockCalled(), true);
  });

  // ==========================================
  // CONFIRM ORDER TESTS (QD11, QD13)
  // ==========================================
  it('POST /api/v1/orders/:id/confirm: seller of matching shop confirms order successfully', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: sellerAuth, orderServices: services });

    const res = await request(app)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/confirm')
      .expect(200);

    assert.strictEqual(res.body.data.status, 'CONFIRMED');
  });

  it('POST /api/v1/orders/:id/confirm: admin confirms order successfully', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: adminAuth, orderServices: services });

    const res = await request(app)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/confirm')
      .send({ reason: 'Admin intervention after support review' })
      .expect(200);

    assert.strictEqual(res.body.data.status, 'CONFIRMED');
  });

  it('POST /api/v1/orders/:id/confirm: requires reason for admin action (QD20)', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: adminAuth, orderServices: services });

    const res = await request(app)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/confirm')
      .send({ reason: '   ' })
      .expect(422);

    assert.strictEqual(res.body.error.code, 'REASON_REQUIRED');
  });

  it('POST /api/v1/orders/:id/confirm: seller of different shop receives 403 RESOURCE_FORBIDDEN', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: otherSellerAuth, orderServices: services });

    const res = await request(app)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/confirm')
      .expect(403);

    assert.strictEqual(res.body.error.code, 'RESOURCE_FORBIDDEN');
  });

  it('POST /api/v1/orders/:id/confirm: buyer attempting confirm receives 403 ROLE_REQUIRED', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    const res = await request(app)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/confirm')
      .expect(403);

    assert.strictEqual(res.body.error.code, 'ROLE_REQUIRED');
  });

  // ==========================================
  // TRANSITION ORDER TESTS (QD11, QD13)
  // ==========================================
  it('POST /api/v1/orders/:id/transition: seller advances order to PREPARING after confirmation', async () => {
    const services = createMockOrderServices();
    // First confirm
    const appSeller = createApp({ auth: sellerAuth, orderServices: services });
    await request(appSeller)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/confirm')
      .expect(200);

    // Then transition to PREPARING
    const res = await request(appSeller)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/transition')
      .send({ to: 'PREPARING' })
      .expect(200);

    assert.strictEqual(res.body.data.status, 'PREPARING');
  });

  it('POST /api/v1/orders/:id/transition: invalid transition is rejected with 409 ORDER_INVALID_TRANSITION', async () => {
    const services = createMockOrderServices();
    const appSeller = createApp({ auth: sellerAuth, orderServices: services });

    // Order is currently PENDING_CONFIRMATION, cannot jump straight to SHIPPING
    const res = await request(appSeller)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/transition')
      .send({ to: 'SHIPPING' })
      .expect(409);

    assert.strictEqual(res.body.error.code, 'ORDER_INVALID_TRANSITION');
  });

  it('POST /api/v1/orders/:id/transition: rejects BUYER with 403 ROLE_REQUIRED', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    const res = await request(app)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/transition')
      .send({ to: 'PREPARING' })
      .expect(403);

    assert.strictEqual(res.body.error.code, 'ROLE_REQUIRED');
  });

  // ==========================================
  // RETRY PAYMENT TESTS (Workflow §7)
  // ==========================================
  it('POST /api/v1/orders/:id/payments: buyer retries payment and receives 201 with PENDING payment', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    const res = await request(app)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/payments')
      .send({ payment_method: 'ONLINE' })
      .expect(201);

    assert.ok(res.body.data.paymentId);
    assert.strictEqual(res.body.data.status, 'PENDING');
    assert.strictEqual(res.body.data.method, 'ONLINE');
    assert.strictEqual(res.body.data.amount, '105000');
  });

  it('POST /api/v1/orders/:id/payments: accessing another user order returns 404 RESOURCE_NOT_FOUND', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    // Order 99 belongs to OTHER_BUYER_ID
    const res = await request(app)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000099/payments')
      .send({ payment_method: 'ONLINE' })
      .expect(404);

    assert.strictEqual(res.body.error.code, 'RESOURCE_NOT_FOUND');
  });

  it('POST /api/v1/orders/:id/payments: retry on cancelled order returns 409 PAYMENT_STATE_INVALID', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    // Cancel the order first
    await request(app)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/cancel')
      .send({ reason: 'Huy don' })
      .expect(200);

    // Try to retry payment
    const res = await request(app)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/payments')
      .send({ payment_method: 'ONLINE' })
      .expect(409);

    assert.strictEqual(res.body.error.code, 'PAYMENT_STATE_INVALID');
  });

  it('POST /api/v1/orders/:id/payments: rejects SELLER with 403 ROLE_REQUIRED', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: sellerAuth, orderServices: services });

    const res = await request(app)
      .post('/api/v1/orders/00000000-0000-4000-8000-000000000001/payments')
      .send({ payment_method: 'ONLINE' })
      .expect(403);

    assert.strictEqual(res.body.error.code, 'ROLE_REQUIRED');
  });
});
