import type { UUID, DecimalString, ISOTimestamp } from '../domain/types';
import { ValidationError } from '../domain/errors';
import { resolveAdministrativeAddress } from '../../shipping/locations.ts';

// Helper kiểm tra UUID v4 canonical
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Helper kiểm tra định dạng số điện thoại Việt Nam (0xxxxxxxxx hoặc +84xxxxxxxxx)
const PHONE_REGEX = /^(?:0\d{9,10}|\+84\d{9,10})$/;

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
  provinceCode?: string;
  district?: string;
  ward: string;
  wardCode?: string;
  detailAddress: string;
  isDefault?: boolean;
}

export function validateCreateAddressDTO(rawDto: unknown): CreateAddressDTO {
  const dto = assertNonNullObject(rawDto, 'CreateAddress');
  const allowedKeys = [
    'recipientName', 'phone', 'province', 'province_code', 'district', 'ward', 'ward_code', 'detailAddress', 'isDefault',
    'recipient_name', 'detail_address', 'is_default'
  ];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }

  const recipientName = dto.recipientName ?? dto.recipient_name;
  const phone = dto.phone;
  let province = dto.province;
  const district = dto.district;
  let ward = dto.ward;
  const provinceCode = dto.province_code;
  const wardCode = dto.ward_code;
  const detailAddress = dto.detailAddress ?? dto.detail_address;
  const rawIsDefault = dto.isDefault ?? dto.is_default;

  if ((provinceCode === undefined) !== (wardCode === undefined)) throw new ValidationError('province_code and ward_code must be provided together.');
  if (provinceCode !== undefined || wardCode !== undefined) {
    if (typeof provinceCode !== 'string' || typeof wardCode !== 'string') throw new ValidationError('province_code and ward_code must be strings.');
    const labels = resolveAdministrativeAddress(provinceCode, wardCode);
    province = labels.province;
    ward = labels.ward;
  }
  const requiredFields: Record<string, unknown> = {
    recipient_name: recipientName,
    phone,
    province,
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

  const cleanedPhone = String(phone).trim();
  if (!PHONE_REGEX.test(cleanedPhone)) {
    throw new ValidationError('Số điện thoại không hợp lệ (phải bắt đầu bằng 0 hoặc +84 và có 10-11 chữ số).', { field: 'phone' });
  }

  const result: CreateAddressDTO = {
    recipientName: String(recipientName).trim(),
    phone: cleanedPhone,
    province: String(province).trim(),
    ward: String(ward).trim(),
    detailAddress: String(detailAddress).trim(),
  };
  if (typeof provinceCode === 'string') result.provinceCode = provinceCode;
  if (typeof wardCode === 'string') result.wardCode = wardCode;
  if (typeof district === 'string' && district.trim()) result.district = district.trim();
  if (isDefault !== undefined) result.isDefault = isDefault;
  return result;
}

export interface UpdateAddressDTO {
  recipientName?: string;
  phone?: string;
  province?: string;
  provinceCode?: string;
  district?: string | null;
  ward?: string;
  wardCode?: string;
  detailAddress?: string;
  isDefault?: boolean;
}

export function validateUpdateAddressDTO(rawDto: unknown): UpdateAddressDTO {
  const dto = assertNonNullObject(rawDto, 'UpdateAddress');
  const allowedKeys = [
    'recipientName', 'phone', 'province', 'province_code', 'district', 'ward', 'ward_code', 'detailAddress', 'isDefault',
    'recipient_name', 'detail_address', 'is_default'
  ];
  for (const k of Object.keys(dto)) {
    if (!allowedKeys.includes(k)) {
      throw new ValidationError(`Trường '${k}' không được phép tồn tại (Unknown field).`, { field: k });
    }
  }
  const rawProvinceCode = dto.province_code;
  const rawWardCode = dto.ward_code;
  if ((rawProvinceCode === undefined) !== (rawWardCode === undefined)) throw new ValidationError('province_code and ward_code must be provided together.');
  const canonicalLabels = rawProvinceCode === undefined ? undefined : (() => {
    if (typeof rawProvinceCode !== 'string' || typeof rawWardCode !== 'string') throw new ValidationError('province_code and ward_code must be strings.');
    return resolveAdministrativeAddress(rawProvinceCode, rawWardCode);
  })();

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
    if (!PHONE_REGEX.test(phone)) {
      throw new ValidationError('Số điện thoại không hợp lệ (phải bắt đầu bằng 0 hoặc +84 và có 10-11 chữ số).', { field: 'phone' });
    }
  }

  const rawProvince = canonicalLabels?.province ?? dto.province;
  let province: string | undefined;
  if (rawProvince !== undefined) {
    if (typeof rawProvince !== 'string' || rawProvince.trim() === '') {
      throw new ValidationError("Trường 'province' không được để trống.", { field: 'province' });
    }
    province = rawProvince.trim();
  }

  const rawDistrict = dto.district;
  let district: string | null | undefined;
  if (rawDistrict !== undefined) {
    if (typeof rawDistrict !== 'string') {
      throw new ValidationError("Trường 'district' không được để trống.", { field: 'district' });
    }
    district = rawDistrict.trim() || null;
  }

  const rawWard = canonicalLabels?.ward ?? dto.ward;
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
  if (typeof rawProvinceCode === 'string') result.provinceCode = rawProvinceCode;
  if (district !== undefined) result.district = district;
  if (ward !== undefined) result.ward = ward;
  if (typeof rawWardCode === 'string') result.wardCode = rawWardCode;
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

  if (quantity === undefined && isSelected === undefined) {
    throw new ValidationError('At least one cart item field must be provided.', { field: 'body' });
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
  reviewId?: UUID;
  imageMediaIds?: UUID[];
}

export function validateCreateReviewDTO(rawDto: unknown): CreateReviewDTO {
  const dto = assertNonNullObject(rawDto, 'CreateReview');
  const allowedKeys = ['rating', 'content', 'images', 'review_id', 'reviewId', 'image_media_ids', 'imageMediaIds'];
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

  const rawReviewId = dto.review_id ?? dto.reviewId;
  let reviewId: UUID | undefined;
  if (rawReviewId !== undefined) {
    if (typeof rawReviewId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawReviewId.trim())) {
      throw new ValidationError('review_id phải là UUID hợp lệ.', { field: 'review_id' });
    }
    reviewId = rawReviewId.trim();
  }

  const rawMediaIds = dto.image_media_ids ?? dto.imageMediaIds;
  let imageMediaIds: UUID[] | undefined;
  if (rawMediaIds !== undefined) {
    if (!Array.isArray(rawMediaIds)) {
      throw new ValidationError('image_media_ids phải là mảng UUID.', { field: 'image_media_ids' });
    }
    if (rawMediaIds.length > 3) {
      throw new ValidationError('Tối đa 3 hình ảnh cho mỗi đánh giá (P-607c).', { field: 'image_media_ids' });
    }
    for (const mId of rawMediaIds) {
      if (typeof mId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mId.trim())) {
        throw new ValidationError('image_media_ids chứa media_id không phải UUID hợp lệ.', { field: 'image_media_ids' });
      }
    }
    imageMediaIds = rawMediaIds.map(mId => String(mId).trim());
  }

  const result: CreateReviewDTO = { rating: dto.rating, content, images };
  if (reviewId !== undefined) result.reviewId = reviewId;
  if (imageMediaIds !== undefined) result.imageMediaIds = imageMediaIds;
  return result;
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
