import type { UUID, DecimalString, VoucherUsage } from '../domain/types';
import type { IVoucherPort, EvaluateVoucherContext, VoucherEvaluationResult } from '../ports/voucher.port';
import type { IVoucherRepository } from '../domain/repositories';
import { evaluateVoucher } from '../domain/voucher';
import { VoucherNotApplicableError } from '../domain/errors';

export class VoucherPortService implements IVoucherPort {
  private voucherRepo: IVoucherRepository;

  constructor(voucherRepo: IVoucherRepository) {
    this.voucherRepo = voucherRepo;
  }

  async evaluateVoucher(context: EvaluateVoucherContext): Promise<VoucherEvaluationResult> {
    const voucher = await this.voucherRepo.findByCode(context.code.trim().toUpperCase());
    if (!voucher) {
      return {
        isValid: false,
        errorCode: 'VOUCHER_NOT_APPLICABLE',
        errorMessage: 'Mã voucher không tồn tại trên hệ thống.',
      };
    }

    try {
      const evaluation = evaluateVoucher(voucher, {
        buyerId: context.buyerId,
        shopId: context.shopId,
        orderSubtotal: context.orderSubtotal,
        now: context.now,
      });

      return {
        isValid: true,
        voucherId: evaluation.voucherId,
        discountAmount: evaluation.discountAmount,
      };
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      return {
        isValid: false,
        errorCode: e.code || 'VOUCHER_NOT_APPLICABLE',
        errorMessage: e.message || 'Không thể áp dụng voucher.',
      };
    }
  }

  async consumeVoucher(params: {
    voucherId: UUID;
    orderId: UUID;
    buyerId: UUID;
    discountAmount: DecimalString;
  }): Promise<VoucherUsage> {
    // 1. Giảm số lượt phát hành
    const decremented = await this.voucherRepo.decrementQuantity(params.voucherId);
    if (!decremented) {
      throw new VoucherNotApplicableError('Voucher đã hết lượt phát hành không thể áp dụng.');
    }

    try {
      // 2. Ghi nhận VoucherUsage
      const usage: VoucherUsage = {
        usageId: crypto.randomUUID(),
        voucherId: params.voucherId,
        orderId: params.orderId,
        buyerId: params.buyerId,
        discountAmount: params.discountAmount,
        usedAt: new Date().toISOString(),
      };

      return await this.voucherRepo.recordUsage(usage);
    } catch (error) {
      // Compensating rollback: Hoàn lại lượt phát hành nếu ghi nhận usage thất bại
      if (typeof this.voucherRepo.incrementQuantity === 'function') {
        await this.voucherRepo.incrementQuantity(params.voucherId);
      }
      throw error;
    }
  }
}
