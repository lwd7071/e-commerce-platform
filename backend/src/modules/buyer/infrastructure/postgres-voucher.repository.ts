import type { IVoucherRepository } from '../domain/repositories';
import type { UUID, Voucher, VoucherUsage } from '../domain/types';
import type { IDbClient } from './db-client';
import { mapVoucher, mapVoucherUsage } from './row-mappers';

/**
 * SOLID Design Principles:
 * - Single Responsibility (S): Quản lý đọc/ghi Voucher và VoucherUsage vào PostgreSQL.
 * - Dependency Inversion (D): Nhận IDbClient trừu tượng qua constructor injection.
 * - Liskov Substitution (L): Tuân thủ hoàn toàn IVoucherRepository interface contract.
 */
export class PostgresVoucherRepository implements IVoucherRepository {
  constructor(private readonly db: IDbClient) {}

  async findById(voucherId: UUID): Promise<Voucher | null> {
    const sql = `SELECT voucher_id, code, voucher_name, scope, shop_id, discount_type, discount_value, max_discount, min_order_value, quantity, start_at, end_at, status, created_at, updated_at FROM vouchers WHERE voucher_id = $1`;
    const result = await this.db.query(sql, [voucherId]);
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    return mapVoucher(result.rows[0]);
  }

  async findByCode(code: string): Promise<Voucher | null> {
    const sql = `SELECT voucher_id, code, voucher_name, scope, shop_id, discount_type, discount_value, max_discount, min_order_value, quantity, start_at, end_at, status, created_at, updated_at FROM vouchers WHERE code = $1`;
    const result = await this.db.query(sql, [code]);
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    return mapVoucher(result.rows[0]);
  }

  async listActive(scope?: 'PLATFORM' | 'SHOP', shopId?: UUID): Promise<Voucher[]> {
    let sql = `SELECT voucher_id, code, voucher_name, scope, shop_id, discount_type, discount_value, max_discount, min_order_value, quantity, start_at, end_at, status, created_at, updated_at FROM vouchers WHERE status = 'ACTIVE' AND start_at <= now() AND end_at > now() AND quantity > 0`;
    const params: unknown[] = [];
    if (scope === 'PLATFORM') {
      sql += ` AND scope = 'PLATFORM'`;
    } else if (scope === 'SHOP') {
      sql += ` AND scope = 'SHOP'`;
      if (shopId) {
        params.push(shopId);
        sql += ` AND shop_id = $${params.length}`;
      }
    }
    sql += ` ORDER BY created_at DESC`;
    const result = await this.db.query(sql, params);
    return (result.rows ?? []).map(mapVoucher);
  }

  async create(voucher: Voucher): Promise<Voucher> {
    const sql = `
      INSERT INTO vouchers (
        voucher_id, code, voucher_name, scope, shop_id,
        discount_type, discount_value, max_discount, min_order_value,
        quantity, start_at, end_at, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, COALESCE($14::timestamptz, now()), now())
      RETURNING voucher_id, code, voucher_name, scope, shop_id,
                discount_type, discount_value, max_discount, min_order_value,
                quantity, start_at, end_at, status, created_at, updated_at
    `;
    const params = [
      voucher.voucherId,
      voucher.code,
      voucher.voucherName,
      voucher.scope,
      voucher.shopId,
      voucher.discountType,
      voucher.discountValue,
      voucher.maxDiscount,
      voucher.minOrderValue,
      voucher.quantity,
      voucher.startAt,
      voucher.endAt,
      voucher.status,
      voucher.createdAt ?? null,
    ];
    const result = await this.db.query(sql, params);
    return mapVoucher(result.rows[0]);
  }

  async decrementQuantity(voucherId: UUID): Promise<boolean> {
    const sql = `UPDATE vouchers SET quantity = quantity - 1, updated_at = now() WHERE voucher_id = $1 AND quantity > 0`;
    const result = await this.db.query(sql, [voucherId]);
    return (result.rowCount ?? 0) > 0;
  }

  async incrementQuantity(voucherId: UUID): Promise<boolean> {
    const sql = `UPDATE vouchers SET quantity = quantity + 1, updated_at = now() WHERE voucher_id = $1`;
    const result = await this.db.query(sql, [voucherId]);
    return (result.rowCount ?? 0) > 0;
  }

  async recordUsage(usage: VoucherUsage): Promise<VoucherUsage> {
    const sql = `
      INSERT INTO voucher_usages (
        usage_id, voucher_id, order_id, buyer_id, discount_amount, used_at
      )
      VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()))
      RETURNING usage_id, voucher_id, order_id, buyer_id, discount_amount, used_at
    `;
    const params = [
      usage.usageId,
      usage.voucherId,
      usage.orderId,
      usage.buyerId,
      usage.discountAmount,
      usage.usedAt ?? null,
    ];
    const result = await this.db.query(sql, params);
    return mapVoucherUsage(result.rows[0]);
  }
}
