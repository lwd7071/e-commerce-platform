import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { RequestHandler } from 'express';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { OrderLifecycleService } from '../../src/modules/order/services/order-lifecycle.service.ts';
import { OrderQueryService } from '../../src/modules/order/services/order-query.service.ts';
import type { IOrderRepository, OrderRecord, OrderItemRecord } from '../../src/modules/order/domain/repositories.ts';

const BUYER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_BUYER_ID = '99999999-9999-4999-8999-999999999999';

const buyerAuth: RequestHandler = (req, _res, next) => {
  req.context = createRequestContext({
    request_id: req.requestId ?? 'req_order_test',
    user_id: BUYER_ID,
    role: 'BUYER',
  });
  next();
};

function createMockOrderServices() {
  const orders: OrderRecord[] = [
    {
      orderId: '00000000-0000-4000-8000-000000000001',
      buyerId: BUYER_ID,
      shopId: '00000000-0000-4000-8000-000000000002',
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
      shopId: '00000000-0000-4000-8000-000000000002',
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
      const order = orders.find(o => o.orderId === orderId);
      if (order) {
        (order as any).status = status;
      }
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

  const checkoutService = {
    async createOrder(_context: any, command: any) {
      return {
        orders: [
          {
            order_id: '00000000-0000-4000-8000-000000000001',
            shop_id: '00000000-0000-4000-8000-000000000002',
            status: 'PENDING_CONFIRMATION',
            total_amount: '105000',
            payment_id: '00000000-0000-4000-8000-000000000041',
          },
        ],
        command_processed: command.idempotency_key,
      };
    },
  };

  return {
    orderRepo,
    orderLifecycleService,
    orderQueryService,
    checkoutService,
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

  it('GET /api/v1/orders: returns list of buyer orders', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    const res = await request(app).get('/api/v1/orders').expect(200);

    assert.ok(Array.isArray(res.body.data));
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].orderId, '00000000-0000-4000-8000-000000000001');
  });

  it('GET /api/v1/orders/:id: returns order details and items', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    const res = await request(app)
      .get('/api/v1/orders/00000000-0000-4000-8000-000000000001')
      .expect(200);

    assert.strictEqual(res.body.data.orderId, '00000000-0000-4000-8000-000000000001');
    assert.ok(res.body.data.items);
    assert.strictEqual(res.body.data.items.length, 1);
  });

  it('GET /api/v1/orders/:id: returns 404 RESOURCE_NOT_FOUND when accessing another user order (auth-rbac-rls.md §3)', async () => {
    const services = createMockOrderServices();
    const app = createApp({ auth: buyerAuth, orderServices: services });

    const res = await request(app)
      .get('/api/v1/orders/00000000-0000-4000-8000-000000000099')
      .expect(404);

    assert.strictEqual(res.body.error.code, 'RESOURCE_NOT_FOUND');
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
});
