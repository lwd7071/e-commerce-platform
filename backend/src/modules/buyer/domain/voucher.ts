import { ValidationError, VoucherNotApplicableError } from './errors.ts';
import type { Voucher, UUID } from './types.ts';

/**
 * [RB-LTT03] start_at < end_at
 * [QD09] voucher chỉ áp dụng khi còn hiệu lực
 */
export function validateVoucherTime(startAtStr: string, endAtStr: string, nowStr?: string): void {
  const startAt = new Date(startAtStr).getTime();
  const endAt = new Date(endAtStr).getTime();

  if (isNaN(startAt) || isNaN(endAt)) {
    throw new ValidationError('Thời gian voucher không hợp lệ.');
  }

  // RB-LTT03: start_at < end_at
  if (startAt >= endAt) {
    throw new ValidationError('StartAt phải nhỏ hơn EndAt (RB-LTT03).');
  }

  // QD09: Kiểm tra thời gian áp dụng hiện tại nếu có nowStr
  if (nowStr !== undefined) {
    const now = new Date(nowStr).getTime();
    if (now < startAt) {
      throw new VoucherNotApplicableError('Voucher chưa tới thời gian áp dụng (QD09).');
    }
    if (now > endAt) {
      throw new VoucherNotApplicableError('Voucher đã hết hạn áp dụng (QD09).');
    }
  }
}

/**
 * [RB-LTT04] Nếu DiscountType = 'PERCENT' thì 0 < DiscountValue <= 100
 * [RB-MG09] DiscountValue > 0
 */
export function validateDiscountRange(discountType: 'PERCENT' | 'FIXED', discountValueStr: string): void {
  const value = parseFloat(discountValueStr);
  if (isNaN(value)) {
    throw new ValidationError('Giá trị giảm giá không hợp lệ.');
  }

  // RB-MG09: DiscountValue > 0
  if (value <= 0) {
    throw new ValidationError('Giá trị giảm giá phải lớn hơn 0 (RB-MG09).', { discountValue: discountValueStr });
  }

  // RB-LTT04: PERCENT trong (0, 100]
  if (discountType === 'PERCENT') {
    if (value > 100) {
      throw new ValidationError('Phần trăm giảm giá không được vượt quá 100% (RB-LTT04).', { discountValue: discountValueStr });
    }
  }
}

/**
 * [RB-MG09] Tính số tiền giảm giá và áp dụng cap theo MaxDiscount & Subtotal
 * Trả về DecimalString formatted "0.00"
 */
export function calculateDiscountAmount(
  discountType: 'PERCENT' | 'FIXED',
  discountValueStr: string,
  maxDiscountStr: string | null,
  subtotalStr: string
): string {
  const discountVal = parseFloat(discountValueStr);
  const subtotal = parseFloat(subtotalStr);

  let calculatedDiscount = 0;
  if (discountType === 'PERCENT') {
    calculatedDiscount = (subtotal * discountVal) / 100;
    if (maxDiscountStr !== null) {
      const maxDiscount = parseFloat(maxDiscountStr);
      if (!isNaN(maxDiscount) && calculatedDiscount > maxDiscount) {
        calculatedDiscount = maxDiscount;
      }
    }
  } else {
    // FIXED
    calculatedDiscount = discountVal;
  }

  // Không vượt quá subtotal
  if (calculatedDiscount > subtotal) {
    calculatedDiscount = subtotal;
  }

  // Đảm bảo không âm
  if (calculatedDiscount < 0) {
    calculatedDiscount = 0;
  }

  return calculatedDiscount.toFixed(2);
}

export interface EvaluateVoucherParams {
  buyerId: UUID;
  shopId: UUID;
  orderSubtotal: string;
  now?: string;
}

/**
 * [QD09, RB-LTT05, RB-MG09, RB-LTT03, RB-LTT04]
 * Đánh giá voucher toàn diện:
 * - RB-LTT05: PLATFORM -> ShopID IS NULL, SHOP -> ShopID IS NOT NULL
 * - QD09: Còn lượt (quantity > 0), còn hiệu lực, đúng shop nếu scope=SHOP, đạt minOrderValue
 */
export function evaluateVoucher(
  voucher: Voucher,
  context: EvaluateVoucherParams
): { isValid: true; voucherId: UUID; discountAmount: string } {
  // 1. RB-LTT05: Kiểm tra scope consistency
  if (voucher.scope === 'PLATFORM' && voucher.shopId !== null) {
    throw new ValidationError('Voucher cấp PLATFORM thì ShopID phải là NULL (RB-LTT05).');
  }
  if (voucher.scope === 'SHOP' && (voucher.shopId === null || voucher.shopId === '')) {
    throw new ValidationError('Voucher cấp SHOP thì ShopID không được để trống (RB-LTT05).');
  }

  // 2. Validate thời gian và discount range của voucher
  validateVoucherTime(voucher.startAt, voucher.endAt, context.now);
  validateDiscountRange(voucher.discountType, voucher.discountValue);

  // 3. QD09: Voucher phải còn lượt
  if (voucher.quantity <= 0) {
    throw new VoucherNotApplicableError('Voucher đã hết lượt sử dụng (QD09).');
  }

  // 4. QD09: Scope SHOP phải trùng shopId
  if (voucher.scope === 'SHOP' && voucher.shopId !== context.shopId) {
    throw new VoucherNotApplicableError('Voucher không áp dụng cho shop này (QD09).');
  }

  // 5. QD09: Giá trị đơn tối thiểu
  const subtotal = parseFloat(context.orderSubtotal);
  const minOrderValue = parseFloat(voucher.minOrderValue);
  if (subtotal < minOrderValue) {
    throw new VoucherNotApplicableError('Đơn hàng chưa đạt giá trị tối thiểu để áp dụng voucher (QD09).', {
      orderSubtotal: context.orderSubtotal,
      minOrderValue: voucher.minOrderValue,
    });
  }

  // 6. Tính discountAmount
  const discountAmount = calculateDiscountAmount(
    voucher.discountType,
    voucher.discountValue,
    voucher.maxDiscount,
    context.orderSubtotal
  );

  return {
    isValid: true,
    voucherId: voucher.voucherId,
    discountAmount,
  };
}
