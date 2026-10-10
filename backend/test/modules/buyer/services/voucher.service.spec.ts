import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { VoucherService } from '../../../../src/modules/buyer/services/voucher.service';
import {
  ResourceNotFoundError,
  VoucherNotApplicableError,
} from '../../../../src/modules/buyer/domain/errors';
import type { IVoucherRepository } from '../../../../src/modules/buyer/domain/repositories';
import type { Voucher, VoucherUsage, UUID } from '../../../../src/modules/buyer/domain/types';
import {
  mockBuyerId,
  mockShopId,
  mockOtherShopId,
  mockPlatformVoucher,
  mockShopVoucher,
} from '../fixtures';

class MockVoucherRepository implements IVoucherRepository {
  public vouchers: Map<UUID, Voucher> = new Map();
  public usages: Map<UUID, VoucherUsage> = new Map();

  async findById(voucherId: UUID): Promise<Voucher | null> {
    return this.vouchers.get(voucherId) ?? null;
  }

  async findByCode(code: string): Promise<Voucher | null> {
    const normalized = code.trim().toUpperCase();
    for (const v of this.vouchers.values()) {
      if (v.code.trim().toUpperCase() === normalized) return v;
    }
    return null;
  }

  async listActive(scope?: 'PLATFORM' | 'SHOP', shopId?: UUID): Promise<Voucher[]> {
    return Array.from(this.vouchers.values()).filter(v => {
      if (v.status !== 'ACTIVE') return false;
      if (scope && v.scope !== scope) return false;
      if (shopId && v.shopId !== shopId) return false;
      return true;
    });
  }

  async create(voucher: Voucher): Promise<Voucher> {
    this.vouchers.set(voucher.voucherId, voucher);
    return voucher;
  }

  async decrementQuantity(voucherId: UUID): Promise<boolean> {
    const v = this.vouchers.get(voucherId);
    if (!v || v.quantity <= 0) return false;
    v.quantity -= 1;
    return true;
  }

  async recordUsage(usage: VoucherUsage): Promise<VoucherUsage> {
    this.usages.set(usage.usageId, usage);
    return usage;
  }
}

describe('VoucherService Tests (TDD - Active Listing & Preview)', () => {
  let voucherRepo: MockVoucherRepository;
  let voucherService: VoucherService;

  beforeEach(async () => {
    voucherRepo = new MockVoucherRepository();
    voucherService = new VoucherService(voucherRepo);

    await voucherRepo.create(mockPlatformVoucher);
    await voucherRepo.create(mockShopVoucher);
  });

  describe('listActiveVouchers', () => {
    it('liệt kê tất cả voucher ACTIVE trong thời gian hiệu lực', async () => {
      const list = await voucherService.listActiveVouchers();
      assert.equal(list.length, 2);
    });

    it('lọc voucher theo scope PLATFORM', async () => {
      const list = await voucherService.listActiveVouchers('PLATFORM');
      assert.equal(list.length, 1);
      assert.equal(list[0].scope, 'PLATFORM');
    });

    it('lọc voucher theo scope SHOP và shopId cụ thể', async () => {
      const list = await voucherService.listActiveVouchers('SHOP', mockShopId);
      assert.equal(list.length, 1);
      assert.equal(list[0].shopId, mockShopId);

      const otherShopList = await voucherService.listActiveVouchers('SHOP', mockOtherShopId);
      assert.equal(otherShopList.length, 0);
    });

    it('loại trừ voucher đã hết hạn hoặc chưa tới ngày bắt đầu', async () => {
      // Voucher hết hạn
      await voucherRepo.create({
        ...mockPlatformVoucher,
        voucherId: 'vvvv3333-3333-4333-8333-333333333333',
        code: 'EXPIRED10',
        startAt: '2026-08-01T00:00:00.000Z',
        endAt: '2026-08-31T23:59:59.000Z',
      });

      // Kiểm tra tại thời điểm 2026-09-15
      const list = await voucherService.listActiveVouchers(undefined, undefined, '2026-09-15T10:00:00.000Z');
      assert.ok(!list.some(v => v.code === 'EXPIRED10'));
    });
  });

  describe('getVoucherByCode', () => {
    it('tìm voucher thành công theo mã code (không phân biệt hoa thường)', async () => {
      const v = await voucherService.getVoucherByCode('platform20');
      assert.equal(v.voucherId, mockPlatformVoucher.voucherId);
      assert.equal(v.code, 'PLATFORM20');
    });

    it('[auth-rbac-rls.md §3] ném 404 RESOURCE_NOT_FOUND khi mã voucher không tồn tại', async () => {
      await assert.rejects(
        async () => voucherService.getVoucherByCode('NONEXISTENT_CODE'),
        (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
      );
    });
  });

  describe('previewVoucher', () => {
    it('tính đúng số tiền giảm cho voucher PERCENT có áp dụng cap maxDiscount', async () => {
      // mockPlatformVoucher: 20%, maxDiscount: 50000, minOrder: 100000
      // Đơn 500.000đ -> 20% = 100.000đ > maxDiscount -> giảm 50.000đ
      const preview = await voucherService.previewVoucher({
        buyerId: mockBuyerId,
        code: 'PLATFORM20',
        orderSubtotal: '500000.00',
        now: '2026-09-15T12:00:00.000Z',
      });

      assert.equal(preview.voucher.voucherId, mockPlatformVoucher.voucherId);
      assert.equal(preview.discountAmount, '50000.00');
    });

    it('tính đúng số tiền giảm cho voucher SHOP FIXED', async () => {
      // mockShopVoucher: FIXED 30.000đ, minOrder 150.000đ cho mockShopId
      const preview = await voucherService.previewVoucher({
        buyerId: mockBuyerId,
        code: 'SHOPFIXED30',
        shopId: mockShopId,
        orderSubtotal: '200000.00',
        now: '2026-09-15T12:00:00.000Z',
      });

      assert.equal(preview.discountAmount, '30000.00');
    });

    it('ném VOUCHER_NOT_APPLICABLE khi đơn hàng chưa đạt minOrderValue', async () => {
      // mockPlatformVoucher minOrder: 100.000đ, đơn 50.000đ
      await assert.rejects(
        async () => voucherService.previewVoucher({
          buyerId: mockBuyerId,
          code: 'PLATFORM20',
          orderSubtotal: '50000.00',
          now: '2026-09-15T12:00:00.000Z',
        }),
        (err: unknown) => err instanceof VoucherNotApplicableError && err.code === 'VOUCHER_NOT_APPLICABLE'
      );
    });

    it('ném VOUCHER_NOT_APPLICABLE khi áp dụng voucher của shop khác', async () => {
      await assert.rejects(
        async () => voucherService.previewVoucher({
          buyerId: mockBuyerId,
          code: 'SHOPFIXED30',
          shopId: mockOtherShopId,
          orderSubtotal: '200000.00',
          now: '2026-09-15T12:00:00.000Z',
        }),
        (err: unknown) => err instanceof VoucherNotApplicableError && err.code === 'VOUCHER_NOT_APPLICABLE'
      );
    });

    it('[auth-rbac-rls.md §3] ném 404 RESOURCE_NOT_FOUND khi preview mã không tồn tại', async () => {
      await assert.rejects(
        async () => voucherService.previewVoucher({
          buyerId: mockBuyerId,
          code: 'UNKNOWN_CODE',
          orderSubtotal: '200000.00',
        }),
        (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
      );
    });
  });
});
