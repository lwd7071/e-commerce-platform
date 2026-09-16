import type { UUID, DecimalString, ISOTimestamp } from '../domain/types.ts';
import { ValidationError } from '../domain/errors.ts';

// Helper kiểm tra UUID v4 canonical
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertValidUUID(value: string, fieldName: string): void {
  if (!value || typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new ValidationError(`Trường '${fieldName}' phải là UUID hợp lệ.`, { field: fieldName, value });
  }
}

// 1. Profile DTOs
export interface UpdateProfileDTO {
  fullName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

export function validateUpdateProfileDTO(dto: any): UpdateProfileDTO {
  const allowedKeys = ['fullName', 'phone', 'avatarUrl'];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }

  if (dto.fullName !== undefined && dto.fullName !== null) {
    if (typeof dto.fullName !== 'string' || dto.fullName.trim().length === 0 || dto.fullName.length > 150) {
      throw new ValidationError('Họ và tên phải có độ dài từ 1 đến 150 ký tự.', { field: 'fullName' });
    }
  }

  if (dto.phone !== undefined && dto.phone !== null) {
    if (typeof dto.phone !== 'string' || dto.phone.length > 20) {
      throw new ValidationError('Số điện thoại không hợp lệ (tối đa 20 ký tự).', { field: 'phone' });
    }
  }

  return dto;
}

// 2. Address DTOs
export interface CreateAddressDTO {
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  detailAddress: string;
  isDefault?: boolean;
}

export function validateCreateAddressDTO(dto: any): CreateAddressDTO {
  const allowedKeys = ['recipientName', 'phone', 'province', 'district', 'ward', 'detailAddress', 'isDefault'];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }

  const requiredFields = ['recipientName', 'phone', 'province', 'district', 'ward', 'detailAddress'];
  for (const f of requiredFields) {
    if (!dto[f] || typeof dto[f] !== 'string' || dto[f].trim() === '') {
      throw new ValidationError(`Trường '${f}' bắt buộc và không được để trống.`, { field: f });
    }
  }

  return dto;
}

// 3. Cart DTOs
export interface AddToCartDTO {
  variantId: UUID;
  quantity: number;
}

export function validateAddToCartDTO(dto: any): AddToCartDTO {
  const allowedKeys = ['variantId', 'quantity'];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }

  assertValidUUID(dto.variantId, 'variantId');
  if (!Number.isInteger(dto.quantity) || dto.quantity < 1) {
    throw new ValidationError('Số lượng sản phẩm thêm vào giỏ phải là số nguyên >= 1 (RB-MG05).', { field: 'quantity' });
  }

  return dto;
}

export interface UpdateCartItemDTO {
  quantity?: number;
  isSelected?: boolean;
}

export function validateUpdateCartItemDTO(dto: any): UpdateCartItemDTO {
  const allowedKeys = ['quantity', 'isSelected'];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }

  if (dto.quantity !== undefined) {
    if (!Number.isInteger(dto.quantity) || dto.quantity < 1) {
      throw new ValidationError('Số lượng sản phẩm trong giỏ phải là số nguyên >= 1 (RB-MG05).', { field: 'quantity' });
    }
  }

  if (dto.isSelected !== undefined && typeof dto.isSelected !== 'boolean') {
    throw new ValidationError('Trường isSelected phải là boolean.', { field: 'isSelected' });
  }

  return dto;
}

// 4. Voucher DTOs
export interface CreateVoucherDTO {
  code: string;
  voucherName: string;
  scope: 'PLATFORM' | 'SHOP';
  shopId?: UUID | null;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: DecimalString;
  maxDiscount?: DecimalString | null;
  minOrderValue: DecimalString;
  quantity: number;
  startAt: ISOTimestamp;
  endAt: ISOTimestamp;
}

// 5. Review DTOs
export interface CreateReviewDTO {
  rating: number;
  content?: string | null;
  images?: string[];
}

export function validateCreateReviewDTO(dto: any): CreateReviewDTO {
  const allowedKeys = ['rating', 'content', 'images'];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }

  if (!Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5) {
    throw new ValidationError('Rating phải là số nguyên từ 1 đến 5 (QD15, RB-MG08).', { field: 'rating' });
  }

  return dto;
}

// 6. Notification DTOs (Resource-based theo api-conventions.md §1)
export interface UpdateNotificationDTO {
  isRead: boolean;
}

export function validateUpdateNotificationDTO(dto: any): UpdateNotificationDTO {
  const allowedKeys = ['isRead'];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }

  if (typeof dto.isRead !== 'boolean') {
    throw new ValidationError('Trường isRead phải là boolean.', { field: 'isRead' });
  }

  return dto;
}
