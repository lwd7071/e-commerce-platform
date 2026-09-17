import { ValidationError, CartConflictError } from './errors.ts';
import type { Cart, CartItem, UUID } from './types.ts';
import { randomUUID } from 'node:crypto';

/**
 * [RB-MG05] CartItem.Quantity >= 1
 */
export function validateCartQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ValidationError('Số lượng sản phẩm trong giỏ hàng phải là số nguyên >= 1 (RB-MG05).', {
      quantity,
    });
  }
}

export interface AddItemToCartParams {
  cartId: UUID;
  variantId: UUID;
  quantity: number;
}

/**
 * [RB-LB04] UNIQUE(CartID, VariantID): một biến thể chỉ xuất hiện 1 dòng trong cùng Cart
 * Thêm trùng -> tăng quantity có kiểm soát
 */
export function addItemToCart(existingItems: CartItem[], params: AddItemToCartParams): CartItem[] {
  validateCartQuantity(params.quantity);

  const existingIndex = existingItems.findIndex(item => item.variantId === params.variantId);

  if (existingIndex >= 0) {
    // Tăng quantity dòng hiện có
    const updated = [...existingItems];
    const currentItem = updated[existingIndex];
    updated[existingIndex] = {
      ...currentItem,
      quantity: currentItem.quantity + params.quantity,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  }

  // Tạo dòng mới
  const now = new Date().toISOString();
  const newItem: CartItem = {
    cartItemId: randomUUID(),
    cartId: params.cartId,
    variantId: params.variantId,
    quantity: params.quantity,
    isSelected: true,
    createdAt: now,
    updatedAt: now,
  };

  return [...existingItems, newItem];
}

/**
 * [RB-LB03] Mỗi Buyer chỉ có tối đa 1 Cart
 */
export function createBuyerCart(buyerId: UUID, existingCart: Cart | null): Cart {
  if (existingCart !== null) {
    throw new CartConflictError('Buyer đã có giỏ hàng, không thể tạo thêm (RB-LB03).', { buyerId });
  }

  const now = new Date().toISOString();
  return {
    cartId: randomUUID(),
    buyerId,
    createdAt: now,
    updatedAt: now,
  };
}
