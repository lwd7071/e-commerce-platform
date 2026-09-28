import { apiClient } from "./client";
import type { PaginatedEnvelope } from "./types";

export type DecimalString = string;

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
  status: "ACTIVE";
  variants: WireProductVariant[];
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
  category_id: string;
  product_name: string;
  description?: string | null;
  images?: Array<{ image_url: string; sort_order?: number }>;
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
};

