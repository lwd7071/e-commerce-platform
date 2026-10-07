import { z } from 'zod';
import { InvalidRequestError } from '../../../platform/errors/app-error.ts';

/**
 * Zod Schema for Flash Sale purchase request body.
 * Note: Zod default behavior automatically strips unknown fields (safe against untrusted payload pollution).
 */
export const PurchaseFlashSaleBodySchema = z.object({
  idempotency_key: z.string().min(16).max(128).optional(),
  voucher_code: z.string().optional(),
  recipient_name: z.string().min(1).max(100).optional(),
  recipient_phone: z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ').optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  ward: z.string().optional(),
  delivery_address: z.string().optional(),
});

export type PurchaseFlashSaleBodyInput = z.infer<typeof PurchaseFlashSaleBodySchema>;

/**
 * Raw Input Guard:
 * Intercepts raw request body before Zod strips unknown fields to catch and explicitly reject
 * any identity spoofing attempts (e.g. user_id, userId, USER_ID, user-id).
 */
export function validatePurchaseBody(rawBody: unknown): PurchaseFlashSaleBodyInput {
  if (typeof rawBody === 'object' && rawBody !== null) {
    const raw = rawBody as Record<string, unknown>;
    const hasUserIdField = Object.keys(raw).some(
      (k) => k.replace(/[_-]/g, '').toLowerCase() === 'userid'
    );

    if (hasUserIdField) {
      throw new InvalidRequestError(
        'Trường user_id bị nghiêm cấm trong request body. Định danh người mua được lấy trực tiếp từ token xác thực.'
      );
    }
  }

  return PurchaseFlashSaleBodySchema.parse(rawBody);
}
