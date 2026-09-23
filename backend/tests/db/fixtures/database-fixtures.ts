import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

type Queryable = Pool | PoolClient;

export interface FixtureUser {
  userId: string;
  email: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
  status: 'ACTIVE' | 'LOCKED';
}

export interface FixtureShop {
  shopId: string;
  ownerId: string;
  shopName: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
}

export interface FixtureCategory {
  categoryId: string;
  parentCategoryId?: string | null;
  categoryName: string;
  status: 'ACTIVE' | 'HIDDEN';
}

export interface FixtureProduct {
  productId: string;
  shopId: string;
  categoryId: string;
  productName: string;
  status: 'DRAFT' | 'ACTIVE' | 'HIDDEN';
}

export interface FixtureVariant {
  variantId: string;
  productId: string;
  variantName: string;
  sku: string;
  price: string;
  stockQuantity: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface FixtureAddress {
  addressId: string;
  userId: string;
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  detailAddress: string;
  isDefault: boolean;
}

export interface FixtureCart {
  cartId: string;
  buyerId: string;
}

export interface FixtureCartItem {
  cartItemId: string;
  cartId: string;
  variantId: string;
  quantity: number;
  isSelected: boolean;
}

export interface FixtureVoucher {
  voucherId: string;
  code: string;
  voucherName: string;
  scope: 'PLATFORM' | 'SHOP';
  shopId?: string | null;
  discountType: 'FIXED' | 'PERCENT';
  discountValue: string;
  maxDiscount?: string | null;
  minOrderValue: string;
  quantity: number;
  startAt: string;
  endAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'DISABLED';
}

export interface FixtureOrder {
  orderId: string;
  buyerId: string;
  shopId: string;
  status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'PREPARING' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED' | 'DELIVERY_FAILED';
  subtotal: string;
  shippingFee: string;
  discountAmount: string;
  totalAmount: string;
}

export interface FixtureOrderItem {
  orderItemId: string;
  orderId: string;
  productId: string;
  variantId: string;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface FixturePayment {
  paymentId: string;
  orderId: string;
  paymentMethod: 'COD' | 'ONLINE';
  amount: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  paidAt?: string | null;
}

export interface FixtureReview {
  reviewId: string;
  buyerId: string;
  productId: string;
  orderItemId: string;
  rating: number;
  content: string;
  status: 'VISIBLE' | 'HIDDEN';
}

/**
 * Đảm bảo user tồn tại trong auth.users (nếu chạy với superuser direct connection).
 */
export async function ensureAuthUser(client: Queryable, userId: string, email: string): Promise<void> {
  await client.query(
    `INSERT INTO auth.users (id, email)
     VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [userId, email],
  );
}

export async function createFixtureUser(client: Queryable, overrides: Partial<FixtureUser> = {}): Promise<FixtureUser> {
  const userId = overrides.userId ?? randomUUID();
  const email = overrides.email ?? `user_${userId.slice(0, 8)}@fixture.test`;
  const role = overrides.role ?? 'BUYER';
  const status = overrides.status ?? 'ACTIVE';

  await client.query(
    `INSERT INTO app_users (user_id, email, role, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, status = EXCLUDED.status`,
    [userId, email, role, status],
  );

  return { userId, email, role, status };
}

export async function createFixtureShop(client: Queryable, ownerId: string, overrides: Partial<FixtureShop> = {}): Promise<FixtureShop> {
  const shopId = overrides.shopId ?? randomUUID();
  const shopName = overrides.shopName ?? `Shop ${shopId.slice(0, 8)}`;
  const status = overrides.status ?? 'ACTIVE';

  await client.query(
    `INSERT INTO shops (shop_id, owner_id, shop_name, status)
     VALUES ($1, $2, $3, $4)`,
    [shopId, ownerId, shopName, status],
  );

  return { shopId, ownerId, shopName, status };
}

export async function createFixtureCategory(client: Queryable, overrides: Partial<FixtureCategory> = {}): Promise<FixtureCategory> {
  const categoryId = overrides.categoryId ?? randomUUID();
  const categoryName = overrides.categoryName ?? `Cat ${categoryId.slice(0, 8)}`;
  const status = overrides.status ?? 'ACTIVE';
  const parentCategoryId = overrides.parentCategoryId ?? null;

  await client.query(
    `INSERT INTO categories (category_id, parent_category_id, category_name, status)
     VALUES ($1, $2, $3, $4)`,
    [categoryId, parentCategoryId, categoryName, status],
  );

  return { categoryId, parentCategoryId, categoryName, status };
}

export async function createFixtureProduct(
  client: Queryable,
  shopId: string,
  categoryId: string,
  overrides: Partial<FixtureProduct> = {},
): Promise<FixtureProduct> {
  const productId = overrides.productId ?? randomUUID();
  const productName = overrides.productName ?? `Product ${productId.slice(0, 8)}`;
  const status = overrides.status ?? 'ACTIVE';

  await client.query(
    `INSERT INTO products (product_id, shop_id, category_id, product_name, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [productId, shopId, categoryId, productName, status],
  );

  return { productId, shopId, categoryId, productName, status };
}

export async function createFixtureVariant(
  client: Queryable,
  productId: string,
  overrides: Partial<FixtureVariant> = {},
): Promise<FixtureVariant> {
  const variantId = overrides.variantId ?? randomUUID();
  const variantName = overrides.variantName ?? 'Standard';
  const sku = overrides.sku ?? `SKU-${variantId.slice(0, 8)}`;
  const price = overrides.price ?? '100000.00';
  const stockQuantity = overrides.stockQuantity ?? 100;
  const status = overrides.status ?? 'ACTIVE';

  await client.query(
    `INSERT INTO product_variants (variant_id, product_id, variant_name, sku, price, stock_quantity, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [variantId, productId, variantName, sku, price, stockQuantity, status],
  );

  return { variantId, productId, variantName, sku, price, stockQuantity, status };
}

export async function createFixtureAddress(
  client: Queryable,
  userId: string,
  overrides: Partial<FixtureAddress> = {},
): Promise<FixtureAddress> {
  const addressId = overrides.addressId ?? randomUUID();
  const recipientName = overrides.recipientName ?? 'Test Recipient';
  const phone = overrides.phone ?? '0912345678';
  const province = overrides.province ?? 'HN';
  const district = overrides.district ?? 'CG';
  const ward = overrides.ward ?? 'DH';
  const detailAddress = overrides.detailAddress ?? '123 Test Street';
  const isDefault = overrides.isDefault ?? false;

  await client.query(
    `INSERT INTO addresses (address_id, user_id, recipient_name, phone, province, district, ward, detail_address, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [addressId, userId, recipientName, phone, province, district, ward, detailAddress, isDefault],
  );

  return { addressId, userId, recipientName, phone, province, district, ward, detailAddress, isDefault };
}

export async function createFixtureCart(client: Queryable, buyerId: string): Promise<FixtureCart> {
  const cartId = randomUUID();
  await client.query(
    `INSERT INTO carts (cart_id, buyer_id)
     VALUES ($1, $2)
     ON CONFLICT (buyer_id) DO NOTHING`,
    [cartId, buyerId],
  );
  const res = await client.query('SELECT cart_id, buyer_id FROM carts WHERE buyer_id = $1', [buyerId]);
  return {
    cartId: res.rows[0].cart_id,
    buyerId: res.rows[0].buyer_id,
  };
}

export async function createFixtureCartItem(
  client: Queryable,
  cartId: string,
  variantId: string,
  overrides: Partial<FixtureCartItem> = {},
): Promise<FixtureCartItem> {
  const cartItemId = overrides.cartItemId ?? randomUUID();
  const quantity = overrides.quantity ?? 1;
  const isSelected = overrides.isSelected ?? true;

  await client.query(
    `INSERT INTO cart_items (cart_item_id, cart_id, variant_id, quantity, is_selected)
     VALUES ($1, $2, $3, $4, $5)`,
    [cartItemId, cartId, variantId, quantity, isSelected],
  );

  return { cartItemId, cartId, variantId, quantity, isSelected };
}

export async function createFixtureVoucher(
  client: Queryable,
  overrides: Partial<FixtureVoucher> = {},
): Promise<FixtureVoucher> {
  const voucherId = overrides.voucherId ?? randomUUID();
  const code = overrides.code ?? `VOUCHER_${voucherId.slice(0, 8)}`;
  const voucherName = overrides.voucherName ?? 'Test Voucher';
  const scope = overrides.scope ?? 'PLATFORM';
  const shopId = scope === 'SHOP' ? (overrides.shopId ?? null) : null;
  const discountType = overrides.discountType ?? 'FIXED';
  const discountValue = overrides.discountValue ?? '20000.00';
  const maxDiscount = overrides.maxDiscount ?? null;
  const minOrderValue = overrides.minOrderValue ?? '50000.00';
  const quantity = overrides.quantity ?? 100;
  const startAt = overrides.startAt ?? new Date(Date.now() - 3600_000).toISOString();
  const endAt = overrides.endAt ?? new Date(Date.now() + 86400_000).toISOString();
  const status = overrides.status ?? 'ACTIVE';

  await client.query(
    `INSERT INTO vouchers (
       voucher_id, code, voucher_name, scope, shop_id, discount_type,
       discount_value, max_discount, min_order_value, quantity, start_at, end_at, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      voucherId, code, voucherName, scope, shopId, discountType,
      discountValue, maxDiscount, minOrderValue, quantity, startAt, endAt, status,
    ],
  );

  return {
    voucherId, code, voucherName, scope, shopId, discountType,
    discountValue, maxDiscount, minOrderValue, quantity, startAt, endAt, status,
  };
}

export async function createFixtureOrder(
  client: Queryable,
  buyerId: string,
  shopId: string,
  overrides: Partial<FixtureOrder> = {},
): Promise<FixtureOrder> {
  const orderId = overrides.orderId ?? randomUUID();
  const status = overrides.status ?? 'PENDING_CONFIRMATION';
  const subtotal = overrides.subtotal ?? '100000.00';
  const shippingFee = overrides.shippingFee ?? '20000.00';
  const discountAmount = overrides.discountAmount ?? '0.00';
  const totalAmount = overrides.totalAmount ?? '120000.00';

  await client.query(
    `INSERT INTO orders (
       order_id, buyer_id, shop_id, recipient_name, recipient_phone,
       province, district, ward, delivery_address,
       status, subtotal, shipping_fee, discount_amount, total_amount
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      orderId, buyerId, shopId, 'Test Buyer', '0912345678',
      'HN', 'CG', 'DH', '123 Order Delivery St',
      status, subtotal, shippingFee, discountAmount, totalAmount,
    ],
  );

  return { orderId, buyerId, shopId, status, subtotal, shippingFee, discountAmount, totalAmount };
}

export async function createFixtureOrderItem(
  client: Queryable,
  orderId: string,
  productId: string,
  variantId: string,
  overrides: Partial<FixtureOrderItem> = {},
): Promise<FixtureOrderItem> {
  const orderItemId = overrides.orderItemId ?? randomUUID();
  const productName = overrides.productName ?? 'Ordered Product Snapshot';
  const unitPrice = overrides.unitPrice ?? '100000.00';
  const quantity = overrides.quantity ?? 1;
  const lineTotal = overrides.lineTotal ?? '100000.00';

  await client.query(
    `INSERT INTO order_items (
       order_item_id, order_id, product_id, variant_id, product_name_snapshot, unit_price, quantity, line_total
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [orderItemId, orderId, productId, variantId, productName, unitPrice, quantity, lineTotal],
  );

  return { orderItemId, orderId, productId, variantId, productName, unitPrice, quantity, lineTotal };
}

export async function createFixturePayment(
  client: Queryable,
  orderId: string,
  overrides: Partial<FixturePayment> = {},
): Promise<FixturePayment> {
  const paymentId = overrides.paymentId ?? randomUUID();
  const paymentMethod = overrides.paymentMethod ?? 'ONLINE';
  const amount = overrides.amount ?? '120000.00';
  const status = overrides.status ?? 'PENDING';
  const paidAt = status === 'SUCCESS' ? (overrides.paidAt ?? new Date().toISOString()) : null;

  await client.query(
    `INSERT INTO payments (payment_id, order_id, method, amount, status, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [paymentId, orderId, paymentMethod, amount, status, paidAt],
  );

  return { paymentId, orderId, paymentMethod, amount, status, paidAt };
}

export async function createFixtureReview(
  client: Queryable,
  buyerId: string,
  productId: string,
  orderItemId: string,
  overrides: Partial<FixtureReview> = {},
): Promise<FixtureReview> {
  const reviewId = overrides.reviewId ?? randomUUID();
  const rating = overrides.rating ?? 5;
  const content = overrides.content ?? 'Great product!';
  const status = overrides.status ?? 'VISIBLE';

  await client.query(
    `INSERT INTO reviews (review_id, buyer_id, product_id, order_item_id, rating, content, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [reviewId, buyerId, productId, orderItemId, rating, content, status],
  );

  return { reviewId, buyerId, productId, orderItemId, rating, content, status };
}
