import { UUID, DecimalString, VoucherUsage } from '../domain/types.ts';

export interface EvaluateVoucherContext {
  code: string;
  buyerId: UUID;
  orderSubtotal: DecimalString;
  shopId: UUID;
  now?: string; // ISO string, default to current server time
}

export interface VoucherEvaluationSuccess {
  isValid: true;
  voucherId: UUID;
  discountAmount: DecimalString;
}

export interface VoucherEvaluationFailure {
  isValid: false;
  errorCode: string;
  errorMessage: string;
}

export type VoucherEvaluationResult = VoucherEvaluationSuccess | VoucherEvaluationFailure;

export interface IVoucherPort {
  /**
   * Kiểm tra tính hợp lệ của voucher và tính discountAmount
   * Đầu vào cho QD10 và RB-LQH03 mà Người 5 kiểm tra ở Order
   */
  evaluateVoucher(context: EvaluateVoucherContext): Promise<VoucherEvaluationResult>;

  /**
   * Giảm số lượt phát hành và ghi nhận VoucherUsage trong transaction checkout
   * Bước 9 của transaction tạo Order (order-workflow-transactions.md)
   */
  consumeVoucher(params: {
    voucherId: UUID;
    orderId: UUID;
    buyerId: UUID;
    discountAmount: DecimalString;
  }): Promise<VoucherUsage>;
}
