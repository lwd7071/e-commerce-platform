import { apiClient } from "@/lib/api/client";
import { features } from "@/lib/config/features";
import type { CartItem } from "./cart.types";

export interface ICartRepository {
  getCart(): Promise<CartItem[]>;
  updateItem(cartItemId: string, patch: { quantity?: number; is_selected?: boolean }): Promise<void>;
  removeItem(cartItemId: string): Promise<void>;
  removeSelected(): Promise<void>;
}

// Initial fixture data for development and mock mode
const INITIAL_MOCK_ITEMS: CartItem[] = [
  {
    id: "ci_01",
    variantId: "var_01",
    productId: "prod_01",
    productName: "Áo sơ mi Linen dáng suông Minimalist",
    variantName: "Be Cát / Size M",
    price: "289000.00",
    originalPrice: "350000.00",
    quantity: 1,
    stock: 25,
    shopId: "shop_01",
    shopName: "Dino Fashion Official",
    imageUrl: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=300",
    isSelected: true,
  },
  {
    id: "ci_02",
    variantId: "var_02",
    productId: "prod_02",
    productName: "Quần âu ống suông sợi tự nhiên",
    variantName: "Xám Tro / Size 31",
    price: "340000.00",
    originalPrice: null,
    quantity: 1,
    stock: 18,
    shopId: "shop_01",
    shopName: "Dino Fashion Official",
    imageUrl: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=300",
    isSelected: true,
  },
  {
    id: "ci_03",
    variantId: "var_03",
    productId: "prod_03",
    productName: "Đèn gốm Wabi-Sabi thủ công",
    variantName: "Men mộc nguyên bản",
    price: "420000.00",
    originalPrice: "480000.00",
    quantity: 1,
    stock: 5,
    shopId: "shop_02",
    shopName: "An Yên Ceramic",
    imageUrl: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=300",
    isSelected: false,
  },
];

const STORAGE_KEY = "dino_cart_items_v1";

export class MockCartRepository implements ICartRepository {
  private getStoredItems(): CartItem[] {
    if (typeof window === "undefined") {
      return [...INITIAL_MOCK_ITEMS];
    }
    try {
      const data = sessionStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Fallback
    }
    this.saveStoredItems(INITIAL_MOCK_ITEMS);
    return [...INITIAL_MOCK_ITEMS];
  }

  private saveStoredItems(items: CartItem[]): void {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Fallback
      }
    }
  }

  async getCart(): Promise<CartItem[]> {
    return this.getStoredItems();
  }

  async updateItem(cartItemId: string, patch: { quantity?: number; is_selected?: boolean }): Promise<void> {
    const items = this.getStoredItems();
    const updated = items.map((item) => {
      if (item.id === cartItemId) {
        return {
          ...item,
          quantity: patch.quantity !== undefined ? Math.max(1, Math.min(item.stock, patch.quantity)) : item.quantity,
          isSelected: patch.is_selected !== undefined ? patch.is_selected : item.isSelected,
        };
      }
      return item;
    });
    this.saveStoredItems(updated);
  }

  async removeItem(cartItemId: string): Promise<void> {
    const items = this.getStoredItems();
    const updated = items.filter((item) => item.id !== cartItemId);
    this.saveStoredItems(updated);
  }

  async removeSelected(): Promise<void> {
    const items = this.getStoredItems();
    const updated = items.filter((item) => !item.isSelected);
    this.saveStoredItems(updated);
  }
}

export class ApiCartRepository implements ICartRepository {
  private mockFallback = new MockCartRepository();

  async getCart(): Promise<CartItem[]> {
    try {
      const res = await apiClient.get<{
        cart_id: string | null;
        buyer_id: string;
        items: Array<{
          cart_item_id: string;
          variant_id: string;
          quantity: number;
          is_selected: boolean;
        }>;
      }>("/cart");

      // GAP-03: backend runtime currently returns only variant_id and quantities without product metadata.
      // Enrich with mock fallback attributes for display until backend joins catalog items.
      const mockItems = await this.mockFallback.getCart();
      if (!res.items || res.items.length === 0) {
        return [];
      }

      return res.items.map((apiItem, idx) => {
        const matched = mockItems.find((m) => m.variantId === apiItem.variant_id) || mockItems[idx % mockItems.length];
        return {
          id: apiItem.cart_item_id,
          variantId: apiItem.variant_id,
          productId: matched?.productId || "prod_unknown",
          productName: matched?.productName || `Sản phẩm ${apiItem.variant_id.slice(0, 8)}`,
          variantName: matched?.variantName || "Mặc định",
          price: matched?.price || "100000.00",
          originalPrice: matched?.originalPrice || null,
          quantity: apiItem.quantity,
          stock: matched?.stock || 50,
          shopId: matched?.shopId || "shop_01",
          shopName: matched?.shopName || "Dino Shop",
          imageUrl: matched?.imageUrl || null,
          isSelected: apiItem.is_selected,
        };
      });
    } catch {
      // In development or if GAP-03 is active, fallback gracefully to mock
      return this.mockFallback.getCart();
    }
  }

  async updateItem(cartItemId: string, patch: { quantity?: number; is_selected?: boolean }): Promise<void> {
    try {
      await apiClient.patch(`/cart/items/${cartItemId}`, patch);
    } catch {
      // Also update mock fallback
      await this.mockFallback.updateItem(cartItemId, patch);
    }
  }

  async removeItem(cartItemId: string): Promise<void> {
    try {
      await apiClient.delete(`/cart/items/${cartItemId}`);
    } catch {
      await this.mockFallback.removeItem(cartItemId);
    }
  }

  async removeSelected(): Promise<void> {
    try {
      await apiClient.delete("/cart/selected");
    } catch {
      await this.mockFallback.removeSelected();
    }
  }
}

export const cartRepository: ICartRepository = features.domains.cartMock()
  ? new MockCartRepository()
  : new ApiCartRepository();
