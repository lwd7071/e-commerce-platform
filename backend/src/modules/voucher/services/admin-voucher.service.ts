import type { Pool } from 'pg';
import { withTransaction } from '../../../../db/transaction.ts';
import { PgAuditRepository } from '../../../platform/audit/pg-audit.repository.ts';
import { ConflictError, NotFoundError, ReasonRequiredError, ValidationFailedError } from '../../../platform/errors/app-error.ts';
import { validateVoucherFields } from './seller-voucher.service.ts';
import type { SellerVoucher } from '../domain/seller-voucher.types.ts';

const columns = `voucher_id,code,voucher_name,scope,shop_id,discount_type,discount_value::text,max_discount::text,min_order_value::text,quantity,start_at,end_at,status,created_at,updated_at`;
type AdminVoucher = Omit<SellerVoucher, 'scope' | 'shop_id'> & { scope: 'PLATFORM' | 'SHOP'; shop_id: string | null };

export class AdminVoucherService {
  private readonly audit = new PgAuditRepository();
  constructor(private readonly pool: Pool) {}

  async list(): Promise<AdminVoucher[]> {
    const result = await this.pool.query(`SELECT ${columns} FROM vouchers ORDER BY created_at DESC,voucher_id DESC`);
    return result.rows.map(mapVoucher);
  }

  async create(adminId: string, input: Record<string, unknown>): Promise<AdminVoucher> {
    const reason = requiredReason(input.reason);
    const fields = validateVoucherFields(input);
    return withTransaction(this.pool, async client => {
      const result = await client.query(
        `INSERT INTO vouchers (voucher_id,code,voucher_name,scope,shop_id,discount_type,discount_value,max_discount,min_order_value,quantity,start_at,end_at,status)
         VALUES ($1,$2,$3,'PLATFORM',NULL,$4,$5,$6,$7,$8,$9,$10,'ACTIVE') RETURNING ${columns}`,
        [crypto.randomUUID(), fields.code, fields.voucher_name, fields.discount_type, fields.discount_value, fields.max_discount, fields.min_order_value, fields.quantity, fields.start_at, fields.end_at],
      );
      const voucher = mapVoucher(result.rows[0]);
      await this.audit.logAdminAction(client, { admin_id: adminId, action: 'CREATE_PLATFORM_VOUCHER', target_type: 'VOUCHER', target_id: voucher.voucher_id, reason });
      return voucher;
    });
  }

  async update(adminId: string, voucherId: string, input: Record<string, unknown>): Promise<AdminVoucher> {
    const reason = requiredReason(input.reason);
    return withTransaction(this.pool, async client => {
      const found = await client.query(`SELECT ${columns} FROM vouchers WHERE voucher_id=$1 AND scope='PLATFORM' AND shop_id IS NULL FOR UPDATE`, [voucherId]);
      if (!found.rows[0]) throw new NotFoundError('Platform voucher was not found');
      const used = await client.query('SELECT 1 FROM voucher_usages WHERE voucher_id=$1 LIMIT 1', [voucherId]);
      if (used.rowCount) throw new ConflictError('VOUCHER_ALREADY_USED', 'A used voucher can only change status.');
      const fields = validateVoucherFields({ ...mapVoucher(found.rows[0]), ...input });
      const result = await client.query(
        `UPDATE vouchers SET code=$1,voucher_name=$2,discount_type=$3,discount_value=$4,max_discount=$5,min_order_value=$6,quantity=$7,start_at=$8,end_at=$9,updated_at=now()
          WHERE voucher_id=$10 AND scope='PLATFORM' AND shop_id IS NULL RETURNING ${columns}`,
        [fields.code, fields.voucher_name, fields.discount_type, fields.discount_value, fields.max_discount, fields.min_order_value, fields.quantity, fields.start_at, fields.end_at, voucherId],
      );
      await this.audit.logAdminAction(client, { admin_id: adminId, action: 'UPDATE_PLATFORM_VOUCHER', target_type: 'VOUCHER', target_id: voucherId, reason });
      return mapVoucher(result.rows[0]);
    });
  }

  async setStatus(adminId: string, voucherId: string, status: unknown, rawReason: unknown): Promise<AdminVoucher> {
    if (status !== 'ACTIVE' && status !== 'INACTIVE') throw new ValidationFailedError('Status must be ACTIVE or INACTIVE');
    const reason = requiredReason(rawReason);
    return withTransaction(this.pool, async client => {
      const current = await client.query('SELECT quantity FROM vouchers WHERE voucher_id=$1 AND scope=\'PLATFORM\' AND shop_id IS NULL FOR UPDATE', [voucherId]);
      if (!current.rows[0]) throw new NotFoundError('Platform voucher was not found');
      if (status === 'ACTIVE' && Number(current.rows[0].quantity) === 0) throw new ValidationFailedError('A voucher with no remaining quantity cannot be activated', { field: 'quantity' });
      const result = await client.query(
        `UPDATE vouchers SET status=$1,updated_at=now() WHERE voucher_id=$2 AND scope='PLATFORM' AND shop_id IS NULL RETURNING ${columns}`,
        [status, voucherId],
      );
      if (!result.rows[0]) throw new NotFoundError('Platform voucher was not found');
      await this.audit.logAdminAction(client, { admin_id: adminId, action: `${status}_PLATFORM_VOUCHER`, target_type: 'VOUCHER', target_id: voucherId, reason });
      return mapVoucher(result.rows[0]);
    });
  }
}

function requiredReason(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new ReasonRequiredError();
  return value.trim();
}

function mapVoucher(row: Record<string, unknown>): AdminVoucher {
  const timestamp = (value: unknown) => value instanceof Date ? value.toISOString() : String(value);
  return {
    voucher_id: String(row.voucher_id), code: String(row.code), voucher_name: String(row.voucher_name), scope: row.scope as AdminVoucher['scope'], shop_id: row.shop_id == null ? null : String(row.shop_id),
    discount_type: row.discount_type as SellerVoucher['discount_type'], discount_value: String(row.discount_value), max_discount: row.max_discount == null ? null : String(row.max_discount),
    min_order_value: String(row.min_order_value), quantity: Number(row.quantity), start_at: timestamp(row.start_at), end_at: timestamp(row.end_at),
    status: row.status as SellerVoucher['status'], created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at),
  };
}
