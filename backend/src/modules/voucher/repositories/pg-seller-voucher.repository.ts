import type { Pool } from 'pg';
import type { RequestContext } from '../../../platform/context/request-context.ts';
import type { ISellerVoucherRepository, SellerVoucher, SellerVoucherFields } from '../domain/seller-voucher.types.ts';

const columns = `voucher_id,code,voucher_name,scope,shop_id,discount_type,discount_value::text,max_discount::text,min_order_value::text,quantity,start_at,end_at,status,created_at,updated_at`;

export class PgSellerVoucherRepository implements ISellerVoucherRepository {
  constructor(private readonly pool: Pool) {}

  async list(shopId: string): Promise<SellerVoucher[]> {
    const result = await this.pool.query(`SELECT ${columns} FROM vouchers WHERE scope='SHOP' AND shop_id=$1 ORDER BY created_at DESC,voucher_id DESC`, [shopId]);
    return result.rows.map(row => this.map(row));
  }

  async find(shopId: string, voucherId: string): Promise<SellerVoucher | null> {
    const result = await this.pool.query(`SELECT ${columns} FROM vouchers WHERE scope='SHOP' AND shop_id=$1 AND voucher_id=$2`, [shopId, voucherId]);
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async create(context: RequestContext, fields: SellerVoucherFields): Promise<SellerVoucher> {
    const result = await this.pool.query(
      `INSERT INTO vouchers (voucher_id,code,voucher_name,scope,shop_id,discount_type,discount_value,max_discount,min_order_value,quantity,start_at,end_at,status)
       VALUES ($1,$2,$3,'SHOP',$4,$5,$6,$7,$8,$9,$10,$11,'ACTIVE') RETURNING ${columns}`,
      [crypto.randomUUID(), fields.code, fields.voucher_name, context.shop_id, fields.discount_type, fields.discount_value, fields.max_discount, fields.min_order_value, fields.quantity, fields.start_at, fields.end_at],
    );
    return this.map(result.rows[0]);
  }

  async updateIfUnused(context: RequestContext, voucherId: string, fields: SellerVoucherFields): Promise<SellerVoucher | null> {
    const result = await this.pool.query(
      `UPDATE vouchers SET code=$1,voucher_name=$2,discount_type=$3,discount_value=$4,max_discount=$5,min_order_value=$6,quantity=$7,start_at=$8,end_at=$9,updated_at=now()
       WHERE voucher_id=$10 AND shop_id=$11 AND scope='SHOP'
         AND NOT EXISTS (SELECT 1 FROM voucher_usages vu WHERE vu.voucher_id=vouchers.voucher_id)
       RETURNING ${columns}`,
      [fields.code, fields.voucher_name, fields.discount_type, fields.discount_value, fields.max_discount, fields.min_order_value, fields.quantity, fields.start_at, fields.end_at, voucherId, context.shop_id],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async setStatus(context: RequestContext, voucherId: string, status: SellerVoucher['status']): Promise<SellerVoucher | null> {
    const result = await this.pool.query(
      `UPDATE vouchers SET status=$1,updated_at=now() WHERE voucher_id=$2 AND shop_id=$3 AND scope='SHOP' RETURNING ${columns}`,
      [status, voucherId, context.shop_id],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async hasUsage(shopId: string, voucherId: string): Promise<boolean> {
    const result = await this.pool.query(`SELECT 1 FROM voucher_usages vu JOIN vouchers v ON v.voucher_id=vu.voucher_id WHERE v.shop_id=$1 AND v.voucher_id=$2 LIMIT 1`, [shopId, voucherId]);
    return (result.rowCount ?? 0) > 0;
  }

  private map(row: Record<string, unknown>): SellerVoucher {
    const timestamp = (value: unknown) => value instanceof Date ? value.toISOString() : String(value);
    return {
      voucher_id: String(row.voucher_id), code: String(row.code), voucher_name: String(row.voucher_name), scope: 'SHOP', shop_id: String(row.shop_id),
      discount_type: row.discount_type as SellerVoucher['discount_type'], discount_value: String(row.discount_value), max_discount: row.max_discount == null ? null : String(row.max_discount),
      min_order_value: String(row.min_order_value), quantity: Number(row.quantity), start_at: timestamp(row.start_at), end_at: timestamp(row.end_at),
      status: row.status as SellerVoucher['status'], created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at),
    };
  }
}
