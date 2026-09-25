import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CartService } from '../../../../src/modules/buyer/services/cart.service';
import { AddressService } from '../../../../src/modules/buyer/services/address.service';
import { ReviewService } from '../../../../src/modules/buyer/services/review.service';
import { VoucherService } from '../../../../src/modules/buyer/services/voucher.service';
import {
  ValidationError,
  ResourceNotFoundError,
  InventoryInsufficientError,
  ReviewNotEligibleError,
  ReviewAlreadyExistsError,
  VoucherNotApplicableError,
} from '../../../../src/modules/buyer/domain/errors';
import type {
  ICartRepository,
  IAddressRepository,
  IReviewRepository,
  IVoucherRepository,
} from '../../../../src/modules/buyer/domain/repositories';
import type { ICatalogPort, VariantPriceAndStockDTO, LockVariantResultDTO } from '../../../../src/contracts/catalog.port';
import type { IOrderQueryPort, ReviewOrderItemDTO, OrderSummaryDTO } from '../../../../src/modules/buyer/ports/order-query.port';
import type {
  Cart,
  CartItem,
  Address,
  Review,
  Voucher,
  VoucherUsage,
  UUID,
} from '../../../../src/modules/buyer/domain/types';

// ===================== MOCK REPOSITORIES & PORTS =====================

class MockCartRepository implements ICartRepository {
  public carts: Map<UUID, Cart> = new Map();
  public items: Map<UUID, CartItem[]> = new Map();

  async findByBuyerId(buyerId: UUID): Promise<Cart | null> {
    for (const c of this.carts.values()) {
      if (c.buyerId === buyerId) return c;
    }
    return null;
  }

  async createCart(cart: Cart): Promise<Cart> {
    this.carts.set(cart.cartId, cart);
    this.items.set(cart.cartId, []);
    return cart;
  }

  async getItems(cartId: UUID): Promise<CartItem[]> {
    return this.items.get(cartId) ?? [];
  }

  async addItem(cartId: UUID, item: CartItem): Promise<CartItem> {
    const list = this.items.get(cartId) ?? [];
    list.push(item);
    this.items.set(cartId, list);
    return item;
  }

  async updateItem(item: CartItem): Promise<CartItem> {
    const list = this.items.get(item.cartId) ?? [];
    const idx = list.findIndex(i => i.cartItemId === item.cartItemId);
    if (idx >= 0) list[idx] = item;
    return item;
  }

  async removeItem(cartItemId: UUID): Promise<void> {
    for (const [cartId, list] of this.items.entries()) {
      this.items.set(cartId, list.filter(i => i.cartItemId !== cartItemId));
    }
  }

  async clearCheckedOutItems(buyerId: UUID, itemIds: UUID[]): Promise<void> {
    const set = new Set(itemIds);
    const cart = await this.findByBuyerId(buyerId);
    if (!cart) return;
    const list = this.items.get(cart.cartId) ?? [];
    this.items.set(cart.cartId, list.filter(i => !set.has(i.cartItemId)));
  }
}

class MockCatalogPort implements ICatalogPort {
  public variants: Map<UUID, VariantPriceAndStockDTO> = new Map();

  async getVariantPriceAndStock(variantId: UUID): Promise<VariantPriceAndStockDTO> {
    const v = this.variants.get(variantId);
    if (!v) throw new Error('Variant not found in catalog');
    return v;
  }

  async lockVariant(_variantId: UUID, _quantity: number): Promise<LockVariantResultDTO> {
    throw new Error('Not implemented for unit tests');
  }

  async checkShopActive(_shopId: UUID): Promise<boolean> {
    return true;
  }
}

class MockAddressRepository implements IAddressRepository {
  public addresses: Map<UUID, Address> = new Map();

  async findById(addressId: UUID): Promise<Address | null> {
    return this.addresses.get(addressId) ?? null;
  }

  async findByUserId(userId: UUID): Promise<Address[]> {
    return Array.from(this.addresses.values()).filter(a => a.userId === userId);
  }

  async create(address: Address): Promise<Address> {
    this.addresses.set(address.addressId, address);
    return address;
  }

  async update(address: Address): Promise<Address> {
    this.addresses.set(address.addressId, address);
    return address;
  }

  async delete(addressId: UUID): Promise<void> {
    this.addresses.delete(addressId);
  }

  async setDefault(userId: UUID, addressId: UUID): Promise<void> {
    for (const a of this.addresses.values()) {
      if (a.userId === userId) {
        a.isDefault = a.addressId === addressId;
      }
    }
  }
}

class MockReviewRepository implements IReviewRepository {
  public reviews: Map<UUID, Review> = new Map();

  async findById(reviewId: UUID): Promise<Review | null> {
    return this.reviews.get(reviewId) ?? null;
  }

  async findByOrderItemId(orderItemId: UUID): Promise<Review | null> {
    for (const r of this.reviews.values()) {
      if (r.orderItemId === orderItemId) return r;
    }
    return null;
  }

  async findByProductId(productId: UUID): Promise<Review[]> {
    return Array.from(this.reviews.values()).filter(r => r.productId === productId);
  }

  async create(review: Review): Promise<Review> {
    this.reviews.set(review.reviewId, review);
    return review;
  }
}

class MockOrderQueryPort implements IOrderQueryPort {
  public items: Map<string, ReviewOrderItemDTO> = new Map();

  async getOrderItemForReview(orderItemId: UUID, buyerId: UUID): Promise<ReviewOrderItemDTO | null> {
    const key = `${orderItemId}_${buyerId}`;
    return this.items.get(key) ?? null;
  }

  async getOrderSummary(_orderId: UUID): Promise<OrderSummaryDTO | null> {
    return null;
  }
}

class MockVoucherRepository implements IVoucherRepository {
  public vouchers: Map<UUID, Voucher> = new Map();

  async findById(voucherId: UUID): Promise<Voucher | null> {
    return this.vouchers.get(voucherId) ?? null;
  }

  async findByCode(code: string): Promise<Voucher | null> {
    for (const v of this.vouchers.values()) {
      if (v.code.toUpperCase() === code.toUpperCase()) return v;
    }
    return null;
  }

  async listActive(): Promise<Voucher[]> {
    return Array.from(this.vouchers.values());
  }

  async create(voucher: Voucher): Promise<Voucher> {
    this.vouchers.set(voucher.voucherId, voucher);
    return voucher;
  }

  async decrementQuantity(voucherId: UUID): Promise<boolean> {
    const v = this.vouchers.get(voucherId);
    if (!v || v.quantity <= 0) return false;
    v.quantity--;
    return true;
  }

  async incrementQuantity(voucherId: UUID): Promise<boolean> {
    const v = this.vouchers.get(voucherId);
    if (!v) return false;
    v.quantity++;
    return true;
  }

  async recordUsage(usage: VoucherUsage): Promise<VoucherUsage> {
    return usage;
  }
}

// ===================== TESTS =====================

describe('Buyer Domain Negative & Edge-Case Hardening (T3 Quality Gate)', () => {
  // Chuẩn hóa UUID hex 0-9, a-f
  const buyerId1 = 'bbbbbbbb-1111-4111-8111-111111111111';
  const buyerId2 = 'bbbbbbbb-2222-4222-8222-222222222222';
  const variantId1 = 'daaaaaaa-1111-4111-8111-111111111111';
  const productId1 = 'caaaaaaa-1111-4111-8111-111111111111';
  const orderItemId1 = 'baaaaaaa-1111-4111-8111-111111111111';

  describe('1. Cart Negative & Boundary Edge-Cases', () => {
    let cartRepo: MockCartRepository;
    let catalogPort: MockCatalogPort;
    let cartService: CartService;

    beforeEach(() => {
      cartRepo = new MockCartRepository();
      catalogPort = new MockCatalogPort();
      cartService = new CartService(cartRepo, catalogPort);

      catalogPort.variants.set(variantId1, {
        variantId: variantId1,
        productId: productId1,
        variantName: 'Test Variant',
        variantValue: 'Standard',
        price: '100000.00',
        stockQuantity: 10,
        status: 'ACTIVE',
      });
    });

    it('rejects addItem với quantity = 0 (dưới biên tối thiểu 1)', async () => {
      await assert.rejects(
        () => cartService.addItem(buyerId1, { variantId: variantId1, quantity: 0 }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('rejects addItem với quantity < 0 (số âm)', async () => {
      await assert.rejects(
        () => cartService.addItem(buyerId1, { variantId: variantId1, quantity: -3 }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('rejects addItem với quantity là số thập phân (không phải integer)', async () => {
      await assert.rejects(
        () => cartService.addItem(buyerId1, { variantId: variantId1, quantity: 2.5 }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('rejects addItem khi số lượng vượt tồn kho hiện có (INVENTORY_INSUFFICIENT 409)', async () => {
      await assert.rejects(
        () => cartService.addItem(buyerId1, { variantId: variantId1, quantity: 15 }),
        (err: unknown) => err instanceof InventoryInsufficientError && err.code === 'INVENTORY_INSUFFICIENT'
      );
    });

    it('rejects addItem khi variant không tồn tại trong Catalog', async () => {
      const nonExistentVariant = '99999999-9999-4999-8999-999999999999';
      await assert.rejects(
        () => cartService.addItem(buyerId1, { variantId: nonExistentVariant, quantity: 1 }),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it('rejects addItem khi variant có status = INACTIVE', async () => {
      catalogPort.variants.set(variantId1, {
        variantId: variantId1,
        productId: productId1,
        variantName: 'Test Variant Inactive',
        variantValue: 'Standard',
        price: '100000.00',
        stockQuantity: 10,
        status: 'INACTIVE',
      });

      await assert.rejects(
        () => cartService.addItem(buyerId1, { variantId: variantId1, quantity: 1 }),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it('rejects updateItem khi cart item không tồn tại trong giỏ của caller (404 RESOURCE_NOT_FOUND)', async () => {
      await cartService.addItem(buyerId1, { variantId: variantId1, quantity: 2 });
      const nonExistentItemId = '99999999-9999-4999-8999-999999999999';

      await assert.rejects(
        () => cartService.updateItem(buyerId1, nonExistentItemId, { quantity: 3 }),
        (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
      );
    });
  });

  describe('2. Review Negative & Boundary Edge-Cases [QD14, QD15, RB-MG08, RB-LB09]', () => {
    let reviewRepo: MockReviewRepository;
    let orderQueryPort: MockOrderQueryPort;
    let reviewService: ReviewService;

    beforeEach(() => {
      reviewRepo = new MockReviewRepository();
      orderQueryPort = new MockOrderQueryPort();
      reviewService = new ReviewService(reviewRepo, orderQueryPort);

      // Mặc định order item hợp lệ: COMPLETED, buyerId1
      orderQueryPort.items.set(`${orderItemId1}_${buyerId1}`, {
        orderItemId: orderItemId1,
        orderId: '12345678-1234-4234-8234-123456789012',
        productId: productId1,
        buyerId: buyerId1,
        orderStatus: 'COMPLETED',
      });
    });

    it('[QD14] rejects review khi order status chưa COMPLETED (ví dụ: SHIPPING)', async () => {
      orderQueryPort.items.set(`${orderItemId1}_${buyerId1}`, {
        orderItemId: orderItemId1,
        orderId: '12345678-1234-4234-8234-123456789012',
        productId: productId1,
        buyerId: buyerId1,
        orderStatus: 'SHIPPING',
      });

      await assert.rejects(
        () => reviewService.createReview(buyerId1, orderItemId1, productId1, { rating: 5, content: 'Tốt' }),
        (err: unknown) => err instanceof ReviewNotEligibleError && err.code === 'REVIEW_NOT_ELIGIBLE'
      );
    });

    it('[QD14] rejects review khi caller không sở hữu order item', async () => {
      // buyerId2 không có trong mock context
      await assert.rejects(
        () => reviewService.createReview(buyerId2, orderItemId1, productId1, { rating: 5, content: 'Tốt' }),
        (err: unknown) => err instanceof ReviewNotEligibleError && err.code === 'REVIEW_NOT_ELIGIBLE'
      );
    });

    it('[QD15, RB-MG08] rejects review khi rating = 0 (dưới biên 1)', async () => {
      await assert.rejects(
        () => reviewService.createReview(buyerId1, orderItemId1, productId1, { rating: 0, content: 'Tốt' }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[QD15, RB-MG08] rejects review khi rating = 6 (vượt biên 5)', async () => {
      await assert.rejects(
        () => reviewService.createReview(buyerId1, orderItemId1, productId1, { rating: 6, content: 'Tốt' }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[RB-LQH05] rejects review khi productId không khớp với productId của order item', async () => {
      const wrongProductId = '99999999-9999-4999-8999-999999999999';
      await assert.rejects(
        () => reviewService.createReview(buyerId1, orderItemId1, wrongProductId, { rating: 5, content: 'Tốt' }),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it('[RB-LB09] rejects review khi order item đã được đánh giá trước đó (duplicate review)', async () => {
      // Tạo review lần 1
      await reviewService.createReview(buyerId1, orderItemId1, productId1, { rating: 5, content: 'Lần 1' });

      // Cố gắng tạo lần 2 trên cùng orderItemId1
      await assert.rejects(
        () => reviewService.createReview(buyerId1, orderItemId1, productId1, { rating: 4, content: 'Lần 2' }),
        (err: unknown) => err instanceof ReviewAlreadyExistsError && err.code === 'REVIEW_ALREADY_EXISTS'
      );
    });
  });

  describe('3. Address Negative & Ownership Edge-Cases [RB-LB05, auth-rbac-rls §3]', () => {
    let addressRepo: MockAddressRepository;
    let addressService: AddressService;

    const addrId1 = 'aaaaaaaa-1111-4111-8111-111111111111';

    beforeEach(async () => {
      addressRepo = new MockAddressRepository();
      addressService = new AddressService(addressRepo);

      await addressRepo.create({
        addressId: addrId1,
        userId: buyerId1,
        recipientName: 'Nguyễn Văn A',
        phone: '0901234567',
        province: 'Hà Nội',
        district: 'Hoàn Kiếm',
        ward: 'Hàng Đào',
        detailAddress: '12 Hàng Đào',
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it('[auth-rbac-rls §3] rejects getAddressById khi địa chỉ thuộc người dùng khác (404 RESOURCE_NOT_FOUND)', async () => {
      await assert.rejects(
        () => addressService.getAddressById(buyerId2, addrId1),
        (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
      );
    });

    it('[auth-rbac-rls §3] rejects updateAddress khi địa chỉ thuộc người dùng khác (404 RESOURCE_NOT_FOUND)', async () => {
      await assert.rejects(
        () => addressService.updateAddress(buyerId2, addrId1, { recipientName: 'Hacker' }),
        (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
      );
    });

    it('[auth-rbac-rls §3] rejects deleteAddress khi địa chỉ thuộc người dùng khác (404 RESOURCE_NOT_FOUND)', async () => {
      await assert.rejects(
        () => addressService.deleteAddress(buyerId2, addrId1),
        (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
      );
    });

    it('[auth-rbac-rls §3] rejects setDefault khi địa chỉ thuộc người dùng khác (404 RESOURCE_NOT_FOUND)', async () => {
      await assert.rejects(
        () => addressService.setDefault(buyerId2, addrId1),
        (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
      );
    });

    it('[RB-LB05] rejects createAddress khi người dùng đã có đủ 10 địa chỉ', async () => {
      // Thêm 9 địa chỉ nữa để đủ 10
      for (let i = 2; i <= 10; i++) {
        await addressRepo.create({
          addressId: `aaaa0000-0000-4000-8000-${String(i).padStart(12, '0')}`,
          userId: buyerId1,
          recipientName: `Người nhận ${i}`,
          phone: '0901234567',
          province: 'Hà Nội',
          district: 'Cầu Giấy',
          ward: 'Dịch Vọng',
          detailAddress: `${i} Cầu Giấy`,
          isDefault: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Thử tạo địa chỉ thứ 11
      await assert.rejects(
        () => addressService.createAddress(buyerId1, {
          recipientName: 'Thứ 11',
          phone: '0901234567',
          province: 'Hà Nội',
          district: 'Cầu Giấy',
          ward: 'Dịch Vọng',
          detailAddress: '11 Cầu Giấy',
          isDefault: false,
        }),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it('[api-conventions.md §2] rejects createAddress khi chứa unknown field', async () => {
      await assert.rejects(
        () => addressService.createAddress(buyerId1, {
          recipientName: 'Lỗi Unknown Field',
          phone: '0901234567',
          province: 'Hà Nội',
          district: 'Cầu Giấy',
          ward: 'Dịch Vọng',
          detailAddress: '11 Cầu Giấy',
          isDefault: false,
          maliciousKey: 'attack',
        }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('rejects createAddress khi thiếu trường bắt buộc (ví dụ detailAddress trống)', async () => {
      await assert.rejects(
        () => addressService.createAddress(buyerId1, {
          recipientName: 'Thiếu Địa Chỉ Chi Tiết',
          phone: '0901234567',
          province: 'Hà Nội',
          district: 'Cầu Giấy',
          ward: 'Dịch Vọng',
          detailAddress: '   ',
          isDefault: false,
        }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });
  });

  describe('4. Voucher Negative & Boundary Edge-Cases [QD09, RB-LTT03, RB-LTT05]', () => {
    let voucherRepo: MockVoucherRepository;
    let voucherService: VoucherService;

    const voucherId1 = '11110001-0001-4001-8001-000000000001';
    const shopId1 = '11111111-1111-4111-8111-111111111111';

    beforeEach(async () => {
      voucherRepo = new MockVoucherRepository();
      voucherService = new VoucherService(voucherRepo);

      await voucherRepo.create({
        voucherId: voucherId1,
        code: 'SALE50K',
        voucherName: 'Giảm 50k cho đơn từ 200k',
        scope: 'PLATFORM',
        shopId: null,
        discountType: 'FIXED',
        discountValue: '50000.00',
        maxDiscount: null,
        minOrderValue: '200000.00',
        quantity: 5,
        startAt: '2026-09-01T00:00:00.000Z',
        endAt: '2026-09-30T23:59:59.000Z',
        status: 'ACTIVE',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      });
    });

    it('rejects previewVoucher khi mã không tồn tại (404 RESOURCE_NOT_FOUND)', async () => {
      await assert.rejects(
        () => voucherService.previewVoucher({
          buyerId: buyerId1,
          code: 'KHONG_TON_TAI',
          orderSubtotal: '300000.00',
          now: '2026-09-15T12:00:00.000Z',
        }),
        (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
      );
    });

    it('[QD09] rejects previewVoucher khi subtotal < minOrderValue', async () => {
      await assert.rejects(
        () => voucherService.previewVoucher({
          buyerId: buyerId1,
          code: 'SALE50K',
          orderSubtotal: '150000.00', // < 200,000đ
          now: '2026-09-15T12:00:00.000Z',
        }),
        (err: unknown) => err instanceof VoucherNotApplicableError && err.code === 'VOUCHER_NOT_APPLICABLE'
      );
    });

    it('[QD09, RB-LTT03] rejects previewVoucher khi chưa tới thời gian kích hoạt (now < startAt)', async () => {
      await assert.rejects(
        () => voucherService.previewVoucher({
          buyerId: buyerId1,
          code: 'SALE50K',
          orderSubtotal: '250000.00',
          now: '2026-08-30T00:00:00.000Z', // Trước startAt
        }),
        (err: unknown) => err instanceof VoucherNotApplicableError && err.code === 'VOUCHER_NOT_APPLICABLE'
      );
    });

    it('[QD09, RB-LTT03] rejects previewVoucher khi đã hết hạn (now > endAt)', async () => {
      await assert.rejects(
        () => voucherService.previewVoucher({
          buyerId: buyerId1,
          code: 'SALE50K',
          orderSubtotal: '250000.00',
          now: '2026-10-01T00:00:00.000Z', // Sau endAt
        }),
        (err: unknown) => err instanceof VoucherNotApplicableError && err.code === 'VOUCHER_NOT_APPLICABLE'
      );
    });

    it('[QD09] rejects previewVoucher khi số lượng đã hết (quantity = 0)', async () => {
      const v = await voucherRepo.findById(voucherId1);
      if (v) v.quantity = 0;

      await assert.rejects(
        () => voucherService.previewVoucher({
          buyerId: buyerId1,
          code: 'SALE50K',
          orderSubtotal: '250000.00',
          now: '2026-09-15T12:00:00.000Z',
        }),
        (err: unknown) => err instanceof VoucherNotApplicableError && err.code === 'VOUCHER_NOT_APPLICABLE'
      );
    });

    it('[RB-LTT05] rejects previewVoucher khi voucher là SHOP scope nhưng áp dụng sai shop', async () => {
      const shopVoucherId = '11110002-0002-4002-8002-000000000002';
      await voucherRepo.create({
        voucherId: shopVoucherId,
        code: 'SHOPONLY',
        voucherName: 'Chỉ áp dụng shop A',
        scope: 'SHOP',
        shopId: shopId1,
        discountType: 'FIXED',
        discountValue: '20000.00',
        maxDiscount: null,
        minOrderValue: '100000.00',
        quantity: 5,
        startAt: '2026-09-01T00:00:00.000Z',
        endAt: '2026-09-30T23:59:59.000Z',
        status: 'ACTIVE',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      });

      const differentShopId = '99999999-9999-4999-8999-999999999999';

      await assert.rejects(
        () => voucherService.previewVoucher({
          buyerId: buyerId1,
          code: 'SHOPONLY',
          orderSubtotal: '150000.00',
          shopId: differentShopId,
          now: '2026-09-15T12:00:00.000Z',
        }),
        (err: unknown) => err instanceof VoucherNotApplicableError && err.code === 'VOUCHER_NOT_APPLICABLE'
      );
    });
  });
});
