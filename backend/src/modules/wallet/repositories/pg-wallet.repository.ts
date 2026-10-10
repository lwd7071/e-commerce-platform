import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import type {
  IWalletRepository,
  ShopWallet,
  EscrowRecord,
  WalletTransaction,
  WithdrawalRequest,
  UpdateBankInfoInput,
  FinanceOverview,
  WithdrawalStatus,
  EscrowReconciliationResult,
} from '../domain/wallet.types.ts';
import {
  InsufficientBalanceError,
  MissingBankInfoError,
  InvalidWithdrawalAmountError,
  WithdrawalNotFoundError,
  EscrowNotFoundError,
  EscrowAlreadySettledError,
} from '../domain/wallet-errors.ts';

function parseCents(amount: string | number): bigint {
  const str = typeof amount === 'number' ? amount.toFixed(2) : String(amount);
  const [whole, fraction = ''] = str.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
}

function formatCents(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  const whole = (abs / 100n).toString();
  const fraction = (abs % 100n).toString().padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

export class PgWalletRepository implements IWalletRepository {
  constructor(private readonly pool: Pool) {}

  async getOrCreateWallet(shopId: string): Promise<ShopWallet> {
    const existing = await this.findWalletByShopId(shopId);
    if (existing) return existing;

    const walletId = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO shop_wallets (wallet_id, shop_id, balance, hold_balance)
       VALUES ($1, $2, 0, 0)
       ON CONFLICT (shop_id) DO UPDATE SET updated_at = NOW()
       RETURNING wallet_id, shop_id, balance, hold_balance, bank_name, bank_account_number, bank_account_holder, created_at, updated_at`,
      [walletId, shopId],
    );
    return this.mapWallet(result.rows[0]);
  }

  async findWalletByShopId(shopId: string): Promise<ShopWallet | null> {
    const result = await this.pool.query(
      `SELECT wallet_id, shop_id, balance, hold_balance, bank_name, bank_account_number, bank_account_holder, created_at, updated_at
       FROM shop_wallets WHERE shop_id = $1`,
      [shopId],
    );
    return result.rows[0] ? this.mapWallet(result.rows[0]) : null;
  }

  async updateBankInfo(shopId: string, bankInfo: UpdateBankInfoInput): Promise<ShopWallet> {
    await this.getOrCreateWallet(shopId);
    const result = await this.pool.query(
      `UPDATE shop_wallets
       SET bank_name = $1, bank_account_number = $2, bank_account_holder = $3, updated_at = NOW()
       WHERE shop_id = $4
       RETURNING wallet_id, shop_id, balance, hold_balance, bank_name, bank_account_number, bank_account_holder, created_at, updated_at`,
      [bankInfo.bank_name.trim(), bankInfo.bank_account_number.trim(), bankInfo.bank_account_holder.trim().toUpperCase(), shopId],
    );
    return this.mapWallet(result.rows[0]);
  }

  async createEscrow(input: {
    order_id: string;
    shop_id: string;
    gross_amount: string;
    commission_rate?: number;
  }): Promise<EscrowRecord> {
    const rate = input.commission_rate ?? 0.05;
    const grossCents = parseCents(input.gross_amount);
    const commissionFeeCents = (grossCents * BigInt(Math.round(rate * 10000))) / 10000n;
    const netCents = grossCents - commissionFeeCents;

    const escrowId = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO escrow_records (
        escrow_id, order_id, shop_id, gross_amount, commission_rate, commission_fee, net_amount, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'HOLDING')
       ON CONFLICT (order_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [
        escrowId,
        input.order_id,
        input.shop_id,
        formatCents(grossCents),
        rate.toFixed(4),
        formatCents(commissionFeeCents),
        formatCents(netCents),
      ],
    );
    return this.mapEscrow(result.rows[0]);
  }

  async findEscrowByOrderId(orderId: string): Promise<EscrowRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM escrow_records WHERE order_id = $1`,
      [orderId],
    );
    return result.rows[0] ? this.mapEscrow(result.rows[0]) : null;
  }

  async settleEscrow(orderId: string): Promise<{ escrow: EscrowRecord; wallet: ShopWallet; transaction: WalletTransaction } | null> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const escrowRes = await client.query(
        `SELECT * FROM escrow_records WHERE order_id = $1 FOR UPDATE`,
        [orderId],
      );
      if (!escrowRes.rows[0]) {
        throw new EscrowNotFoundError();
      }
      const escrowRow = escrowRes.rows[0];
      if (escrowRow.status !== 'HOLDING') {
        throw new EscrowAlreadySettledError();
      }

      // Lock or create wallet
      let walletRes = await client.query(
        `SELECT * FROM shop_wallets WHERE shop_id = $1 FOR UPDATE`,
        [escrowRow.shop_id],
      );
      if (!walletRes.rows[0]) {
        const newWalletId = randomUUID();
        walletRes = await client.query(
          `INSERT INTO shop_wallets (wallet_id, shop_id, balance, hold_balance)
           VALUES ($1, $2, 0, 0)
           RETURNING *`,
          [newWalletId, escrowRow.shop_id],
        );
      }
      const currentWallet = walletRes.rows[0];
      const balanceBeforeCents = parseCents(currentWallet.balance);
      const netCents = parseCents(escrowRow.net_amount);
      const balanceAfterCents = balanceBeforeCents + netCents;

      // Update escrow to RELEASED
      const updatedEscrowRes = await client.query(
        `UPDATE escrow_records
         SET status = 'RELEASED', released_at = NOW(), updated_at = NOW()
         WHERE escrow_id = $1
         RETURNING *`,
        [escrowRow.escrow_id],
      );

      // Update wallet balance
      const updatedWalletRes = await client.query(
        `UPDATE shop_wallets
         SET balance = $1, updated_at = NOW()
         WHERE wallet_id = $2
         RETURNING *`,
        [formatCents(balanceAfterCents), currentWallet.wallet_id],
      );

      // Record wallet transaction
      const txId = randomUUID();
      const txRes = await client.query(
        `INSERT INTO wallet_transactions (
          transaction_id, wallet_id, type, amount, balance_before, balance_after,
          reference_type, reference_id, description
         )
         VALUES ($1, $2, 'SETTLEMENT', $3, $4, $5, 'ORDER', $6, $7)
         RETURNING *`,
        [
          txId,
          currentWallet.wallet_id,
          formatCents(netCents),
          formatCents(balanceBeforeCents),
          formatCents(balanceAfterCents),
          orderId,
          `Quyết toán doanh thu đơn hàng #${orderId.slice(0, 8)} (Phí sàn: ${escrowRow.commission_fee} đ)`,
        ],
      );

      await client.query('COMMIT');
      return {
        escrow: this.mapEscrow(updatedEscrowRes.rows[0]),
        wallet: this.mapWallet(updatedWalletRes.rows[0]),
        transaction: this.mapTransaction(txRes.rows[0]),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async refundEscrow(orderId: string): Promise<EscrowRecord | null> {
    const result = await this.pool.query(
      `UPDATE escrow_records
       SET status = 'REFUNDED', updated_at = NOW()
       WHERE order_id = $1 AND status = 'HOLDING'
       RETURNING *`,
      [orderId],
    );
    return result.rows[0] ? this.mapEscrow(result.rows[0]) : null;
  }

  async reconcilePendingEscrows(): Promise<EscrowReconciliationResult> {
    const result: EscrowReconciliationResult = {
      settled_count: 0,
      settled_order_ids: [],
      refunded_count: 0,
      refunded_order_ids: [],
      errors: [],
    };

    // Find escrows stuck in HOLDING where order is COMPLETED
    const completedRes = await this.pool.query(
      `SELECT e.order_id 
       FROM escrow_records e
       JOIN orders o ON e.order_id = o.order_id
       WHERE e.status = 'HOLDING' AND o.status = 'COMPLETED'`
    );

    for (const row of completedRes.rows) {
      const orderId = row.order_id;
      try {
        await this.settleEscrow(orderId);
        result.settled_count++;
        result.settled_order_ids.push(orderId);
      } catch (err) {
        result.errors.push({
          order_id: orderId,
          action: 'SETTLE',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Find escrows stuck in HOLDING where order is CANCELLED
    const cancelledRes = await this.pool.query(
      `SELECT e.order_id 
       FROM escrow_records e
       JOIN orders o ON e.order_id = o.order_id
       WHERE e.status = 'HOLDING' AND o.status = 'CANCELLED'`
    );

    for (const row of cancelledRes.rows) {
      const orderId = row.order_id;
      try {
        await this.refundEscrow(orderId);
        result.refunded_count++;
        result.refunded_order_ids.push(orderId);
      } catch (err) {
        result.errors.push({
          order_id: orderId,
          action: 'REFUND',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }

  async requestWithdrawal(shopId: string, amount: string): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }> {
    const withdrawCents = parseCents(amount);
    if (withdrawCents < 5000000n) { // Min 50.000 VND
      throw new InvalidWithdrawalAmountError();
    }

    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const walletRes = await client.query(
        `SELECT * FROM shop_wallets WHERE shop_id = $1 FOR UPDATE`,
        [shopId],
      );
      if (!walletRes.rows[0]) {
        throw new InsufficientBalanceError();
      }
      const wallet = walletRes.rows[0];
      if (!wallet.bank_name || !wallet.bank_account_number || !wallet.bank_account_holder) {
        throw new MissingBankInfoError();
      }

      const balanceCents = parseCents(wallet.balance);
      const holdCents = parseCents(wallet.hold_balance);
      if (balanceCents < withdrawCents) {
        throw new InsufficientBalanceError();
      }

      const newBalanceCents = balanceCents - withdrawCents;
      const newHoldCents = holdCents + withdrawCents;

      const updatedWalletRes = await client.query(
        `UPDATE shop_wallets
         SET balance = $1, hold_balance = $2, updated_at = NOW()
         WHERE wallet_id = $3
         RETURNING *`,
        [formatCents(newBalanceCents), formatCents(newHoldCents), wallet.wallet_id],
      );

      const requestId = randomUUID();
      const reqRes = await client.query(
        `INSERT INTO withdrawal_requests (
          request_id, shop_id, amount, bank_name, bank_account_number, bank_account_holder, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
         RETURNING *`,
        [
          requestId,
          shopId,
          formatCents(withdrawCents),
          wallet.bank_name,
          wallet.bank_account_number,
          wallet.bank_account_holder,
        ],
      );

      const txId = randomUUID();
      const txRes = await client.query(
        `INSERT INTO wallet_transactions (
          transaction_id, wallet_id, type, amount, balance_before, balance_after,
          reference_type, reference_id, description
         )
         VALUES ($1, $2, 'WITHDRAWAL_HOLD', $3, $4, $5, 'WITHDRAWAL', $6, $7)
         RETURNING *`,
        [
          txId,
          wallet.wallet_id,
          formatCents(withdrawCents),
          formatCents(balanceCents),
          formatCents(newBalanceCents),
          requestId,
          `Yêu cầu rút tiền về ${wallet.bank_name} - ${wallet.bank_account_number}`,
        ],
      );

      await client.query('COMMIT');
      return {
        request: this.mapWithdrawal(reqRes.rows[0]),
        wallet: this.mapWallet(updatedWalletRes.rows[0]),
        transaction: this.mapTransaction(txRes.rows[0]),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async approveWithdrawal(requestId: string, adminId: string, note?: string): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const reqRes = await client.query(
        `SELECT * FROM withdrawal_requests WHERE request_id = $1 FOR UPDATE`,
        [requestId],
      );
      if (!reqRes.rows[0] || reqRes.rows[0].status !== 'PENDING') {
        throw new WithdrawalNotFoundError('Yêu cầu rút tiền không tồn tại hoặc đã được xử lý.');
      }
      const withdrawal = reqRes.rows[0];

      const walletRes = await client.query(
        `SELECT * FROM shop_wallets WHERE shop_id = $1 FOR UPDATE`,
        [withdrawal.shop_id],
      );
      const wallet = walletRes.rows[0];
      const holdCents = parseCents(wallet.hold_balance);
      const amountCents = parseCents(withdrawal.amount);
      const newHoldCents = holdCents >= amountCents ? holdCents - amountCents : 0n;

      const updatedWalletRes = await client.query(
        `UPDATE shop_wallets
         SET hold_balance = $1, updated_at = NOW()
         WHERE wallet_id = $2
         RETURNING *`,
        [formatCents(newHoldCents), wallet.wallet_id],
      );

      const updatedReqRes = await client.query(
        `UPDATE withdrawal_requests
         SET status = 'APPROVED', processed_by = $1, processed_at = NOW(), admin_note = $2
         WHERE request_id = $3
         RETURNING *`,
        [adminId, note || 'Admin đã duyệt chuyển khoản thành công', requestId],
      );

      const currentBalanceCents = parseCents(wallet.balance);
      const txId = randomUUID();
      const txRes = await client.query(
        `INSERT INTO wallet_transactions (
          transaction_id, wallet_id, type, amount, balance_before, balance_after,
          reference_type, reference_id, description
         )
         VALUES ($1, $2, 'WITHDRAWAL_SUCCESS', $3, $4, $5, 'WITHDRAWAL', $6, $7)
         RETURNING *`,
        [
          txId,
          wallet.wallet_id,
          withdrawal.amount,
          formatCents(currentBalanceCents),
          formatCents(currentBalanceCents),
          requestId,
          `Đã chuyển khoản ${withdrawal.amount} đ về tài khoản ${withdrawal.bank_name}`,
        ],
      );

      await client.query('COMMIT');
      return {
        request: this.mapWithdrawal(updatedReqRes.rows[0]),
        wallet: this.mapWallet(updatedWalletRes.rows[0]),
        transaction: this.mapTransaction(txRes.rows[0]),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async rejectWithdrawal(requestId: string, adminId: string, note?: string): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const reqRes = await client.query(
        `SELECT * FROM withdrawal_requests WHERE request_id = $1 FOR UPDATE`,
        [requestId],
      );
      if (!reqRes.rows[0] || reqRes.rows[0].status !== 'PENDING') {
        throw new WithdrawalNotFoundError('Yêu cầu rút tiền không tồn tại hoặc đã được xử lý.');
      }
      const withdrawal = reqRes.rows[0];

      const walletRes = await client.query(
        `SELECT * FROM shop_wallets WHERE shop_id = $1 FOR UPDATE`,
        [withdrawal.shop_id],
      );
      const wallet = walletRes.rows[0];
      const balanceCents = parseCents(wallet.balance);
      const holdCents = parseCents(wallet.hold_balance);
      const amountCents = parseCents(withdrawal.amount);

      const newBalanceCents = balanceCents + amountCents;
      const newHoldCents = holdCents >= amountCents ? holdCents - amountCents : 0n;

      const updatedWalletRes = await client.query(
        `UPDATE shop_wallets
         SET balance = $1, hold_balance = $2, updated_at = NOW()
         WHERE wallet_id = $3
         RETURNING *`,
        [formatCents(newBalanceCents), formatCents(newHoldCents), wallet.wallet_id],
      );

      const updatedReqRes = await client.query(
        `UPDATE withdrawal_requests
         SET status = 'REJECTED', processed_by = $1, processed_at = NOW(), admin_note = $2
         WHERE request_id = $3
         RETURNING *`,
        [adminId, note || 'Từ chối yêu cầu rút tiền', requestId],
      );

      const txId = randomUUID();
      const txRes = await client.query(
        `INSERT INTO wallet_transactions (
          transaction_id, wallet_id, type, amount, balance_before, balance_after,
          reference_type, reference_id, description
         )
         VALUES ($1, $2, 'WITHDRAWAL_REJECTED', $3, $4, $5, 'WITHDRAWAL', $6, $7)
         RETURNING *`,
        [
          txId,
          wallet.wallet_id,
          withdrawal.amount,
          formatCents(balanceCents),
          formatCents(newBalanceCents),
          requestId,
          `Hoàn tiền vào ví do lệnh rút bị từ chối: ${note || 'Không hợp lệ'}`,
        ],
      );

      await client.query('COMMIT');
      return {
        request: this.mapWithdrawal(updatedReqRes.rows[0]),
        wallet: this.mapWallet(updatedWalletRes.rows[0]),
        transaction: this.mapTransaction(txRes.rows[0]),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listWithdrawalRequests(filter?: { shop_id?: string; status?: WithdrawalStatus }): Promise<WithdrawalRequest[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter?.shop_id) {
      values.push(filter.shop_id);
      conditions.push(`shop_id = $${values.length}`);
    }
    if (filter?.status) {
      values.push(filter.status);
      conditions.push(`status = $${values.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT * FROM withdrawal_requests ${where} ORDER BY created_at DESC`,
      values,
    );
    return result.rows.map((row) => this.mapWithdrawal(row));
  }

  async listTransactions(shopId: string, limit = 50): Promise<WalletTransaction[]> {
    const wallet = await this.findWalletByShopId(shopId);
    if (!wallet) return [];

    const result = await this.pool.query(
      `SELECT * FROM wallet_transactions WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [wallet.wallet_id, limit],
    );
    return result.rows.map((row) => this.mapTransaction(row));
  }

  async getFinanceOverview(): Promise<FinanceOverview> {
    const escrowRes = await this.pool.query(
      `SELECT
         COALESCE(SUM(gross_amount) FILTER (WHERE status = 'HOLDING'), 0) as holding,
         COALESCE(SUM(commission_fee) FILTER (WHERE status = 'RELEASED'), 0) as commission
       FROM escrow_records`,
    );

    const walletRes = await this.pool.query(
      `SELECT COALESCE(SUM(balance), 0) as total_balance FROM shop_wallets`,
    );

    const withdrawalRes = await this.pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status = 'APPROVED'), 0) as total_withdrawn,
         COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count
       FROM withdrawal_requests`,
    );

    return {
      total_escrow_holding: String(escrowRes.rows[0]?.holding || '0.00'),
      total_commission_collected: String(escrowRes.rows[0]?.commission || '0.00'),
      total_wallets_balance: String(walletRes.rows[0]?.total_balance || '0.00'),
      total_withdrawn: String(withdrawalRes.rows[0]?.total_withdrawn || '0.00'),
      pending_withdrawals_count: Number(withdrawalRes.rows[0]?.pending_count || 0),
    };
  }

  private mapWallet(row: Record<string, unknown>): ShopWallet {
    return {
      wallet_id: String(row.wallet_id),
      shop_id: String(row.shop_id),
      balance: String(row.balance),
      hold_balance: String(row.hold_balance),
      bank_name: row.bank_name ? String(row.bank_name) : null,
      bank_account_number: row.bank_account_number ? String(row.bank_account_number) : null,
      bank_account_holder: row.bank_account_holder ? String(row.bank_account_holder) : null,
      created_at: new Date(row.created_at as string | Date).toISOString(),
      updated_at: new Date(row.updated_at as string | Date).toISOString(),
    };
  }

  private mapEscrow(row: Record<string, unknown>): EscrowRecord {
    return {
      escrow_id: String(row.escrow_id),
      order_id: String(row.order_id),
      shop_id: String(row.shop_id),
      gross_amount: String(row.gross_amount),
      commission_rate: String(row.commission_rate),
      commission_fee: String(row.commission_fee),
      net_amount: String(row.net_amount),
      status: row.status as EscrowRecord['status'],
      released_at: row.released_at ? new Date(row.released_at as string | Date).toISOString() : null,
      created_at: new Date(row.created_at as string | Date).toISOString(),
      updated_at: new Date(row.updated_at as string | Date).toISOString(),
    };
  }

  private mapWithdrawal(row: Record<string, unknown>): WithdrawalRequest {
    return {
      request_id: String(row.request_id),
      shop_id: String(row.shop_id),
      amount: String(row.amount),
      bank_name: String(row.bank_name),
      bank_account_number: String(row.bank_account_number),
      bank_account_holder: String(row.bank_account_holder),
      status: row.status as WithdrawalRequest['status'],
      admin_note: row.admin_note ? String(row.admin_note) : null,
      processed_by: row.processed_by ? String(row.processed_by) : null,
      processed_at: row.processed_at ? new Date(row.processed_at as string | Date).toISOString() : null,
      created_at: new Date(row.created_at as string | Date).toISOString(),
    };
  }

  private mapTransaction(row: Record<string, unknown>): WalletTransaction {
    return {
      transaction_id: String(row.transaction_id),
      wallet_id: String(row.wallet_id),
      type: row.type as WalletTransaction['type'],
      amount: String(row.amount),
      balance_before: String(row.balance_before),
      balance_after: String(row.balance_after),
      reference_type: row.reference_type as WalletTransaction['reference_type'],
      reference_id: String(row.reference_id),
      description: row.description ? String(row.description) : null,
      created_at: new Date(row.created_at as string | Date).toISOString(),
    };
  }
}
