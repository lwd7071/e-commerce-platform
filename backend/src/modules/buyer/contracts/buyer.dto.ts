import type { UUID, DecimalString, ISOTimestamp } from '../domain/types';
import { ValidationError } from '../domain/errors';

// Helper kiểm tra UUID v4 canonical
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertValidUUID(value: string, fieldName: string): void {
  if (!value || typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new ValidationError(`Trường '${fieldName}' phải là UUID hợp lệ.`, { field: fieldName, value });
  }
}

function assertNonNullObject(dto: unknown, contextName: string): Record<string, unknown> {
  if (typeof dto !== 'object' || dto === null || Array.isArray(dto)) {
    throw new ValidationError(`Dữ liệu '${contextName}' phải là một JSON object hợp lệ.`, { field: 'body' });
  }
  return dto as Record<string, unknown>;
}

// 1. Profile DTOs
export interface UpdateProfileDTO {
  fullName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

export function validateUpdateProfileDTO(rawDto: unknown): UpdateProfileDTO {
  const dto = assertNonNullObject(rawDto, 'UpdateProfile');
  const allowedKeys = ['fullName', 'phone', 'avatarUrl', 'full_name', 'avatar_url'];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }

  const rawFullName = dto.fullName ?? dto.full_name;
  let fullName: string | null | undefined;
  if (rawFullName !== undefined && rawFullName !== null) {
    if (typeof rawFullName !== 'string' || rawFullName.trim().length === 0 || rawFullName.length > 150) {
      throw new ValidationError('Họ và tên phải có độ dài từ 1 đến 150 ký tự.', { field: 'full_name' });
    }
    fullName = rawFullName.trim();
  } else if (rawFullName === null) {
    fullName = null;
  }

  const rawPhone = dto.phone;
  let phone: string | null | undefined;
  if (rawPhone !== undefined && rawPhone !== null) {
    if (typeof rawPhone !== 'string' || rawPhone.length > 20) {
      throw new ValidationError('Số điện thoại không hợp lệ (tối đa 20 ký tự).', { field: 'phone' });
    }
    phone = rawPhone;
  } else if (rawPhone === null) {
    phone = null;
  }

  const rawAvatarUrl = dto.avatarUrl ?? dto.avatar_url;
  let avatarUrl: string | null | undefined;
  if (rawAvatarUrl !== undefined && rawAvatarUrl !== null) {
    if (typeof rawAvatarUrl !== 'string') {
      throw new ValidationError('Ảnh đại diện phải là đường dẫn URL hợp lệ.', { field: 'avatar_url' });
    }
    avatarUrl = rawAvatarUrl;
  } else if (rawAvatarUrl === null) {
    avatarUrl = null;
  }

  const result: UpdateProfileDTO = {};
  if (fullName !== undefined) result.fullName = fullName;
  if (phone !== undefined) result.phone = phone;
  if (avatarUrl !== undefined) result.avatarUrl = avatarUrl;
  return result;
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

export function validateCreateAddressDTO(rawDto: unknown): CreateAddressDTO {
  const dto = assertNonNullObject(rawDto, 'CreateAddress');
  const allowedKeys = [
    'recipientName', 'phone', 'province', 'district', 'ward', 'detailAddress', 'isDefault',
    'recipient_name', 'detail_address', 'is_default'
  ];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }

  const recipientName = dto.recipientName ?? dto.recipient_name;
  const phone = dto.phone;
  const province = dto.province;
  const district = dto.district;
  const ward = dto.ward;
  const detailAddress = dto.detailAddress ?? dto.detail_address;
  const rawIsDefault = dto.isDefault ?? dto.is_default;

  const requiredFields: Record<string, unknown> = {
    recipient_name: recipientName,
    phone,
    province,
    district,
    ward,
    detail_address: detailAddress,
  };

  for (const [key, val] of Object.entries(requiredFields)) {
    if (!val || typeof val !== 'string' || val.trim() === '') {
      throw new ValidationError(`Trường '${key}' bắt buộc và không được để trống.`, { field: key });
    }
  }

  let isDefault: boolean | undefined;
  if (rawIsDefault !== undefined) {
    if (typeof rawIsDefault !== 'boolean') {
      throw new ValidationError('Trường is_default phải là boolean.', { field: 'is_default' });
    }
    isDefault = rawIsDefault;
  }

  return {
    recipientName: String(recipientName).trim(),
    phone: String(phone).trim(),
    province: String(province).trim(),
    district: String(district).trim(),
    ward: String(ward).trim(),
    detailAddress: String(detailAddress).trim(),
    isDefault,
  };
}

export interface UpdateAddressDTO {
  recipientName?: string;
  phone?: string;
  province?: string;
  district?: string;
  ward?: string;
  detailAddress?: string;
  isDefault?: boolean;
}

export function validateUpdateAddressDTO(rawDto: unknown): UpdateAddressDTO {
  const dto = assertNonNullObject(rawDto, 'UpdateAddress');
  const allowedKeys = [
    'recipientName', 'phone', 'province', 'district', 'ward', 'detailAddress', 'isDefault',
    'recipient_name', 'detail_address', 'is_default'
  ];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }

  const rawRecipientName = dto.recipientName ?? dto.recipient_name;
  let recipientName: string | undefined;
  if (rawRecipientName !== undefined) {
    if (typeof rawRecipientName !== 'string' || rawRecipientName.trim() === '') {
      throw new ValidationError("Trường 'recipient_name' không được để trống.", { field: 'recipient_name' });
    }
    recipientName = rawRecipientName.trim();
  }

  const rawPhone = dto.phone;
  let phone: string | undefined;
  if (rawPhone !== undefined) {
    if (typeof rawPhone !== 'string' || rawPhone.trim() === '') {
      throw new ValidationError("Trường 'phone' không được để trống.", { field: 'phone' });
    }
    phone = rawPhone.trim();
  }

  const rawProvince = dto.province;
  let province: string | undefined;
  if (rawProvince !== undefined) {
    if (typeof rawProvince !== 'string' || rawProvince.trim() === '') {
      throw new ValidationError("Trường 'province' không được để trống.", { field: 'province' });
    }
    province = rawProvince.trim();
  }

  const rawDistrict = dto.district;
  let district: string | undefined;
  if (rawDistrict !== undefined) {
    if (typeof rawDistrict !== 'string' || rawDistrict.trim() === '') {
      throw new ValidationError("Trường 'district' không được để trống.", { field: 'district' });
    }
    district = rawDistrict.trim();
  }

  const rawWard = dto.ward;
  let ward: string | undefined;
  if (rawWard !== undefined) {
    if (typeof rawWard !== 'string' || rawWard.trim() === '') {
      throw new ValidationError("Trường 'ward' không được để trống.", { field: 'ward' });
    }
    ward = rawWard.trim();
  }

  const rawDetailAddress = dto.detailAddress ?? dto.detail_address;
  let detailAddress: string | undefined;
  if (rawDetailAddress !== undefined) {
    if (typeof rawDetailAddress !== 'string' || rawDetailAddress.trim() === '') {
      throw new ValidationError("Trường 'detail_address' không được để trống.", { field: 'detail_address' });
    }
    detailAddress = rawDetailAddress.trim();
  }

  const rawIsDefault = dto.isDefault ?? dto.is_default;
  let isDefault: boolean | undefined;
  if (rawIsDefault !== undefined) {
    if (typeof rawIsDefault !== 'boolean') {
      throw new ValidationError('Trường is_default phải là boolean.', { field: 'is_default' });
    }
    isDefault = rawIsDefault;
  }

  const result: UpdateAddressDTO = {};
  if (recipientName !== undefined) result.recipientName = recipientName;
  if (phone !== undefined) result.phone = phone;
  if (province !== undefined) result.province = province;
  if (district !== undefined) result.district = district;
  if (ward !== undefined) result.ward = ward;
  if (detailAddress !== undefined) result.detailAddress = detailAddress;
  if (isDefault !== undefined) result.isDefault = isDefault;

  return result;
}

// 3. Cart DTOs
export interface AddToCartDTO {
  variantId: UUID;
  quantity: number;
}

export function validateAddToCartDTO(rawDto: unknown): AddToCartDTO {
  const dto = assertNonNullObject(rawDto, 'AddToCart');
  const allowedKeys = ['variantId', 'quantity', 'variant_id'];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }

  const variantId = String(dto.variantId ?? dto.variant_id ?? '');
  assertValidUUID(variantId, 'variant_id');

  const quantity = dto.quantity;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
    throw new ValidationError('Số lượng sản phẩm thêm vào giỏ phải là số nguyên >= 1 (RB-MG05).', { field: 'quantity' });
  }

  return { variantId, quantity };
}

export interface UpdateCartItemDTO {
  quantity?: number;
  isSelected?: boolean;
}

export function validateUpdateCartItemDTO(rawDto: unknown): UpdateCartItemDTO {
  const dto = assertNonNullObject(rawDto, 'UpdateCartItem');
  const allowedKeys = ['quantity', 'isSelected', 'is_selected'];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }

  let quantity: number | undefined;
  if (dto.quantity !== undefined) {
    if (typeof dto.quantity !== 'number' || !Number.isInteger(dto.quantity) || dto.quantity < 1) {
      throw new ValidationError('Số lượng sản phẩm trong giỏ phải là số nguyên >= 1 (RB-MG05).', { field: 'quantity' });
    }
    quantity = dto.quantity;
  }

  const rawIsSelected = dto.isSelected ?? dto.is_selected;
  let isSelected: boolean | undefined;
  if (rawIsSelected !== undefined) {
    if (typeof rawIsSelected !== 'boolean') {
      throw new ValidationError('Trường is_selected phải là boolean.', { field: 'is_selected' });
    }
    isSelected = rawIsSelected;
  }

  return { quantity, isSelected };
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

export function validateCreateReviewDTO(rawDto: unknown): CreateReviewDTO {
  const dto = assertNonNullObject(rawDto, 'CreateReview');
  const allowedKeys = ['rating', 'content', 'images'];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }

  if (typeof dto.rating !== 'number' || !Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5) {
    throw new ValidationError('Rating phải là số nguyên từ 1 đến 5 (QD15, RB-MG08).', { field: 'rating' });
  }

  let content: string | null | undefined;
  if (dto.content !== undefined && dto.content !== null) {
    if (typeof dto.content !== 'string') {
      throw new ValidationError('Nội dung đánh giá phải là chuỗi ký tự.', { field: 'content' });
    }
    content = dto.content.trim();
  } else if (dto.content === null) {
    content = null;
  }

  let images: string[] | undefined;
  if (dto.images !== undefined) {
    if (!Array.isArray(dto.images) || !dto.images.every(img => typeof img === 'string' && img.trim().length > 0)) {
      throw new ValidationError('Danh sách ảnh đánh giá phải là mảng chuỗi URL hợp lệ.', { field: 'images' });
    }
    images = dto.images.map(img => String(img).trim());
  }

  return { rating: dto.rating, content, images };
}

// 6. Notification DTOs (Resource-based theo api-conventions.md §1)
export interface UpdateNotificationDTO {
  isRead: boolean;
}

export function validateUpdateNotificationDTO(rawDto: unknown): UpdateNotificationDTO {
  const dto = assertNonNullObject(rawDto, 'UpdateNotification');
  const allowedKeys = ['isRead', 'is_read'];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }

  const rawIsRead = dto.isRead ?? dto.is_read;
  if (typeof rawIsRead !== 'boolean') {
    throw new ValidationError('Trường is_read phải là boolean.', { field: 'is_read' });
  }

  return { isRead: rawIsRead };
}
