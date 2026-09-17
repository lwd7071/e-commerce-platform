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

export function mapUserProfile(row: any): UserProfile {
  return {
    userId: row.user_id,
    fullName: row.full_name ?? null,
    phone: row.phone ?? null,
    avatarUrl: row.avatar_url ?? null,
    updatedAt: toIso(row.updated_at),
  };
}

export function mapAddress(row: any): Address {
  return {
    addressId: row.address_id,
    userId: row.user_id,
    recipientName: row.recipient_name,
    phone: row.phone,
    province: row.province,
    district: row.district,
    ward: row.ward,
    detailAddress: row.detail_address,
    isDefault: Boolean(row.is_default),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapCart(row: any): Cart {
  return {
    cartId: row.cart_id,
    buyerId: row.buyer_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapCartItem(row: any): CartItem {
  return {
    cartItemId: row.cart_item_id,
    cartId: row.cart_id,
    variantId: row.variant_id,
    quantity: Number(row.quantity),
    isSelected: Boolean(row.is_selected),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapVoucher(row: any): Voucher {
  return {
    voucherId: row.voucher_id,
    code: row.code,
    voucherName: row.voucher_name,
    scope: row.scope,
    shopId: row.shop_id ?? null,
    discountType: row.discount_type,
    discountValue: toDecimal(row.discount_value),
    maxDiscount: row.max_discount !== null && row.max_discount !== undefined ? toDecimal(row.max_discount) : null,
    minOrderValue: toDecimal(row.min_order_value),
    quantity: Number(row.quantity),
    startAt: toIso(row.start_at),
    endAt: toIso(row.end_at),
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapVoucherUsage(row: any): VoucherUsage {
  return {
    usageId: row.usage_id,
    voucherId: row.voucher_id,
    orderId: row.order_id,
    buyerId: row.buyer_id,
    discountAmount: toDecimal(row.discount_amount),
    usedAt: toIso(row.used_at),
  };
}

export function mapReview(row: any): Review {
  return {
    reviewId: row.review_id,
    buyerId: row.buyer_id,
    productId: row.product_id,
    orderItemId: row.order_item_id,
    rating: Number(row.rating),
    content: row.content ?? null,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapReviewImage(row: any): ReviewImage {
  return {
    reviewImageId: row.review_image_id,
    reviewId: row.review_id,
    imageUrl: row.image_url,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function mapNotification(row: any): Notification {
  return {
    notificationId: row.notification_id,
    recipientId: row.recipient_id,
    type: row.type as NotificationType,
    title: row.title,
    content: row.content,
    isRead: Boolean(row.is_read),
    createdAt: toIso(row.created_at),
    readAt: row.read_at ? toIso(row.read_at) : null,
  };
}
