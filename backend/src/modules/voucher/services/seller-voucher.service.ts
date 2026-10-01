import type { RequestContext } from '../../../platform/context/request-context.ts';
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from '../../../platform/errors/app-error.ts';
import type { ISellerVoucherRepository, SellerVoucher, SellerVoucherFields } from '../domain/seller-voucher.types.ts';

const decimal = /^\d+(?:\.\d{1,2})?$/;

export class SellerVoucherService {
  constructor(private readonly repository: ISellerVoucherRepository) {}

  async list(context: RequestContext): Promise<SellerVoucher[]> { return this.repository.list(this.shopId(context)); }

  async get(context: RequestContext, voucherId: string): Promise<SellerVoucher> {
    const result = await this.repository.find(this.shopId(context), voucherId);
    if (!result) throw new NotFoundError('Shop voucher not found');
    return result;
  }

  async create(context: RequestContext, input: Record<string, unknown>): Promise<SellerVoucher> {
    return this.repository.create(context, this.validate(input));
  }

  async update(context: RequestContext, voucherId: string, patch: Record<string, unknown>): Promise<SellerVoucher> {
    const current = await this.get(context, voucherId);
    if (await this.repository.hasUsage(current.shop_id, voucherId)) {
      throw new ConflictError('VOUCHER_ALREADY_USED', 'A voucher that has been used cannot have its conditions changed.');
    }
    const next = this.validate({ ...current, ...patch });
    const updated = await this.repository.updateIfUnused(context, voucherId, next);
    if (!updated) throw new ConflictError('VOUCHER_ALREADY_USED', 'A voucher that has been used cannot have its conditions changed.');
    return updated;
  }

  async setStatus(context: RequestContext, voucherId: string, status: unknown): Promise<SellerVoucher> {
    if (status !== 'ACTIVE' && status !== 'INACTIVE') throw new ValidationFailedError('Status must be ACTIVE or INACTIVE', { field: 'status' });
    const current = await this.get(context, voucherId);
    if (status === 'ACTIVE' && current.quantity === 0) throw new ValidationFailedError('A voucher with no remaining quantity cannot be activated', { field: 'quantity' });
    const updated = await this.repository.setStatus(context, voucherId, status);
    if (!updated) throw new NotFoundError('Shop voucher not found');
    return updated;
  }

  private shopId(context: RequestContext): string {
    if (context.role !== 'SELLER' || !context.shop_id || context.shop_status !== 'ACTIVE') throw new ForbiddenError('SHOP_NOT_ACTIVE', 'An active Seller shop is required');
    return context.shop_id;
  }

  private validate(input: Record<string, unknown>): SellerVoucherFields {
    const code = typeof input.code === 'string' ? input.code.trim().toUpperCase() : '';
    const voucherName = typeof input.voucher_name === 'string' ? input.voucher_name.trim() : '';
    const discountType = input.discount_type;
    const discountValue = input.discount_value;
    const maxDiscount = input.max_discount;
    const minOrderValue = input.min_order_value;
    const quantity = input.quantity;
    const startAt = input.start_at;
    const endAt = input.end_at;
    if (!code || code.length > 50) throw new ValidationFailedError('Code must contain 1 to 50 characters', { field: 'code' });
    if (!voucherName || voucherName.length > 150) throw new ValidationFailedError('Voucher name must contain 1 to 150 characters', { field: 'voucher_name' });
    if (discountType !== 'PERCENT' && discountType !== 'FIXED') throw new ValidationFailedError('Invalid discount type', { field: 'discount_type' });
    const asDecimal = (value: unknown, field: string, nullable = false): string | null => {
      if (nullable && value === null) return null;
      if (typeof value !== 'string' || !decimal.test(value)) throw new ValidationFailedError(`${field} must be a decimal amount`, { field });
      return value;
    };
    const discount = asDecimal(discountValue, 'discount_value') as string;
    const maximum = asDecimal(maxDiscount, 'max_discount', true) as string | null;
    const minimum = asDecimal(minOrderValue, 'min_order_value') as string;
    if (Number(discount) <= 0 || (discountType === 'PERCENT' && Number(discount) > 100)) throw new ValidationFailedError('Discount value is out of range', { field: 'discount_value' });
    if (maximum !== null && Number(maximum) < 0) throw new ValidationFailedError('Maximum discount cannot be negative', { field: 'max_discount' });
    if (Number(minimum) < 0) throw new ValidationFailedError('Minimum order value cannot be negative', { field: 'min_order_value' });
    if (!Number.isInteger(quantity) || Number(quantity) < 0) throw new ValidationFailedError('Quantity must be a non-negative integer', { field: 'quantity' });
    if (typeof startAt !== 'string' || Number.isNaN(Date.parse(startAt)) || typeof endAt !== 'string' || Number.isNaN(Date.parse(endAt)) || Date.parse(startAt) >= Date.parse(endAt)) {
      throw new ValidationFailedError('Voucher start time must be before end time', { field: 'end_at' });
    }
    return { code, voucher_name: voucherName, discount_type: discountType, discount_value: discount, max_discount: maximum, min_order_value: minimum, quantity: Number(quantity), start_at: new Date(startAt).toISOString(), end_at: new Date(endAt).toISOString() };
  }
}
