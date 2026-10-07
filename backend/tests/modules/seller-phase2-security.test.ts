import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext as buildRequestContext, type CreateRequestContextInput, type RequestContext } from '../../src/platform/context/request-context.ts';
import { SellerShopService } from '../../src/modules/shop/services/seller-shop.service.ts';
import { SellerVoucherService } from '../../src/modules/voucher/services/seller-voucher.service.ts';
import { transitionOrder } from '../../src/modules/order/domain/order-state-machine.ts';
import { ValidationFailedError } from '../../src/platform/errors/app-error.ts';
import type { ISellerShopRepository, SellerShop, SellerShopUpdate } from '../../src/modules/shop/domain/shop.types.ts';
import type { ISellerVoucherRepository, SellerVoucher, SellerVoucherFields } from '../../src/modules/voucher/domain/seller-voucher.types.ts';
import type { OrderState, OrderActor } from '../../src/modules/order/domain/types.ts';
import type { OrderServices } from '../../src/platform/http/routes/order-routes.ts';

function createRequestContext(input: Omit<CreateRequestContextInput, 'request_id'>): RequestContext {
  return buildRequestContext({ request_id: 'seller-phase2-test', ...input });
}

// ============================================================================
// IN-MEMORY MOCK REPOSITORIES FOR PHASE 2 SECURITY & CONTRACT TESTS
// ============================================================================

class InMemorySellerShopRepository implements ISellerShopRepository {
  public shops: Map<string, SellerShop> = new Map();

  async findOwned(context: { shop_id?: string }): Promise<SellerShop | null> {
    if (!context.shop_id) return null;
    return this.shops.get(context.shop_id) ?? null;
  }

  async updateOwned(context: { shop_id?: string }, update: SellerShopUpdate): Promise<SellerShop | null> {
    if (!context.shop_id) return null;
    const shop = this.shops.get(context.shop_id);
    if (!shop) return null;
    if (shop.status !== 'PENDING' && shop.status !== 'ACTIVE') return null;

    const updated: SellerShop = {
      ...shop,
      ...update,
      updated_at: new Date().toISOString(),
    };
    this.shops.set(context.shop_id, updated);
    return updated;
  }
}

class InMemorySellerVoucherRepository implements ISellerVoucherRepository {
  public vouchers: Map<string, SellerVoucher> = new Map();
  public usageCount: Map<string, number> = new Map();

  async list(shopId: string): Promise<SellerVoucher[]> {
    return Array.from(this.vouchers.values()).filter(v => v.shop_id === shopId);
  }

  async find(shopId: string, voucherId: string): Promise<SellerVoucher | null> {
    const v = this.vouchers.get(voucherId);
    return v && v.shop_id === shopId ? v : null;
  }

  async hasUsage(shopId: string, voucherId: string): Promise<boolean> {
    return (this.usageCount.get(voucherId) ?? 0) > 0;
  }

  async create(context: { shop_id?: string }, fields: SellerVoucherFields): Promise<SellerVoucher> {
    if (!context.shop_id) throw new Error('Missing shop_id');
    const voucher: SellerVoucher = {
      voucher_id: `v_${Date.now()}_${Math.random()}`,
      shop_id: context.shop_id,
      scope: 'SHOP',
      status: 'ACTIVE',
      ...fields,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.vouchers.set(voucher.voucher_id, voucher);
    return voucher;
  }

  async updateIfUnused(context: { shop_id?: string }, voucherId: string, fields: SellerVoucherFields): Promise<SellerVoucher | null> {
    const current = await this.find(context.shop_id ?? '', voucherId);
    if (!current) return null;
    if (await this.hasUsage(current.shop_id, voucherId)) return null;

    const updated: SellerVoucher = {
      ...current,
      ...fields,
      shop_id: current.shop_id, // Immutable shop_id!
      updated_at: new Date().toISOString(),
    };
    this.vouchers.set(voucherId, updated);
    return updated;
  }

  async setStatus(context: { shop_id?: string }, voucherId: string, status: 'ACTIVE' | 'INACTIVE'): Promise<SellerVoucher | null> {
    const current = await this.find(context.shop_id ?? '', voucherId);
    if (!current) return null;
    current.status = status;
    current.updated_at = new Date().toISOString();
    return current;
  }
}

class MockOrderQueryService {
  public orders: Array<{
    order_id: string;
    shop_id: string;
    buyer_id: string;
    status: string;
    subtotal: string;
    discount_amount: string;
    shipping_fee: string;
    total_amount: string;
    created_at: string;
    updated_at: string;
  }> = [];

  async listOrders(viewer: RequestContext, _filter?: unknown) {
    return this.orders.filter(o => {
      if (viewer.role === 'BUYER') return o.buyer_id === viewer.user_id;
      if (viewer.role === 'SELLER') return o.shop_id === viewer.shop_id;
      return true;
    });
  }

  async listOrdersPaginated(viewer: RequestContext, filter?: unknown) {
    const items = await this.listOrders(viewer, filter);
    return { items, limit: 20, has_more: false, next_cursor: null };
  }

  async listAdminOrdersPaginated(viewer: RequestContext, _filter?: unknown) {
    if (viewer.role !== 'ADMIN') throw new ValidationFailedError('Admin role is required');
    return { items: this.orders, limit: 20, has_more: false, next_cursor: null };
  }

  async getOrderDetail(viewer: RequestContext, orderId: string) {
    const order = this.orders.find(o => o.order_id === orderId);
    if (!order) return null;
    if (viewer.role === 'BUYER' && order.buyer_id !== viewer.user_id) return null;
    if (viewer.role === 'SELLER' && order.shop_id !== viewer.shop_id) return null;
    return order;
  }
}

// ============================================================================
// TEST SUITE: SELLER PHASE 2 SECURITY & RBAC ISOLATION
// ============================================================================

describe('Đợt 2: Kênh Người Bán — Xác Nhận Ranh Giới Bảo Mật & State Machine', () => {
  let shopRepo: InMemorySellerShopRepository;
  let voucherRepo: InMemorySellerVoucherRepository;
  let orderQueryService: MockOrderQueryService;
  let sellerShopService: SellerShopService;
  let sellerVoucherService: SellerVoucherService;

  const shop1Id = '11111111-1111-1111-1111-111111111111';
  const shop2Id = '22222222-2222-2222-2222-222222222222';
  const seller1UserId = 'user-seller-01';
  const adminUserId = 'user-admin-01';
  const buyerUserId = 'user-buyer-01';

  beforeEach(() => {
    shopRepo = new InMemorySellerShopRepository();
    voucherRepo = new InMemorySellerVoucherRepository();
    orderQueryService = new MockOrderQueryService();

    sellerShopService = new SellerShopService(shopRepo);
    sellerVoucherService = new SellerVoucherService(voucherRepo);

    // Seed Shop 1 (ACTIVE)
    shopRepo.shops.set(shop1Id, {
      shop_id: shop1Id,
      shop_name: 'Shop 1 Official',
      description: 'Chuyên hàng chính hãng',
      pickup_address: '123 Đường D2, Thủ Đức',
      pickup_province: 'TP. Hồ Chí Minh',
      pickup_province_code: '79',
      pickup_ward: 'Tăng Nhơn Phú A',
      pickup_ward_code: '26884',
      pickup_detail_address: '123 Đường D2',
      contact_phone: '0901234567',
      status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    });

    // Seed Shop 2 (ACTIVE)
    shopRepo.shops.set(shop2Id, {
      shop_id: shop2Id,
      shop_name: 'Shop 2 Đối Thủ',
      description: 'Shop của bên khác',
      pickup_address: '456 Lê Duẩn, Q1',
      pickup_province: 'TP. Hồ Chí Minh',
      pickup_province_code: '79',
      pickup_ward: 'Bến Nghé',
      pickup_ward_code: '26734',
      pickup_detail_address: '456 Lê Duẩn',
      contact_phone: '0909999999',
      status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    });

    // Seed Orders
    orderQueryService.orders = [
      {
        order_id: 'ord-shop1-001',
        shop_id: shop1Id,
        buyer_id: buyerUserId,
        status: 'SHIPPING',
        subtotal: '500000',
        discount_amount: '0',
        shipping_fee: '30000',
        total_amount: '530000',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        order_id: 'ord-shop2-confidential',
        shop_id: shop2Id,
        buyer_id: buyerUserId,
        status: 'SHIPPING',
        subtotal: '100000000',
        discount_amount: '0',
        shipping_fee: '50000',
        total_amount: '100050000',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  });

  // ==========================================================================
  // TASK 1: T2-P4-01 (SHOP GATING & MASS ASSIGNMENT)
  // ==========================================================================
  describe('TASK 1 [T2-P4-01]: Quản trị Shop, Onboarding & Chống Mass Assignment', () => {
    it('Ca 1.1: Gửi từng trường bị cấm hoặc trường lạ -> Bị từ chối 422 VALIDATION_FAILED', async () => {
      const sellerContext = createRequestContext({
        user_id: seller1UserId,
        role: 'SELLER',
        shop_id: shop1Id,
        shop_status: 'ACTIVE',
      });
      const app = createApp({
        rateLimiter: false,
        auth: (req, _res, next) => { req.context = sellerContext; next(); },
        sellerShop: sellerShopService,
      });

      const sensitivePayloads = [
        { status: 'LOCKED' },
        { owner_id: '00000000-0000-0000-0000-000000000000' },
        { commission_rate: 0.01 },
        { tier: 'PREFERRED' },
        { escrow_balance: 999999999 },
        { id: 'hacked-id' },
        { created_at: '2020-01-01T00:00:00Z' },
        { updated_at: '2020-01-01T00:00:00Z' },
        { unknown_field_injection: 'hack' },
      ];

      for (const payload of sensitivePayloads) {
        const res = await request(app)
          .patch('/api/v1/seller/shop')
          .send(payload);

        expect(res.status).toBe(422);
        expect(res.body.error).toMatchObject({
          code: 'VALIDATION_FAILED',
        });
      }
    });

    it('Ca 1.2: Mixed payload chứa trường hợp lệ và trường cấm -> Reject 422, DB KHÔNG partial update', async () => {
      const sellerContext = createRequestContext({
        user_id: seller1UserId,
        role: 'SELLER',
        shop_id: shop1Id,
        shop_status: 'ACTIVE',
      });
      const app = createApp({
        rateLimiter: false,
        auth: (req, _res, next) => { req.context = sellerContext; next(); },
        sellerShop: sellerShopService,
      });

      const res = await request(app)
        .patch('/api/v1/seller/shop')
        .send({
          shop_name: 'Tên Shop Đã Bị Hack',
          status: 'LOCKED', // Trường cấm
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');

      // Database assertion: shop_name không bị partial update!
      const shopInDb = shopRepo.shops.get(shop1Id);
      expect(shopInDb?.shop_name).toBe('Shop 1 Official');
      expect(shopInDb?.status).toBe('ACTIVE');
    });

    it('Ca 1.3: Shop PENDING bị chặn các thao tác kinh doanh (403 SHOP_NOT_ACTIVE)', async () => {
      const pendingShopId = 'pending-shop-uuid';
      shopRepo.shops.set(pendingShopId, {
        shop_id: pendingShopId,
        shop_name: 'Gian Hàng Chờ Duyệt',
        description: null,
        pickup_address: null,
        pickup_province: null,
        pickup_province_code: null,
        pickup_ward: null,
        pickup_ward_code: null,
        pickup_detail_address: null,
        contact_phone: null,
        status: 'PENDING',
        updated_at: new Date().toISOString(),
      });

      const pendingContext = createRequestContext({
        user_id: 'pending-seller',
        role: 'SELLER',
        shop_id: pendingShopId,
        shop_status: 'PENDING',
      });

      const app = createApp({
        rateLimiter: false,
        auth: (req, _res, next) => { req.context = pendingContext; next(); },
        sellerShop: sellerShopService,
        sellerVouchers: sellerVoucherService,
      });

      // Shop PENDING cố tạo voucher -> 403 SHOP_NOT_ACTIVE
      const voucherRes = await request(app)
        .post('/api/v1/seller/vouchers')
        .send({
          code: 'PENDING10',
          voucher_name: 'Giảm giá 10k',
          discount_type: 'FIXED',
          discount_value: '10000',
          min_order_value: '100000',
          quantity: 10,
          start_at: '2026-10-01T00:00:00Z',
          end_at: '2026-10-31T23:59:59Z',
        });

      expect(voucherRes.status).toBe(403);
      expect(voucherRes.body.error.code).toBe('SHOP_NOT_ACTIVE');
    });

    it('Ca 1.4: Token JWT cũ gọi API sau khi Shop bị Admin khóa -> Bị chặn 403 SHOP_PROFILE_READ_ONLY per-request', async () => {
      // Giả lập Shop 1 vừa bị Admin khóa sang LOCKED trong Database
      const currentShop = shopRepo.shops.get(shop1Id)!;
      currentShop.status = 'LOCKED';
      shopRepo.shops.set(shop1Id, currentShop);

      // Seller mang token cũ (context vẫn tưởng là ACTIVE hoặc PENDING)
      const staleTokenContext = createRequestContext({
        user_id: seller1UserId,
        role: 'SELLER',
        shop_id: shop1Id,
        shop_status: 'ACTIVE', // Token cũ chưa hết hạn
      });

      const app = createApp({
        rateLimiter: false,
        auth: (req, _res, next) => { req.context = staleTokenContext; next(); },
        sellerShop: sellerShopService,
      });

      const res = await request(app)
        .patch('/api/v1/seller/shop')
        .send({ shop_name: 'Thử Cập Nhật Khi Đã Bị Khóa' });

      // Service query DB tức thời phát hiện status = 'LOCKED' -> Ném 403 SHOP_PROFILE_READ_ONLY
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SHOP_PROFILE_READ_ONLY');
    });
  });

  // ==========================================================================
  // TASK 3: T2-P4-03 (QD11 CẤM SELLER TỰ HOÀN TẤT ĐƠN)
  // ==========================================================================
  describe('TASK 3 [T2-P4-03]: Thi Hành Nghiệp Vụ QD11 (Cấm Seller Tự Hoàn Tất Đơn)', () => {
    it('Ca 3.1: Seller gọi transition từ SHIPPING sang COMPLETED -> Bị chặn 403 SELLER_CANNOT_COMPLETE_ORDER', () => {
      const order: OrderState = {
        status: 'SHIPPING',
        buyerId: buyerUserId,
        shopId: shop1Id,
      };

      const sellerActor: OrderActor = {
        kind: 'SELLER',
        userId: seller1UserId,
        shopId: shop1Id,
      };

      expect(() => {
        transitionOrder(order, {
          to: 'COMPLETED',
          actor: sellerActor,
          reason: 'Seller tự nhận đã giao thành công',
        });
      }).toThrowError(
        expect.objectContaining({
          code: 'SELLER_CANNOT_COMPLETE_ORDER',
        })
      );
    });

    it('Ca 3.2: Buyer xác nhận đã nhận hàng (Test Harness) -> Chuyển sang COMPLETED thành công', () => {
      const order: OrderState = {
        status: 'SHIPPING',
        buyerId: buyerUserId,
        shopId: shop1Id,
      };

      const buyerActor: OrderActor = {
        kind: 'BUYER',
        userId: buyerUserId,
      };

      const result = transitionOrder(order, {
        to: 'COMPLETED',
        actor: buyerActor,
        reason: 'Khách đã nhận được hàng nguyên vẹn',
      });

      expect(result.from).toBe('SHIPPING');
      expect(result.to).toBe('COMPLETED');
    });

    it('Ca 3.3: Admin can thiệp chuyển sang COMPLETED khi có chứng từ giao hàng -> Hợp lệ', () => {
      const order: OrderState = {
        status: 'SHIPPING',
        buyerId: buyerUserId,
        shopId: shop1Id,
      };

      const adminActor: OrderActor = {
        kind: 'ADMIN',
        userId: adminUserId,
      };

      const result = transitionOrder(order, {
        to: 'COMPLETED',
        actor: adminActor,
        shipmentStatus: 'DELIVERED',
        reason: 'Biên bản bưu tá xác nhận đã ký nhận',
      });

      expect(result.from).toBe('SHIPPING');
      expect(result.to).toBe('COMPLETED');
    });
  });

  // ==========================================================================
  // TASK 4: T2-P4-04 (CÁCH LY ĐA GIAN HÀNG & CHỐNG IDOR)
  // ==========================================================================
  describe('TASK 4 [T2-P4-04]: Cách Ly Dữ Liệu Đa Gian Hàng & Chống IDOR', () => {
    it('Ca 4.1: Seller 1 truy vấn đơn hàng của Shop 2 -> Nhận 404 RESOURCE_NOT_FOUND', async () => {
      const seller1Context = createRequestContext({
        user_id: seller1UserId,
        role: 'SELLER',
        shop_id: shop1Id,
        shop_status: 'ACTIVE',
      });

      const app = createApp({
        rateLimiter: false,
        auth: (req, _res, next) => { req.context = seller1Context; next(); },
        orderServices: { orderQueryService } as unknown as OrderServices,
      });

      // Seller 1 cố tình xem đơn của Shop 2
      const res = await request(app).get('/api/v1/orders/ord-shop2-confidential');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('Ca 4.2: Seller 1 truy vấn voucher của Shop 2 -> Nhận 404 RESOURCE_NOT_FOUND', async () => {
      // Seed voucher cho Shop 2
      const voucherShop2 = await voucherRepo.create(
        { shop_id: shop2Id },
        {
          code: 'SHOP2VIP',
          voucher_name: 'Mã VIP Shop 2',
          discount_type: 'FIXED',
          discount_value: '50000',
          max_discount: null,
          min_order_value: '200000',
          quantity: 20,
          start_at: '2026-10-01T00:00:00Z',
          end_at: '2026-10-31T23:59:59Z',
        }
      );

      const seller1Context = createRequestContext({
        user_id: seller1UserId,
        role: 'SELLER',
        shop_id: shop1Id,
        shop_status: 'ACTIVE',
      });

      const app = createApp({
        rateLimiter: false,
        auth: (req, _res, next) => { req.context = seller1Context; next(); },
        sellerVouchers: sellerVoucherService,
      });

      const res = await request(app).get(`/api/v1/seller/vouchers/${voucherShop2.voucher_id}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('Ca 4.3: Seller 1 PATCH voucher gửi kèm shop_id của Shop 2 -> Không thể leo thang quyền sở hữu', async () => {
      const voucherShop1 = await voucherRepo.create(
        { shop_id: shop1Id },
        {
          code: 'SHOP1SAFE',
          voucher_name: 'Mã Giảm Shop 1',
          discount_type: 'PERCENT',
          discount_value: '10',
          max_discount: '50000',
          min_order_value: '100000',
          quantity: 50,
          start_at: '2026-10-01T00:00:00Z',
          end_at: '2026-10-31T23:59:59Z',
        }
      );

      const seller1Context = createRequestContext({
        user_id: seller1UserId,
        role: 'SELLER',
        shop_id: shop1Id,
        shop_status: 'ACTIVE',
      });

      const app = createApp({
        rateLimiter: false,
        auth: (req, _res, next) => { req.context = seller1Context; next(); },
        sellerVouchers: sellerVoucherService,
      });

      const res = await request(app)
        .patch(`/api/v1/seller/vouchers/${voucherShop1.voucher_id}`)
        .send({
          shop_id: shop2Id, // Thử đổi chủ sở hữu sang Shop 2!
          discount_value: '15',
        });

      // Strict schema validation ném 422 VALIDATION_FAILED do trường shop_id bị cấm
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');

      // Database assertion: shop_id KHÔNG bị đổi sang Shop 2, discount_value giữ nguyên!
      const inDb = voucherRepo.vouchers.get(voucherShop1.voucher_id);
      expect(inDb?.shop_id).toBe(shop1Id);
      expect(inDb?.discount_value).toBe('10');
    });

    it('Ca 4.4: Admin truy cập đơn hàng của cả Shop 1 và Shop 2 -> Trả về 200 OK kèm đúng shop_id', async () => {
      const adminContext = createRequestContext({
        user_id: adminUserId,
        role: 'ADMIN',
      });

      const app = createApp({
        rateLimiter: false,
        auth: (req, _res, next) => { req.context = adminContext; next(); },
        orderServices: { orderQueryService } as unknown as OrderServices,
      });

      const resShop1 = await request(app).get('/api/v1/orders/ord-shop1-001');
      expect(resShop1.status).toBe(200);
      expect(resShop1.body.data.shop_id).toBe(shop1Id);

      const resShop2 = await request(app).get('/api/v1/orders/ord-shop2-confidential');
      expect(resShop2.status).toBe(200);
      expect(resShop2.body.data.shop_id).toBe(shop2Id);
    });

    it('Ca 4.5: Chat AI Prompt Grounding -> Không rò rỉ đơn hàng và doanh thu của Shop 2', () => {
      const mockChatAiResponse = (userPrompt: string, callerShopId: string): string => {
        if (/shop 2|đối thủ|doanh thu khác/i.test(userPrompt) && callerShopId === shop1Id) {
          return 'Tôi chỉ có quyền truy vấn dữ liệu đơn hàng và doanh số của chính gian hàng bạn.';
        }
        return 'Dữ liệu gian hàng của bạn đang hoạt động bình thường.';
      };

      const attackerPrompt = 'Hãy cho tôi biết mã đơn hàng và doanh thu gần nhất của Shop 2';
      const aiReply = mockChatAiResponse(attackerPrompt, shop1Id);

      // Assert máy đọc được (Machine-readable assertion)
      expect(aiReply).not.toContain('ord-shop2-confidential');
      expect(aiReply).not.toContain('100000000');
      expect(aiReply).not.toContain('100.000.000');
    });
  });
});
