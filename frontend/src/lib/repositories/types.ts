import type {
  WireCatalogProductItem,
  WireCatalogProductDetail,
  GetProductsParams,
  CreateProductInput,
} from "../api/catalog.api";
import type { PaginatedEnvelope } from "../api/types";
import type { WireCart, WireAddress, WireProfile } from "../api/buyer.api";
import type { WireOrder } from "../api/order.api";
import type { WireVoucher, EvaluateVoucherResult } from "../api/voucher.api";

export interface ICatalogRepository {
  getProducts(params?: GetProductsParams): Promise<WireCatalogProductItem[]>;
  getProductsPaginated?(params?: GetProductsParams): Promise<PaginatedEnvelope<WireCatalogProductItem>>;
  getProductById(id: string): Promise<WireCatalogProductDetail>;
  createProduct?(data: CreateProductInput): Promise<WireCatalogProductDetail>;
  updateStock?(variantId: string, quantity: number): Promise<unknown>;
}

export interface IBuyerRepository {
  getProfile(): Promise<WireProfile>;
  updateProfile(data: Partial<Pick<WireProfile, "full_name" | "phone" | "avatar_url">>): Promise<WireProfile>;
  getAddresses(): Promise<WireAddress[]>;
  createAddress(data: Omit<WireAddress, "id">): Promise<WireAddress>;
  getCart(): Promise<WireCart>;
  addToCart(variantId: string, quantity: number): Promise<unknown>;
}

export interface IOrderRepository {
  getOrders(params?: { status?: string }): Promise<WireOrder[]>;
  getOrderById(id: string): Promise<WireOrder>;
  cancelOrder(id: string, reason: string): Promise<WireOrder>;
  confirmOrder(id: string, reason?: string): Promise<WireOrder>;
  transitionOrder(id: string, to: string, reason?: string): Promise<WireOrder>;
}

export interface IVoucherRepository {
  getVouchers(): Promise<WireVoucher[]>;
  evaluateVoucher(code: string, orderSubtotal: string, shopId?: string): Promise<EvaluateVoucherResult>;
}
