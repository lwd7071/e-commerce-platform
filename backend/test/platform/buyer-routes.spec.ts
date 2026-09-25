import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { RequestHandler } from 'express';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { AddressService } from '../../src/modules/buyer/services/address.service.ts';
import { CartService } from '../../src/modules/buyer/services/cart.service.ts';
import { VoucherService } from '../../src/modules/buyer/services/voucher.service.ts';
import { ReviewService } from '../../src/modules/buyer/services/review.service.ts';
import { NotificationService } from '../../src/modules/buyer/services/notification.service.ts';
import type { IAddressRepository, ICartRepository, IVoucherRepository, IReviewRepository, INotificationRepository } from '../../src/modules/buyer/domain/repositories.ts';
import type { ICatalogPort } from '../../src/contracts/catalog.port.ts';
import type { IOrderQueryPort } from '../../src/modules/buyer/ports/order-query.port.ts';
import type { Address, Cart, CartItem, Voucher, Review, Notification } from '../../src/modules/buyer/domain/types.ts';

const BUYER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';

const buyerAuth: RequestHandler = (req, _res, next) => {
  req.context = createRequestContext({
    request_id: req.requestId ?? 'req_buyer_test',
    user_id: BUYER_ID,
    role: 'BUYER',
  });
  next();
};

const sellerAuth: RequestHandler = (req, _res, next) => {
  req.context = createRequestContext({
    request_id: req.requestId ?? 'req_seller_test',
    user_id: '22222222-2222-4222-8222-222222222222',
    role: 'SELLER',
    shop_id: '33333333-3333-4333-8333-333333333333',
  });
  next();
};

function createMockBuyerServices() {
  const addresses: Address[] = [
    {
      addressId: 'add-1',
      userId: BUYER_ID,
      recipientName: 'Nguyen Van A',
      phone: '0901234567',
      province: 'Ha Noi',
      district: 'Ba Dinh',
      ward: 'Kim Ma',
      detailAddress: '12 Kim Ma',
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      addressId: 'add-other',
      userId: OTHER_USER_ID,
      recipientName: 'Tran Van B',
      phone: '0907654321',
      province: 'HCM',
      district: 'Q1',
      ward: 'Ben Nghe',
      detailAddress: '45 Le Loi',
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const addressRepo: IAddressRepository = {
    async findById(id) { return addresses.find(a => a.addressId === id) ?? null; },
    async findByUserId(userId) { return addresses.filter(a => a.userId === userId); },
    async create(addr) { addresses.push(addr); return addr; },
    async update(addr) {
      const idx = addresses.findIndex(a => a.addressId === addr.addressId);
      if (idx >= 0) addresses[idx] = addr;
      return addr;
    },
    async delete(id) {
      const idx = addresses.findIndex(a => a.addressId === id);
      if (idx >= 0) addresses.splice(idx, 1);
    },
    async setDefault(userId, addressId) {
      for (const a of addresses) {
        if (a.userId === userId) a.isDefault = (a.addressId === addressId);
      }
    },
  };

  const carts: Cart[] = [{
    cartId: 'cart-1',
    buyerId: BUYER_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }];
  const cartItems: CartItem[] = [{
    cartItemId: 'item-1',
    cartId: 'cart-1',
    variantId: 'var-1',
    quantity: 2,
    isSelected: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }];

  const cartRepo: ICartRepository = {
    async findByBuyerId(buyerId) { return carts.find(c => c.buyerId === buyerId) ?? null; },
    async createCart(cart) { carts.push(cart); return cart; },
    async getItems(cartId) { return cartItems.filter(i => i.cartId === cartId); },
    async addItem(_cartId, item) { cartItems.push(item); return item; },
    async updateItem(item) {
      const idx = cartItems.findIndex(i => i.cartItemId === item.cartItemId);
      if (idx >= 0) cartItems[idx] = item;
      return item;
    },
    async removeItem(cartItemId) {
      const idx = cartItems.findIndex(i => i.cartItemId === cartItemId);
      if (idx >= 0) cartItems.splice(idx, 1);
    },
    async clearCheckedOutItems(_buyerId, itemIds) {
      const remaining = cartItems.filter(i => !itemIds.includes(i.cartItemId));
      cartItems.length = 0;
      cartItems.push(...remaining);
    },
  };

  const catalogPort: ICatalogPort = {
    async getVariantPriceAndStock(variantId: string) {
      if (variantId === 'var-out-of-stock') {
        return {
          variantId,
          productId: 'prod-1',
          variantName: 'Color',
          variantValue: 'Black',
          price: '100000',
          stockQuantity: 0,
          status: 'ACTIVE',
        };
      }
      return {
        variantId,
        productId: 'prod-1',
        variantName: 'Color',
        variantValue: 'Black',
        price: '50000',
        stockQuantity: 10,
        status: 'ACTIVE',
      };
    },
    async lockVariant() { return {} as any; },
    async checkShopActive() { return true; },
  };

  const vouchers: Voucher[] = [{
    voucherId: 'vouch-1',
    code: 'DISCOUNT10',
    voucherName: '10k off',
    scope: 'PLATFORM',
    shopId: null,
    discountType: 'FIXED',
    discountValue: '10000',
    maxDiscount: null,
    minOrderValue: '50000',
    quantity: 100,
    startAt: '2020-01-01T00:00:00.000Z',
    endAt: '2030-01-01T00:00:00.000Z',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }];

  const voucherRepo: IVoucherRepository = {
    async findById(id) { return vouchers.find(v => v.voucherId === id) ?? null; },
    async findByCode(code) { return vouchers.find(v => v.code === code) ?? null; },
    async listActive() { return vouchers; },
    async create(v) { vouchers.push(v); return v; },
    async decrementQuantity() { return true; },
    async incrementQuantity() { return true; },
    async recordUsage(u) { return u; },
  };

  const reviews: Review[] = [];
  const reviewRepo: IReviewRepository = {
    async findById(id) { return reviews.find(r => r.reviewId === id) ?? null; },
    async findByProductId(pid) { return reviews.filter(r => r.productId === pid); },
    async findByOrderItemId(orderItemId) { return reviews.find(r => r.orderItemId === orderItemId) ?? null; },
    async create(r) { reviews.push(r); return r; },
  };

  const orderQueryPort: IOrderQueryPort = {
    async getOrderItemForReview(orderItemId: string, buyerId: string) {
      if (buyerId !== BUYER_ID) return null;
      if (orderItemId === 'oi-completed') {
        return {
          orderItemId,
          orderId: 'order-1',
          productId: 'prod-1',
          buyerId: BUYER_ID,
          orderStatus: 'COMPLETED',
          hasExistingReview: false,
        };
      }
      if (orderItemId === 'oi-pending') {
        return {
          orderItemId,
          orderId: 'order-2',
          productId: 'prod-1',
          buyerId: BUYER_ID,
          orderStatus: 'PENDING_CONFIRMATION',
          hasExistingReview: false,
        };
      }
      return null;
    },
    async getOrderSummary() {
      return null;
    },
  };

  const notifications: Notification[] = [{
    notificationId: 'notif-1',
    recipientId: BUYER_ID,
    type: 'ORDER',
    title: 'Don hang da giao',
    content: 'Don hang #123 da hoan tat',
    isRead: false,
    readAt: null,
    createdAt: new Date().toISOString(),
  }];

  const notificationRepo: INotificationRepository = {
    async findById(id) { return notifications.find(n => n.notificationId === id) ?? null; },
    async findByRecipientId(recipientId) { return notifications.filter(n => n.recipientId === recipientId); },
    async create(n) { notifications.push(n); return n; },
    async markAsRead(id, readAt) {
      const notif = notifications.find(n => n.notificationId === id);
      if (notif) {
        notif.isRead = true;
        notif.readAt = readAt ?? null;
      }
      return notif!;
    },
  };

  return {
    addressService: new AddressService(addressRepo),
    cartService: new CartService(cartRepo, catalogPort),
    voucherService: new VoucherService(voucherRepo),
    reviewService: new ReviewService(reviewRepo, orderQueryPort),
    notificationService: new NotificationService(notificationRepo),
  };
}

describe('Buyer Domain Routes Integration (/api/v1/...) [Mốc T2]', () => {
  it('enforces RBAC: returns 401 when no auth is provided', async () => {
    const app = createApp({ buyerServices: createMockBuyerServices() });
    await request(app).get('/api/v1/addresses').expect(401);
  });

  it('enforces RBAC: returns 403 when non-buyer role accesses buyer routes', async () => {
    const app = createApp({ auth: sellerAuth, buyerServices: createMockBuyerServices() });
    const res = await request(app).get('/api/v1/addresses').expect(403);
    assert.strictEqual(res.body.error.code, 'ROLE_REQUIRED');
  });

  describe('Address Routes', () => {
    it('GET /api/v1/addresses: returns 200 and addresses list', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      const res = await request(app).get('/api/v1/addresses').expect(200);

      assert.ok(Array.isArray(res.body.data));
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].addressId, 'add-1');
    });

    it('GET /api/v1/addresses/:id: returns 404 RESOURCE_NOT_FOUND when accessing another user address (auth-rbac-rls.md §3)', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      const res = await request(app).get('/api/v1/addresses/add-other').expect(404);
      assert.strictEqual(res.body.error.code, 'RESOURCE_NOT_FOUND');
    });

    it('POST /api/v1/addresses: creates new address and returns 201', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      const res = await request(app)
        .post('/api/v1/addresses')
        .send({
          recipient_name: 'Nguyen C',
          phone: '0988888888',
          province: 'Da Nang',
          district: 'Hai Chau',
          ward: 'Thach Thang',
          detail_address: '10 Quang Trung',
        })
        .expect(201);

      assert.strictEqual(res.body.data.recipientName, 'Nguyen C');
      assert.strictEqual(res.body.data.province, 'Da Nang');
    });

    it('PATCH /api/v1/addresses/:id/default: sets default address', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      const res = await request(app)
        .patch('/api/v1/addresses/add-1/default')
        .expect(200);

      assert.strictEqual(res.body.data.message, 'Default address updated successfully');
    });

    it('DELETE /api/v1/addresses/:id: deletes address and returns 204', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      await request(app).delete('/api/v1/addresses/add-1').expect(204);
    });
  });

  describe('Cart Routes', () => {
    it('GET /api/v1/cart: returns cart and items', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      const res = await request(app).get('/api/v1/cart').expect(200);

      assert.ok(res.body.data.cart);
      assert.strictEqual(res.body.data.items.length, 1);
      assert.strictEqual(res.body.data.items[0].variantId, 'var-1');
    });

    it('POST /api/v1/cart/items: adds item and returns 201', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      const res = await request(app)
        .post('/api/v1/cart/items')
        .send({ variant_id: '00000000-0000-4000-8000-000000000001', quantity: 1 })
        .expect(201);

      assert.strictEqual(res.body.data.variantId, '00000000-0000-4000-8000-000000000001');
      assert.strictEqual(res.body.data.quantity, 1);
    });

    it('POST /api/v1/cart/items: returns 409 INVENTORY_INSUFFICIENT when out of stock', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      const res = await request(app)
        .post('/api/v1/cart/items')
        .send({ variant_id: '00000000-0000-4000-8000-000000000002', quantity: 99 })
        .expect(409);

      assert.strictEqual(res.body.error.code, 'INVENTORY_INSUFFICIENT');
    });

    it('DELETE /api/v1/cart/items/:id: removes item and returns 204', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      await request(app).delete('/api/v1/cart/items/item-1').expect(204);
    });

    it('DELETE /api/v1/cart/selected: clears selected items and returns 204', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      await request(app).delete('/api/v1/cart/selected').expect(204);
    });
  });

  describe('Voucher Routes', () => {
    it('GET /api/v1/vouchers: returns active vouchers list', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      const res = await request(app).get('/api/v1/vouchers').expect(200);

      assert.ok(Array.isArray(res.body.data));
      assert.strictEqual(res.body.data[0].code, 'DISCOUNT10');
    });

    it('POST /api/v1/vouchers/evaluate: previews valid voucher discount amount', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      const res = await request(app)
        .post('/api/v1/vouchers/evaluate')
        .send({ code: 'DISCOUNT10', order_subtotal: '100000' })
        .expect(200);

      assert.strictEqual(res.body.data.discountAmount, '10000.00');
    });
  });

  describe('Review Routes', () => {
    it('POST /api/v1/order-items/:id/review: creates review for COMPLETED order item (QD14)', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      const res = await request(app)
        .post('/api/v1/order-items/oi-completed/review')
        .send({
          product_id: 'prod-1',
          rating: 5,
          comment: 'San pham rat tot!',
        })
        .expect(201);

      assert.strictEqual(res.body.data.rating, 5);
      assert.strictEqual(res.body.data.orderItemId, 'oi-completed');
    });

    it('POST /api/v1/order-items/:id/review: returns 422 REVIEW_NOT_ELIGIBLE when order is not COMPLETED (QD14)', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      const res = await request(app)
        .post('/api/v1/order-items/oi-pending/review')
        .send({
          product_id: 'prod-1',
          rating: 5,
          comment: 'Test comment',
        })
        .expect(422);

      assert.strictEqual(res.body.error.code, 'REVIEW_NOT_ELIGIBLE');
    });
  });

  describe('Notification Routes', () => {
    it('GET /api/v1/notifications: lists recipient notifications', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      const res = await request(app).get('/api/v1/notifications').expect(200);

      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].notificationId, 'notif-1');
      assert.strictEqual(res.body.data[0].isRead, false);
    });

    it('PATCH /api/v1/notifications/:id/read: marks notification as read (RB-LTT07)', async () => {
      const app = createApp({ auth: buyerAuth, buyerServices: createMockBuyerServices() });
      const res = await request(app).patch('/api/v1/notifications/notif-1/read').expect(200);

      assert.strictEqual(res.body.data.isRead, true);
      assert.ok(res.body.data.readAt);
    });
  });
});
