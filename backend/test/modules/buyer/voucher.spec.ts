import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateVoucherTime, validateDiscountRange, calculateDiscountAmount, evaluateVoucher } from '../../../src/modules/buyer/domain/voucher.ts';
import { ValidationError, VoucherNotApplicableError } from '../../../src/modules/buyer/domain/errors.ts';
import type { Voucher } from '../../../src/modules/buyer/domain/types.ts';
import { mockPlatformVoucher, mockShopVoucher, mockBuyerId, mockShopId, mockOtherShopId } from './fixtures.ts';

describe('Voucher Domain Tests (QD09, RB-LTT03, RB-LTT04, RB-LTT05, RB-MG09)', () => {

  describe('Slice 1: Kiểm tra thời gian hiệu lực (RB-LTT03, QD09)', () => {
    it('[RB-LTT03] startAt = "2026-01-10", endAt = "2026-01-01" (đảo ngược) -> reject VALIDATION_FAILED', () => {
      assert.throws(
        () => validateVoucherTime('2026-01-10T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        (err: any) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[RB-LTT03] startAt = endAt = "2026-01-10" (bằng nhau, biên) -> reject VALIDATION_FAILED', () => {
      assert.throws(
        () => validateVoucherTime('2026-01-10T00:00:00.000Z', '2026-01-10T00:00:00.000Z'),
        (err: any) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[QD09] now < startAt (chưa tới hạn) -> reject VOUCHER_NOT_APPLICABLE', () => {
      assert.throws(
        () => validateVoucherTime('2026-09-10T00:00:00.000Z', '2026-09-20T00:00:00.000Z', '2026-09-05T00:00:00.000Z'),
        (err: any) => err instanceof VoucherNotApplicableError && err.code === 'VOUCHER_NOT_APPLICABLE'
      );
    });

    it('[QD09] now > endAt (hết hạn) -> reject VOUCHER_NOT_APPLICABLE', () => {
      assert.throws(
        () => validateVoucherTime('2026-09-10T00:00:00.000Z', '2026-09-20T00:00:00.000Z', '2026-09-25T00:00:00.000Z'),
        (err: any) => err instanceof VoucherNotApplicableError && err.code === 'VOUCHER_NOT_APPLICABLE'
      );
    });

    it('[RB-LTT03, QD09] startAt < now < endAt -> pass', () => {
      assert.doesNotThrow(() => {
        validateVoucherTime('2026-09-01T00:00:00.000Z', '2026-09-30T00:00:00.000Z', '2026-09-15T00:00:00.000Z');
      });
    });
  });

  describe('Slice 2: Kiểm tra loại giảm giá & miền giá trị (RB-LTT04, RB-MG09)', () => {
    it('[RB-LTT04] type=PERCENT, value=0 (biên dưới) -> reject VALIDATION_FAILED', () => {
      assert.throws(
        () => validateDiscountRange('PERCENT', '0'),
        (err: any) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[RB-LTT04] type=PERCENT, value=100 (biên trên hợp lệ) -> pass', () => {
      assert.doesNotThrow(() => validateDiscountRange('PERCENT', '100'));
    });

    it('[RB-LTT04] type=PERCENT, value=101 (> 100) -> reject VALIDATION_FAILED', () => {
      assert.throws(
        () => validateDiscountRange('PERCENT', '101'),
        (err: any) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[RB-MG09] type=FIXED, value=0 -> reject VALIDATION_FAILED (DiscountValue > 0)', () => {
      assert.throws(
        () => validateDiscountRange('FIXED', '0'),
        (err: any) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[RB-MG09] type=FIXED, value=-5000 -> reject VALIDATION_FAILED', () => {
      assert.throws(
        () => validateDiscountRange('FIXED', '-5000'),
        (err: any) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[RB-MG09] type=FIXED, value=50000 -> pass', () => {
      assert.doesNotThrow(() => validateDiscountRange('FIXED', '50000.00'));
    });
  });

  describe('Slice 3: Tính toán tiền giảm (RB-MG09 cap theo MaxDiscount & Subtotal)', () => {
    it('[RB-MG09] type=PERCENT, value=20, subtotal=100000, maxDiscount=15000 -> discountAmount=15000.00 (cap áp dụng)', () => {
      const discount = calculateDiscountAmount('PERCENT', '20.00', '15000.00', '100000.00');
      assert.equal(discount, '15000.00');
    });

    it('[RB-MG09] type=PERCENT, value=20, subtotal=100000, maxDiscount=null -> discountAmount=20000.00', () => {
      const discount = calculateDiscountAmount('PERCENT', '20.00', null, '100000.00');
      assert.equal(discount, '20000.00');
    });

    it('[RB-MG09, Technical Decision] type=FIXED, value=50000, subtotal=30000 -> discountAmount=30000.00 (không vượt subtotal)', () => {
      const discount = calculateDiscountAmount('FIXED', '50000.00', null, '30000.00');
      assert.equal(discount, '30000.00');
    });
  });

  describe('Slice 4: Scope, số lượt & Giá trị đơn tối thiểu (QD09, RB-LTT05)', () => {
    it('[RB-LTT05] scope=SHOP nhưng shopId=null -> reject VALIDATION_FAILED', () => {
      const invalidVoucher: Voucher = { ...mockShopVoucher, shopId: null };
      assert.throws(
        () => evaluateVoucher(invalidVoucher, { buyerId: mockBuyerId, shopId: mockShopId, orderSubtotal: '200000.00', now: '2026-09-15T10:00:00.000Z' }),
        (err: any) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[RB-LTT05] scope=PLATFORM nhưng shopId="uuid-x" -> reject VALIDATION_FAILED', () => {
      const invalidVoucher: Voucher = { ...mockPlatformVoucher, shopId: mockShopId };
      assert.throws(
        () => evaluateVoucher(invalidVoucher, { buyerId: mockBuyerId, shopId: mockShopId, orderSubtotal: '200000.00', now: '2026-09-15T10:00:00.000Z' }),
        (err: any) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[QD09] scope=SHOP, shopId="A", context.shopId="B" (sai shop) -> reject VOUCHER_NOT_APPLICABLE', () => {
      assert.throws(
        () => evaluateVoucher(mockShopVoucher, { buyerId: mockBuyerId, shopId: mockOtherShopId, orderSubtotal: '200000.00', now: '2026-09-15T10:00:00.000Z' }),
        (err: any) => err instanceof VoucherNotApplicableError && err.code === 'VOUCHER_NOT_APPLICABLE'
      );
    });

    it('[QD09] quantity = 0 (hết lượt phát hành) -> reject VOUCHER_NOT_APPLICABLE', () => {
      const outOfStockVoucher: Voucher = { ...mockPlatformVoucher, quantity: 0 };
      assert.throws(
        () => evaluateVoucher(outOfStockVoucher, { buyerId: mockBuyerId, shopId: mockShopId, orderSubtotal: '200000.00', now: '2026-09-15T10:00:00.000Z' }),
        (err: any) => err instanceof VoucherNotApplicableError && err.code === 'VOUCHER_NOT_APPLICABLE'
      );
    });

    it('[QD09] subtotal=50000 < minOrderValue=100000 -> reject VOUCHER_NOT_APPLICABLE', () => {
      assert.throws(
        () => evaluateVoucher(mockPlatformVoucher, { buyerId: mockBuyerId, shopId: mockShopId, orderSubtotal: '50000.00', now: '2026-09-15T10:00:00.000Z' }),
        (err: any) => err instanceof VoucherNotApplicableError && err.code === 'VOUCHER_NOT_APPLICABLE'
      );
    });

    it('[QD09] subtotal=100000, minOrderValue=100000 (biên bằng nhau) -> pass & trả discountAmount chính xác', () => {
      const result = evaluateVoucher(mockPlatformVoucher, { buyerId: mockBuyerId, shopId: mockShopId, orderSubtotal: '100000.00', now: '2026-09-15T10:00:00.000Z' });
      assert.equal(result.discountAmount, '20000.00');
    });
  });

});
