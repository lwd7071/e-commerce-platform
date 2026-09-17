import type { ICartRepository } from '../domain/repositories';
import type { UUID, Cart, CartItem } from '../domain/types';
import type { IDbClient } from './db-client';
import { mapCart, mapCartItem } from './row-mappers';

/**
 * SOLID Design Principles:
 * - Single Responsibility (S): Quản lý việc đọc/ghi Cart và CartItem aggregate vào PostgreSQL.
 * - Dependency Inversion (D): Nhận IDbClient trừu tượng qua constructor injection.
 * - Liskov Substitution (L): Tuân thủ hoàn toàn ICartRepository interface contract.
 */
export class PostgresCartRepository implements ICartRepository {
  constructor(private readonly db: IDbClient) {}

  async findByBuyerId(buyerId: UUID): Promise<Cart | null> {
    const sql = `SELECT cart_id, buyer_id, created_at, updated_at FROM carts WHERE buyer_id = $1`;
    const result = await this.db.query(sql, [buyerId]);
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    return mapCart(result.rows[0]);
  }

  async createCart(cart: Cart): Promise<Cart> {
    const sql = `
      INSERT INTO carts (cart_id, buyer_id, created_at, updated_at)
      VALUES ($1, $2, COALESCE($3::timestamptz, now()), now())
      RETURNING cart_id, buyer_id, created_at, updated_at
    `;
    const params = [cart.cartId, cart.buyerId, cart.createdAt ?? null];
    const result = await this.db.query(sql, params);
    return mapCart(result.rows[0]);
  }

  async getItems(cartId: UUID): Promise<CartItem[]> {
    const sql = `SELECT cart_item_id, cart_id, variant_id, quantity, is_selected, created_at, updated_at FROM cart_items WHERE cart_id = $1 ORDER BY created_at ASC`;
    const result = await this.db.query(sql, [cartId]);
    return (result.rows ?? []).map(mapCartItem);
  }

  async addItem(cartId: UUID, item: CartItem): Promise<CartItem> {
    const sql = `
      INSERT INTO cart_items (
        cart_item_id, cart_id, variant_id, quantity, is_selected, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()), now())
      ON CONFLICT (cart_id, variant_id) DO UPDATE
      SET quantity = cart_items.quantity + EXCLUDED.quantity,
          updated_at = now()
      RETURNING cart_item_id, cart_id, variant_id, quantity, is_selected, created_at, updated_at
    `;
    const params = [
      item.cartItemId,
      cartId,
      item.variantId,
      item.quantity,
      item.isSelected ?? false,
      item.createdAt ?? null,
    ];
    const result = await this.db.query(sql, params);
    return mapCartItem(result.rows[0]);
  }

  async updateItem(item: CartItem): Promise<CartItem> {
    const sql = `
      UPDATE cart_items
      SET quantity = $2,
          is_selected = $3,
          updated_at = now()
      WHERE cart_item_id = $1
      RETURNING cart_item_id, cart_id, variant_id, quantity, is_selected, created_at, updated_at
    `;
    const params = [item.cartItemId, item.quantity, item.isSelected];
    const result = await this.db.query(sql, params);
    if (!result.rows || result.rows.length === 0) {
      throw new Error(`CartItem not found: ${item.cartItemId}`);
    }
    return mapCartItem(result.rows[0]);
  }

  async removeItem(cartItemId: UUID): Promise<void> {
    const sql = `DELETE FROM cart_items WHERE cart_item_id = $1`;
    await this.db.query(sql, [cartItemId]);
  }

  async clearCheckedOutItems(buyerId: UUID, cartItemIds: UUID[]): Promise<void> {
    if (cartItemIds.length === 0) return;
    const sql = `
      DELETE FROM cart_items
      WHERE cart_item_id = ANY($1)
        AND cart_id IN (SELECT cart_id FROM carts WHERE buyer_id = $2)
    `;
    await this.db.query(sql, [cartItemIds, buyerId]);
  }
}
