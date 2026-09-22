import type { Pool, PoolClient } from 'pg';
import type { IPaymentRepository, PaymentRecord, UUID } from '../domain/repositories.ts';
import type { PaymentStatus, PaymentMethod } from '../domain/types.ts';

export const mapPaymentRow = (row: any): PaymentRecord => ({
  paymentId: row.payment_id,
  orderId: row.order_id,
  transactionCode: row.transaction_code,
  method: row.method as PaymentMethod,
  amount: typeof row.amount === 'string' ? row.amount : Number(row.amount).toFixed(2),
  status: row.status as PaymentStatus,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  paidAt: row.paid_at ? (row.paid_at instanceof Date ? row.paid_at.toISOString() : String(row.paid_at)) : null,
  note: row.note,
});

export class PgPaymentRepository implements IPaymentRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private getExecutor(client?: PoolClient): Pool | PoolClient {
    return client ?? this.pool;
  }

  public async createPayment(payment: PaymentRecord, client?: PoolClient): Promise<PaymentRecord> {
    const executor = this.getExecutor(client);
    const sql = `
      INSERT INTO payments (
        payment_id, order_id, transaction_code, method, amount, status, created_at, paid_at, note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const params = [
      payment.paymentId,
      payment.orderId,
      payment.transactionCode || null,
      payment.method,
      payment.amount,
      payment.status,
      payment.createdAt,
      payment.paidAt || null,
      payment.note || null,
    ];
    const result = await executor.query(sql, params);
    return mapPaymentRow(result.rows[0]);
  }

  public async findById(paymentId: UUID, client?: PoolClient): Promise<PaymentRecord | null> {
    const executor = this.getExecutor(client);
    const result = await executor.query('SELECT * FROM payments WHERE payment_id = $1;', [paymentId]);
    if (result.rows.length === 0) return null;
    return mapPaymentRow(result.rows[0]);
  }

  public async findByOrderId(orderId: UUID, client?: PoolClient): Promise<PaymentRecord[]> {
    const executor = this.getExecutor(client);
    const result = await executor.query(
      'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at ASC;',
      [orderId],
    );
    return result.rows.map(mapPaymentRow);
  }

  public async updateStatus(
    paymentId: UUID,
    status: PaymentStatus,
    paidAt?: string | null,
    note?: string | null,
    client?: PoolClient,
  ): Promise<void> {
    const executor = this.getExecutor(client);
    const sql = `
      UPDATE payments
      SET status = $1,
          paid_at = COALESCE($2, paid_at),
          note = COALESCE($3, note)
      WHERE payment_id = $4;
    `;
    await executor.query(sql, [status, paidAt ?? null, note ?? null, paymentId]);
  }
}
