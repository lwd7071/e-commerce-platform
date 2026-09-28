import { apiClient } from "./client";

export interface WireProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: string;
  original_price: string | null;
  category_id: string;
  shop_id: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  media?: Array<{ id: string; url: string; is_primary: boolean }>;
  variants?: Array<{
    id: string;
    sku: string;
    name: string;
    price: string;
    stock: number;
  }>;
}

export const catalogApi = {
  getProducts: (params?: { cursor?: string; limit?: number; category_id?: string; q?: string }) => {
    return apiClient.get<WireProduct[]>("/products", { params, skipAuth: true });
  },

  getProductById: (id: string) => {
    return apiClient.get<WireProduct>(`/products/${id}`, { skipAuth: true });
  },
};
