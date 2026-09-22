import type {
  UserProfile,
  Address,
  Cart,
  CartItem,
  Voucher,
  VoucherUsage,
  Review,
  ReviewImage,
  Notification,
  NotificationType,
} from '../domain/types';

/**
 * SOLID: Single Responsibility Principle (S)
 * Module chuyên biệt chịu trách nhiệm chuyển đổi (mapping) giữa
 * các dòng CSDL PostgreSQL (snake_case) sang Domain Types (camelCase).
 */

const toIso = (val: unknown): string => {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? val : d.toISOString();
  }
  return String(val ?? '');
};

const toDecimal = (val: unknown): string => {
  if (val === null || val === undefined) return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num) ? String(val) : num.toFixed(2);
};

export function mapUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    userId: String(row.user_id),
    fullName: row.full_name !== null && row.full_name !== undefined ? String(row.full_name) : null,
    phone: row.phone !== null && row.phone !== undefined ? String(row.phone) : null,
    avatarUrl: row.avatar_url !== null && row.avatar_url !== undefined ? String(row.avatar_url) : null,
    updatedAt: toIso(row.updated_at),
  };
}

export function mapAddress(row: Record<string, unknown>): Address {
  return {
    addressId: String(row.address_id),
    userId: String(row.user_id),
    recipientName: String(row.recipient_name),
    phone: String(row.phone),
    province: String(row.province),
    district: String(row.district),
    ward: String(row.ward),
    detailAddress: String(row.detail_address),
    isDefault: Boolean(row.is_default),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapCart(row: Record<string, unknown>): Cart {
  return {
    cartId: String(row.cart_id),
    buyerId: String(row.buyer_id),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapCartItem(row: Record<string, unknown>): CartItem {
  return {
    cartItemId: String(row.cart_item_id),
    cartId: String(row.cart_id),
    variantId: String(row.variant_id),
    quantity: Number(row.quantity),
    isSelected: Boolean(row.is_selected),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapVoucher(row: Record<string, unknown>): Voucher {
  return {
    voucherId: String(row.voucher_id),
    code: String(row.code),
    voucherName: String(row.voucher_name),
    scope: row.scope as 'PLATFORM' | 'SHOP',
    shopId: row.shop_id !== null && row.shop_id !== undefined ? String(row.shop_id) : null,
    discountType: row.discount_type as 'PERCENT' | 'FIXED',
    discountValue: toDecimal(row.discount_value),
    maxDiscount: row.max_discount !== null && row.max_discount !== undefined ? toDecimal(row.max_discount) : null,
    minOrderValue: toDecimal(row.min_order_value),
    quantity: Number(row.quantity),
    startAt: toIso(row.start_at),
    endAt: toIso(row.end_at),
    status: row.status as 'ACTIVE' | 'INACTIVE',
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapVoucherUsage(row: Record<string, unknown>): VoucherUsage {
  return {
    usageId: String(row.usage_id),
    voucherId: String(row.voucher_id),
    orderId: String(row.order_id),
    buyerId: String(row.buyer_id),
    discountAmount: toDecimal(row.discount_amount),
    usedAt: toIso(row.used_at),
  };
}

export function mapReview(row: Record<string, unknown>): Review {
  return {
    reviewId: String(row.review_id),
    buyerId: String(row.buyer_id),
    productId: String(row.product_id),
    orderItemId: String(row.order_item_id),
    rating: Number(row.rating),
    content: row.content !== null && row.content !== undefined ? String(row.content) : null,
    status: row.status as 'VISIBLE' | 'HIDDEN',
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapReviewImage(row: Record<string, unknown>): ReviewImage {
  return {
    reviewImageId: String(row.review_image_id),
    reviewId: String(row.review_id),
    imageUrl: String(row.image_url),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function mapNotification(row: Record<string, unknown>): Notification {
  return {
    notificationId: String(row.notification_id),
    recipientId: String(row.recipient_id),
    type: row.type as NotificationType,
    title: String(row.title),
    content: String(row.content),
    isRead: Boolean(row.is_read),
    createdAt: toIso(row.created_at),
    readAt: row.read_at ? toIso(row.read_at) : null,
  };
}
