import { apiClient } from "./client";
import type { PaginatedEnvelope } from "./types";

export type DecimalString = string;

export interface WireCategoryDTO {
  category_id: string;
  parent_category_id: string | null;
  category_name: string;
  description: string | null;
}

/**
 * Wire DTO cho từng sản phẩm trong danh sách GET /products (B-301)
 * Tuân thủ đúng 100% mục 2 của docs/frontend-spec/04-data-model.md
 */
export interface WireCatalogProductItem {
  product_id: string;
  product_name: string;
  shop_id: string;
  category_id: string;
  min_price: DecimalString;
  max_price: DecimalString;
  total_stock: number;
  image_url: string | null;
  created_at: string;
  status?: "ACTIVE" | "INACTIVE" | "HIDDEN";
}

export type VariantStatus = "ACTIVE" | "INACTIVE";

export interface WireProductVariant {
  variant_id: string;
  variant_name: string;
  variant_value: string | null;
  sku: string;
  price: DecimalString;
  stock_quantity: number;
  status: VariantStatus;
}

/**
 * Wire DTO cho chi tiết sản phẩm GET /products/:id (B-302)
 * Tuân thủ đúng 100% mục 2 của docs/frontend-spec/04-data-model.md
 */
export interface WireCatalogProductDetail {
  product_id: string;
  shop_id: string;
  category_id: string;
  product_name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE" | "HIDDEN";
  variants: WireProductVariant[];
  images?: Array<{ image_id?: string; image_url: string; sort_order?: number }>;
  image_url?: string | null;
}

/**
 * Query params chuẩn hóa cho GET /products (B-301)
 * Tuân thủ đúng mục 3 của docs/frontend-spec/05-api-contract.md
 */
export interface GetProductsParams {
  category_id?: string;
  search?: string;
  min_price?: DecimalString;
  max_price?: DecimalString;
  sort?: "price_asc" | "price_desc" | "created_at_desc";
  limit?: number;
  cursor?: string;
}

/**
 * Payload tạo sản phẩm POST /products (Seller)
 */
export interface CreateProductInput {
  product_id?: string;
  category_id: string;
  product_name: string;
  description?: string | null;
  images?: Array<{ image_url: string; sort_order?: number; media_id?: string }>;
  variants: Array<{
    variant_name: string;
    variant_value?: string | null;
    sku: string;
    price: DecimalString;
    stock_quantity: number;
  }>;
}

/**
 * Tương thích ngược với scaffold cũ
 */
export type WireProduct = WireCatalogProductItem;

export const catalogApi = {
  getCategories: () => apiClient.get<WireCategoryDTO[]>('/categories', { skipAuth: true }),
  getProducts: (params?: GetProductsParams) => {
    return apiClient.get<WireCatalogProductItem[]>("/products", { params: params as Record<string, string | number | boolean | undefined>, skipAuth: true });
  },

  getProductsPaginated: (params?: GetProductsParams): Promise<PaginatedEnvelope<WireCatalogProductItem>> => {
    return apiClient.getPaginated<WireCatalogProductItem>("/products", {
      params: params as Record<string, string | number | boolean | undefined>,
      skipAuth: true,
    });
  },

  getProductById: (id: string) => {
    return apiClient.get<WireCatalogProductDetail>(`/products/${id}`, { skipAuth: true });
  },

  createProduct: (body: CreateProductInput) => {
    return apiClient.post<WireCatalogProductDetail>("/products", body);
  },

  updateVariantStock: (variantId: string, quantity: number) => {
    return apiClient.patch<{ variant_id: string; stock_quantity: number }>(
      `/product-variants/${variantId}/stock`,
      { quantity }
    );
  },

  getSellerProducts: (params?: { limit?: number; cursor?: string; search?: string; status?: string }) => {
    return apiClient.getPaginated<WireCatalogProductItem>("/seller/products", {
      params: params as Record<string, string | number | boolean | undefined>,
    }).then((page) => page.data);
  },

  getSellerProductsPaginated: (params?: { limit?: number; cursor?: string; search?: string; status?: string }) => {
    return apiClient.getPaginated<WireCatalogProductItem>("/seller/products", {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  },

  getSellerProductById: (id: string) =>
    apiClient.get<WireCatalogProductDetail>(`/seller/products/${id}`),

  updateSellerProduct: (id: string, input: Partial<Pick<WireCatalogProductDetail, "product_name" | "description" | "category_id">> & { variants?: Array<{ variant_id?: string; variant_name: string; variant_value?: string | null; sku: string; price: string }> }) =>
    apiClient.patch<WireCatalogProductDetail>(`/seller/products/${id}`, input),

  updateProductStatus: (productId: string, status: "ACTIVE" | "INACTIVE") => {
    return apiClient.patch<{ product_id: string; status: "ACTIVE" | "INACTIVE" }>(
      `/products/${productId}/status`,
      { status }
    );
  },
};

