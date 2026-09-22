import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCartQuantity, addItemToCart, createBuyerCart } from '../../../src/modules/buyer/domain/cart';
import { ValidationError, CartConflictError } from '../../../src/modules/buyer/domain/errors';
import type { Cart, CartItem } from '../../../src/modules/buyer/domain/types';

describe('Cart & CartItem Domain Tests (RB-MG05, RB-LB03, RB-LB04)', () => {

  describe('Slice 1: Validate số lượng dòng giỏ (RB-MG05)', () => {
    it('[RB-MG05] addCartItem({quantity: 0}) -> reject VALIDATION_FAILED', () => {
      assert.throws(
        () => validateCartQuantity(0),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[RB-MG05] addCartItem({quantity: -1}) -> reject VALIDATION_FAILED', () => {
      assert.throws(
        () => validateCartQuantity(-1),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[RB-MG05] CART-03: quantity = 1.5 (số thập phân) -> reject VALIDATION_FAILED', () => {
      assert.throws(
        () => validateCartQuantity(1.5),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[RB-MG05] addCartItem({quantity: 1}) -> accept (biên dưới)', () => {
      assert.doesNotThrow(() => validateCartQuantity(1));
    });

    it('[RB-MG05] quantity = 10 -> accept', () => {
      assert.doesNotThrow(() => validateCartQuantity(10));
    });
  });

  describe('Slice 2: Cộng dồn variant trùng (RB-LB04)', () => {
    const existingItems: CartItem[] = [
      {
        cartItemId: 'item-1',
        cartId: 'cart-1',
        variantId: 'V1',
        quantity: 2,
        isSelected: true,
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
      },
    ];

    it('[RB-LB04] addCartItem(cart with existing variantId=V1 qty=2, new item variantId=V1 qty=3) -> kết quả 1 dòng, quantity=5 (không tạo dòng mới)', () => {
      const result = addItemToCart(existingItems, { cartId: 'cart-1', variantId: 'V1', quantity: 3 });
      assert.equal(result.length, 1);
      assert.equal(result[0].variantId, 'V1');
      assert.equal(result[0].quantity, 5);
      assert.equal(result[0].cartItemId, 'item-1'); // Giữ nguyên ID
    });

    it('[RB-LB04] addCartItem(cart rỗng, variantId=V1 qty=2) -> tạo dòng mới quantity=2', () => {
      const result = addItemToCart([], { cartId: 'cart-1', variantId: 'V1', quantity: 2 });
      assert.equal(result.length, 1);
      assert.equal(result[0].variantId, 'V1');
      assert.equal(result[0].quantity, 2);
    });

    it('[RB-LB04] CART-08: addCartItem(cart có V1, add variantId=V2 qty=1) -> kết quả 2 dòng riêng biệt', () => {
      const result = addItemToCart(existingItems, { cartId: 'cart-1', variantId: 'V2', quantity: 1 });
      assert.equal(result.length, 2);
      assert.equal(result[0].variantId, 'V1');
      assert.equal(result[1].variantId, 'V2');
    });
  });

  describe('Slice 3: 1 cart / buyer (RB-LB03)', () => {
    it('[RB-LB03] createCart(buyerId=B1) khi B1 đã có cart -> reject CART_CONFLICT', () => {
      const existingCart: Cart = {
        cartId: 'cart-1',
        buyerId: 'B1',
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
      };

      assert.throws(
        () => createBuyerCart('B1', existingCart),
        (err: unknown) => err instanceof CartConflictError && err.code === 'CART_CONFLICT'
      );
    });

    it('[RB-LB03] createCart(buyerId=B1) khi B1 chưa có cart -> tạo cart mới', () => {
      const newCart = createBuyerCart('B1', null);
      assert.equal(newCart.buyerId, 'B1');
      assert.ok(newCart.cartId);
    });
  });

});
