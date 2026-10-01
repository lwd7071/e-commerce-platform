import type {
  WireCatalogProductItem,
  WireCatalogProductDetail,
  GetProductsParams,
  CreateProductInput,
} from "../api/catalog.api";
import type { PaginatedEnvelope } from "../api/types";
import type {
  WireCart,
  WireAddress,
  WireProfile,
  CreateAddressPayload,
  WireCartItemResponse,
  UpdateCartItemPayload,
} from "../api/buyer.api";
import type { WireOrder } from "../api/order.api";
import type { WireVoucher, EvaluateVoucherResult } from "../api/voucher.api";

export interface ICatalogRepository {
  getProducts(params?: GetProductsParams): Promise<WireCatalogProductItem[]>;
  getProductsPaginated(params?: GetProductsParams): Promise<PaginatedEnvelope<WireCatalogProductItem>>;
  getProductById(id: string): Promise<WireCatalogProductDetail>;
  getSellerProductById?(id: string): Promise<WireCatalogProductDetail>;
  updateSellerProduct?(id: string, input: Partial<Pick<WireCatalogProductDetail, "product_name" | "description" | "category_id">> & {
    variants?: Array<{ variant_id?: string; variant_name: string; variant_value?: string | null; sku: string; price: string }>;
    images?: Array<{ image_id?: string; media_id?: string; image_url: string; sort_order: number }>;
  }): Promise<WireCatalogProductDetail>;
  createProduct?(data: CreateProductInput): Promise<WireCatalogProductDetail>;
  updateStock?(variantId: string, quantity: number): Promise<unknown>;
  getSellerProducts(params?: { limit?: number; cursor?: string; search?: string; status?: string }): Promise<WireCatalogProductItem[]>;
  getSellerProductsPaginated(params?: { limit?: number; cursor?: string; search?: string; status?: string }): Promise<PaginatedEnvelope<WireCatalogProductItem>>;
  updateProductStatus?(productId: string, status: "ACTIVE" | "INACTIVE"): Promise<unknown>;
}

export interface IBuyerRepository {
  getProfile(): Promise<WireProfile>;
  updateProfile(data: Partial<Pick<WireProfile, "full_name" | "phone" | "avatar_url">>): Promise<WireProfile>;
  getAddresses(): Promise<WireAddress[]>;
  createAddress(data: CreateAddressPayload): Promise<WireAddress>;
  getCart(): Promise<WireCart>;
  addToCart(variantId: string, quantity: number): Promise<WireCartItemResponse | unknown>;
  updateCartItem?(itemId: string, patch: UpdateCartItemPayload): Promise<WireCartItemResponse>;
  removeCartItem?(itemId: string): Promise<void>;
  removeSelectedCartItems?(): Promise<void>;
}

export interface IOrderRepository {
  getOrders(params?: { status?: string; shop_id?: string }): Promise<WireOrder[]>;
  getOrdersPaginated?(params?: { status?: string; limit?: number; cursor?: string }): Promise<PaginatedEnvelope<WireOrder>>;
  getOrderById(id: string): Promise<WireOrder>;
  cancelOrder(id: string, reason: string): Promise<WireOrder>;
  confirmOrder(id: string, reason?: string): Promise<WireOrder>;
  confirmReceived?(id: string): Promise<WireOrder>;
  transitionOrder(id: string, to: string, reason?: string): Promise<WireOrder>;
}

export interface IVoucherRepository {
  getVouchers(shopId?: string): Promise<WireVoucher[]>;
  evaluateVoucher(code: string, orderSubtotal: string, shopId?: string): Promise<EvaluateVoucherResult>;
}

export interface CreateReviewPayload {
  order_id: string;
  order_item_id: string;
    product_id?: string;
  rating: number; // 1-5
  comment: string;
  media_urls?: string[];
}

export interface WireReview {
  review_id: string;
  order_item_id: string;
  rating: number;
  comment: string;
  media_urls?: string[];
  created_at: string;
}

export interface IReviewRepository {
  createReview(payload: CreateReviewPayload): Promise<WireReview>;
  getReviewsByProduct(productId: string): Promise<WireReview[]>;
}

export interface AdminUserItem {
  id: string;
  email: string;
  full_name: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  status: "ACTIVE" | "LOCKED";
  created_at: string;
}

export interface LockUserPayload {
  user_id: string;
  reason: string;
}

export type ShopStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "LOCKED";

export interface AdminShopItem {
  shop_id: string;
  owner_id: string;
  shop_name: string;
  description: string | null;
  logo_url: string | null;
  pickup_address: string | null;
  contact_phone: string | null;
  status: ShopStatus;
  product_count: number;
  owner_email?: string;
  owner_name?: string;
  created_at: string;
  updated_at: string;
}

export interface LockShopPayload {
  shop_id: string;
  reason: string;
}

export interface IAdminRepository {
  getUsers(params?: { status?: string; role?: string; search?: string }): Promise<AdminUserItem[]>;
  getUserDetail?(userId: string): Promise<AdminUserItem>;
  getUsersPage?(params?: { status?: string; role?: string; search?: string; cursor?: string; limit?: number }): Promise<{ items: AdminUserItem[]; next_cursor: string | null; has_more: boolean }>;
  lockUser(payload: LockUserPayload): Promise<void>;
  unlockUser(userId: string): Promise<void>;
  getShops(params?: { status?: string; search?: string }): Promise<AdminShopItem[]>;
  getShopDetail?(shopId: string): Promise<AdminShopItem>;
  getShopsPage?(params?: { status?: string; search?: string; cursor?: string; limit?: number }): Promise<{ items: AdminShopItem[]; next_cursor: string | null; has_more: boolean }>;
  approveShop(shopId: string, reason?: string): Promise<void>;
  lockShop(payload: LockShopPayload): Promise<void>;
  unlockShop(shopId: string, reason?: string): Promise<void>;
}

export interface ISellerRepository {
  getKpi(): Promise<import('../../features/admin/admin.types').SellerKPIStats>;
  getRevenueReport(filter?: { from?: string; to?: string }): Promise<import('../api/seller-report.api').SellerRevenueReport>;
}

export interface UploadMediaResult {
  media_id?: string;
  url: string;
}

export interface IMediaRepository {
  uploadImage(file: File, purpose?: string): Promise<UploadMediaResult>;
  presign?(filename: string, contentType: string, purpose?: string): Promise<unknown>;
  finalize?(mediaId: string, magicBytes?: string): Promise<unknown>;
  deleteMedia?(mediaId: string): Promise<void>;
}


