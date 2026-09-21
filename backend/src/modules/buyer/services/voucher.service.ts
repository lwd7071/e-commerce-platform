import type { IVoucherRepository } from '../domain/repositories';
import type { Voucher, VoucherScope, UUID, DecimalString } from '../domain/types';
import { ResourceNotFoundError } from '../domain/errors';
import { evaluateVoucher } from '../domain/voucher';

export interface PreviewVoucherParams {
  buyerId: UUID;
  code: string;
  orderSubtotal: DecimalString;
  shopId?: UUID;
  now?: string;
}

export interface VoucherPreviewResult {
  voucher: Voucher;
  discountAmount: DecimalString;
}

/**
 * Service quản lý và tra cứu Voucher cho người mua.
 * Áp dụng:
 * - [evaluateVoucher]: Đánh giá tính hợp lệ của voucher và tính số tiền giảm (QD09, RB-LTT05, RB-MG09).
 * - [auth-rbac-rls.md §3]: Trả về 404 RESOURCE_NOT_FOUND khi mã voucher không tồn tại.
 */
export class VoucherService {
  constructor(private readonly voucherRepo: IVoucherRepository) {}

  async listActiveVouchers(
    scope?: VoucherScope,
    shopId?: UUID,
    nowStr?: string
  ): Promise<Voucher[]> {
    const list = await this.voucherRepo.listActive(scope, shopId);
    const currentTime = nowStr ? new Date(nowStr).getTime() : Date.now();

    return list.filter(v => {
      if (v.status !== 'ACTIVE') return false;
      const start = new Date(v.startAt).getTime();
      const end = new Date(v.endAt).getTime();
      if (isNaN(start) || isNaN(end)) return false;
      return currentTime >= start && currentTime <= end;
    });
  }

  async getVoucherByCode(code: string): Promise<Voucher> {
    const voucher = await this.voucherRepo.findByCode(code.trim().toUpperCase());
    if (!voucher) {
      throw new ResourceNotFoundError('Voucher not found', { code });
    }
    return voucher;
  }

  async previewVoucher(params: PreviewVoucherParams): Promise<VoucherPreviewResult> {
    const voucher = await this.getVoucherByCode(params.code);

    const evaluation = evaluateVoucher(voucher, {
      buyerId: params.buyerId,
      shopId: params.shopId ?? voucher.shopId ?? '00000000-0000-4000-8000-000000000000',
      orderSubtotal: params.orderSubtotal,
      now: params.now,
    });

    return {
      voucher,
      discountAmount: evaluation.discountAmount,
    };
  }
}
