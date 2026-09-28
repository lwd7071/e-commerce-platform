/**
 * Cart domain types for Dino E-Commerce (Người 4 - B-402, B-403).
 */

export interface CartItem {
  id: string; // cart_item_id
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  price: string; // Decimal string e.g. "289000.00"
  originalPrice?: string | null;
  quantity: number;
  stock: number;
  shopId: string;
  shopName: string;
  imageUrl: string | null;
  isSelected: boolean;
}

export interface CartGroup {
  shopId: string;
  shopName: string;
  items: CartItem[];
}

export interface CartSummary {
  totalItems: number;
  selectedCount: number;
  subtotal: number;
  subtotalFormatted: string;
}
