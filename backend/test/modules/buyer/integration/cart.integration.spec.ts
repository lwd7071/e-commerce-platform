import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PostgresCartRepository } from '../../../../src/modules/buyer/infrastructure/postgres-cart.repository';
import { mapCart, mapCartItem } from '../../../../src/modules/buyer/infrastructure/row-mappers';
import { mockCart, mockCartItem1, mockCartItem2, mockBuyerId } from '../fixtures';
import type { IDbClient } from '../../../../src/modules/buyer/infrastructure/db-client';

class MockDbClient {
  public queries: { sql: string; params: any[] }[] = [];
  public customHandler?: (sql: string, params: any[]) => Promise<any>;

  async query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    this.queries.push({ sql: sql.trim(), params });
    if (this.customHandler) {
      return this.customHandler(sql, params);
    }
    return { rows: [], rowCount: 0 };
  }
}

describe('Phase 2 — PostgresCartRepository (SOLID: S, L, D)', () => {
  describe('Row Mappers (SOLID: S — Single Responsibility)', () => {
    it('mapCart: chuyển đổi snake_case sang Cart domain model', () => {
      const row = {
        cart_id: mockCart.cartId,
        buyer_id: mockBuyerId,
        created_at: new Date('2026-09-17T10:00:00.000Z'),
        updated_at: new Date('2026-09-17T11:00:00.000Z'),
      };
      const cart = mapCart(row);
      assert.strictEqual(cart.cartId, mockCart.cartId);
      assert.strictEqual(cart.buyerId, mockBuyerId);
      assert.strictEqual(cart.createdAt, '2026-09-17T10:00:00.000Z');
    });

    it('mapCartItem: chuyển đổi snake_case sang CartItem domain model', () => {
      const row = {
        cart_item_id: mockCartItem1.cartItemId,
        cart_id: mockCart.cartId,
        variant_id: mockCartItem1.variantId,
        quantity: 2,
        is_selected: true,
        created_at: new Date('2026-09-17T10:00:00.000Z'),
        updated_at: new Date('2026-09-17T11:00:00.000Z'),
      };
      const item = mapCartItem(row);
      assert.strictEqual(item.cartItemId, mockCartItem1.cartItemId);
      assert.strictEqual(item.quantity, 2);
      assert.strictEqual(item.isSelected, true);
    });
  });

  describe('PostgresCartRepository operations (SOLID: L, D)', () => {
    it('[TEST-INT-05] findByBuyerId: trả về cart nếu tìm thấy hoặc null nếu chưa có', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({
        rows: [{
          cart_id: mockCart.cartId,
          buyer_id: mockBuyerId,
          created_at: new Date(mockCart.createdAt),
          updated_at: new Date(mockCart.updatedAt),
        }],
        rowCount: 1,
      });

      const repo = new PostgresCartRepository(client as IDbClient);
      const cart = await repo.findByBuyerId(mockBuyerId);

      assert.ok(cart);
      assert.strictEqual(cart.cartId, mockCart.cartId);
      assert.ok(client.queries[0].sql.includes('FROM carts WHERE buyer_id = $1'));
    });

    it('[TEST-INT-05] createCart: tạo giỏ hàng mới cho buyer', async () => {
      const client = new MockDbClient();
      client.customHandler = async (_sql, params) => ({
        rows: [{
          cart_id: params[0],
          buyer_id: params[1],
          created_at: new Date('2026-09-17T10:00:00.000Z'),
          updated_at: new Date('2026-09-17T10:00:00.000Z'),
        }],
        rowCount: 1,
      });

      const repo = new PostgresCartRepository(client as IDbClient);
      const created = await repo.createCart(mockCart);

      assert.strictEqual(created.cartId, mockCart.cartId);
      assert.ok(client.queries[0].sql.includes('INSERT INTO carts'));
    });

    it('[TEST-INT-06] addItem: sử dụng ON CONFLICT (cart_id, variant_id) DO UPDATE để cộng dồn quantity', async () => {
      const client = new MockDbClient();
      client.customHandler = async (_sql, params) => ({
        rows: [{
          cart_item_id: params[0],
          cart_id: params[1],
          variant_id: params[2],
          quantity: 5, // giả sử sau khi cộng dồn
          is_selected: params[4],
          created_at: new Date('2026-09-17T10:00:00.000Z'),
          updated_at: new Date('2026-09-17T11:00:00.000Z'),
        }],
        rowCount: 1,
      });

      const repo = new PostgresCartRepository(client as IDbClient);
      const result = await repo.addItem(mockCart.cartId, mockCartItem1);

      assert.strictEqual(result.quantity, 5);
      const sql = client.queries[0].sql;
      assert.ok(sql.includes('INSERT INTO cart_items'));
      assert.ok(sql.includes('ON CONFLICT (cart_id, variant_id) DO UPDATE'));
      assert.ok(sql.includes('quantity = cart_items.quantity + EXCLUDED.quantity'));
    });

    it('[TEST-INT-07] getItems: trả về danh sách items của cart theo created_at', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({
        rows: [
          {
            cart_item_id: mockCartItem1.cartItemId,
            cart_id: mockCart.cartId,
            variant_id: mockCartItem1.variantId,
            quantity: 2,
            is_selected: true,
            created_at: new Date(mockCartItem1.createdAt),
            updated_at: new Date(mockCartItem1.updatedAt),
          },
        ],
        rowCount: 1,
      });

      const repo = new PostgresCartRepository(client as IDbClient);
      const items = await repo.getItems(mockCart.cartId);

      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].variantId, mockCartItem1.variantId);
      assert.ok(client.queries[0].sql.includes('FROM cart_items WHERE cart_id = $1'));
    });

    it('[TEST-INT-07] updateItem: cập nhật quantity và isSelected của item', async () => {
      const client = new MockDbClient();
      client.customHandler = async (_sql, params) => ({
        rows: [{
          cart_item_id: params[0],
          cart_id: mockCart.cartId,
          variant_id: mockCartItem1.variantId,
          quantity: params[1],
          is_selected: params[2],
          created_at: new Date(mockCartItem1.createdAt),
          updated_at: new Date('2026-09-17T12:00:00.000Z'),
        }],
        rowCount: 1,
      });

      const repo = new PostgresCartRepository(client as IDbClient);
      const updated = await repo.updateItem({ ...mockCartItem1, quantity: 4, isSelected: false });

      assert.strictEqual(updated.quantity, 4);
      assert.strictEqual(updated.isSelected, false);
      assert.ok(client.queries[0].sql.includes('UPDATE cart_items'));
    });

    it('[TEST-INT-07] removeItem: xóa item khỏi giỏ hàng', async () => {
      const client = new MockDbClient();
      const repo = new PostgresCartRepository(client as IDbClient);
      await repo.removeItem(mockCartItem1.cartItemId);

      assert.ok(client.queries[0].sql.includes('DELETE FROM cart_items WHERE cart_item_id = $1'));
      assert.deepStrictEqual(client.queries[0].params, [mockCartItem1.cartItemId]);
    });

    it('[TEST-INT-08] clearCheckedOutItems: xóa các items đã checkout của đúng buyerId', async () => {
      const client = new MockDbClient();
      const repo = new PostgresCartRepository(client as IDbClient);
      await repo.clearCheckedOutItems(mockBuyerId, [mockCartItem1.cartItemId, mockCartItem2.cartItemId]);

      assert.ok(client.queries[0].sql.includes('DELETE FROM cart_items'));
      assert.ok(client.queries[0].sql.includes('cart_item_id = ANY($1)'));
      assert.ok(client.queries[0].sql.includes('buyer_id = $2'));
    });
  });
});
