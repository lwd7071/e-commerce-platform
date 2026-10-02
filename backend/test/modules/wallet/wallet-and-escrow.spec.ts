import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type {
  IWalletRepository,
  ShopWallet,
  EscrowRecord,
  WalletTransaction,
  WithdrawalRequest,
  UpdateBankInfoInput,
  FinanceOverview,
  EscrowReconciliationResult,
} from '../../../src/modules/wallet/domain/wallet.types.ts';
import {
  InsufficientBalanceError,
  MissingBankInfoError,
  InvalidWithdrawalAmountError,
  WithdrawalNotFoundError,
  EscrowAlreadySettledError,
} from '../../../src/modules/wallet/domain/wallet-errors.ts';
import { EscrowService } from '../../../src/modules/wallet/services/escrow.service.ts';
import { ShopWalletService } from '../../../src/modules/wallet/services/shop-wallet.service.ts';
import { AdminFinanceService } from '../../../src/modules/wallet/services/admin-finance.service.ts';
import { PayosService } from '../../../src/modules/wallet/services/payos.service.ts';
import { createRequestContext } from '../../../src/platform/context/request-context.ts';

class InMemoryWalletRepository implements IWalletRepository {
  public wallets = new Map<string, ShopWallet>();
  public escrows = new Map<string, EscrowRecord>();
  public transactions: WalletTransaction[] = [];
  public withdrawals = new Map<string, WithdrawalRequest>();
  public orderStatuses = new Map<string, string>();

  async getOrCreateWallet(shopId: string): Promise<ShopWallet> {
    let wallet = this.wallets.get(shopId);
    if (!wallet) {
      wallet = {
        wallet_id: `wallet-${shopId}`,
        shop_id: shopId,
        balance: '0.00',
        hold_balance: '0.00',
        bank_name: null,
        bank_account_number: null,
        bank_account_holder: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.wallets.set(shopId, wallet);
    }
    return { ...wallet };
  }

  async findWalletByShopId(shopId: string): Promise<ShopWallet | null> {
    const w = this.wallets.get(shopId);
    return w ? { ...w } : null;
  }

  async updateBankInfo(shopId: string, bankInfo: UpdateBankInfoInput): Promise<ShopWallet> {
    const wallet = await this.getOrCreateWallet(shopId);
    wallet.bank_name = bankInfo.bank_name;
    wallet.bank_account_number = bankInfo.bank_account_number;
    wallet.bank_account_holder = bankInfo.bank_account_holder.toUpperCase();
    wallet.updated_at = new Date().toISOString();
    this.wallets.set(shopId, wallet);
    return { ...wallet };
  }

  async createEscrow(input: {
    order_id: string;
    shop_id: string;
    gross_amount: string;
    commission_rate?: number;
  }): Promise<EscrowRecord> {
    const rate = input.commission_rate ?? 0.05;
    const gross = Number(input.gross_amount);
    const fee = Math.round(gross * rate * 100) / 100;
    const net = gross - fee;

    const escrow: EscrowRecord = {
      escrow_id: `escrow-${input.order_id}`,
      order_id: input.order_id,
      shop_id: input.shop_id,
      gross_amount: gross.toFixed(2),
      commission_rate: rate.toFixed(4),
      commission_fee: fee.toFixed(2),
      net_amount: net.toFixed(2),
      status: 'HOLDING',
      released_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.escrows.set(input.order_id, escrow);
    return { ...escrow };
  }

  async findEscrowByOrderId(orderId: string): Promise<EscrowRecord | null> {
    const e = this.escrows.get(orderId);
    return e ? { ...e } : null;
  }

  async settleEscrow(orderId: string): Promise<{ escrow: EscrowRecord; wallet: ShopWallet; transaction: WalletTransaction } | null> {
    const escrow = this.escrows.get(orderId);
    if (!escrow) return null;
    if (escrow.status !== 'HOLDING') {
      throw new EscrowAlreadySettledError();
    }

    const wallet = await this.getOrCreateWallet(escrow.shop_id);
    const balanceBefore = Number(wallet.balance);
    const net = Number(escrow.net_amount);
    const balanceAfter = balanceBefore + net;

    escrow.status = 'RELEASED';
    escrow.released_at = new Date().toISOString();
    wallet.balance = balanceAfter.toFixed(2);
    wallet.updated_at = new Date().toISOString();

    const tx: WalletTransaction = {
      transaction_id: `tx-${Date.now()}-${Math.random()}`,
      wallet_id: wallet.wallet_id,
      type: 'SETTLEMENT',
      amount: escrow.net_amount,
      balance_before: balanceBefore.toFixed(2),
      balance_after: balanceAfter.toFixed(2),
      reference_type: 'ORDER',
      reference_id: orderId,
      description: `Quyết toán đơn hàng #${orderId}`,
      created_at: new Date().toISOString(),
    };

    this.transactions.unshift(tx);
    this.escrows.set(orderId, escrow);
    this.wallets.set(escrow.shop_id, wallet);

    return {
      escrow: { ...escrow },
      wallet: { ...wallet },
      transaction: { ...tx },
    };
  }

  async refundEscrow(orderId: string): Promise<EscrowRecord | null> {
    const escrow = this.escrows.get(orderId);
    if (!escrow || escrow.status !== 'HOLDING') return null;
    escrow.status = 'REFUNDED';
    this.escrows.set(orderId, escrow);
    return { ...escrow };
  }

  async reconcilePendingEscrows(): Promise<EscrowReconciliationResult> {
    const result: EscrowReconciliationResult = {
      settled_count: 0,
      settled_order_ids: [],
      refunded_count: 0,
      refunded_order_ids: [],
      errors: [],
    };

    for (const [orderId, escrow] of this.escrows.entries()) {
      if (escrow.status === 'HOLDING') {
        const orderStatus = this.orderStatuses.get(orderId);
        if (orderStatus === 'COMPLETED') {
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
        } else if (orderStatus === 'CANCELLED') {
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
      }
    }
    return result;
  }

  async requestWithdrawal(shopId: string, amountStr: string): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }> {
    const amount = Number(amountStr);
    if (amount < 50000) {
      throw new InvalidWithdrawalAmountError();
    }

    const wallet = await this.getOrCreateWallet(shopId);
    if (!wallet.bank_name || !wallet.bank_account_number || !wallet.bank_account_holder) {
      throw new MissingBankInfoError();
    }

    const balance = Number(wallet.balance);
    if (balance < amount) {
      throw new InsufficientBalanceError();
    }

    const hold = Number(wallet.hold_balance);
    wallet.balance = (balance - amount).toFixed(2);
    wallet.hold_balance = (hold + amount).toFixed(2);

    const req: WithdrawalRequest = {
      request_id: `withdraw-${Date.now()}`,
      shop_id: shopId,
      amount: amount.toFixed(2),
      bank_name: wallet.bank_name,
      bank_account_number: wallet.bank_account_number,
      bank_account_holder: wallet.bank_account_holder,
      status: 'PENDING',
      admin_note: null,
      processed_by: null,
      processed_at: null,
      created_at: new Date().toISOString(),
    };

    const tx: WalletTransaction = {
      transaction_id: `tx-w-${Date.now()}`,
      wallet_id: wallet.wallet_id,
      type: 'WITHDRAWAL_HOLD',
      amount: amount.toFixed(2),
      balance_before: balance.toFixed(2),
      balance_after: wallet.balance,
      reference_type: 'WITHDRAWAL',
      reference_id: req.request_id,
      description: `Yêu cầu rút tiền về ${wallet.bank_name}`,
      created_at: new Date().toISOString(),
    };

    this.withdrawals.set(req.request_id, req);
    this.wallets.set(shopId, wallet);
    this.transactions.unshift(tx);

    return { request: { ...req }, wallet: { ...wallet }, transaction: { ...tx } };
  }

  async approveWithdrawal(requestId: string, adminId: string, note?: string): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }> {
    const req = this.withdrawals.get(requestId);
    if (!req || req.status !== 'PENDING') throw new WithdrawalNotFoundError();

    const wallet = await this.getOrCreateWallet(req.shop_id);
    const hold = Number(wallet.hold_balance);
    const amount = Number(req.amount);
    wallet.hold_balance = Math.max(0, hold - amount).toFixed(2);

    req.status = 'APPROVED';
    req.processed_by = adminId;
    req.processed_at = new Date().toISOString();
    req.admin_note = note || null;

    const tx: WalletTransaction = {
      transaction_id: `tx-app-${Date.now()}`,
      wallet_id: wallet.wallet_id,
      type: 'WITHDRAWAL_SUCCESS',
      amount: req.amount,
      balance_before: wallet.balance,
      balance_after: wallet.balance,
      reference_type: 'WITHDRAWAL',
      reference_id: req.request_id,
      description: `Duyệt chuyển khoản thành công`,
      created_at: new Date().toISOString(),
    };

    this.withdrawals.set(requestId, req);
    this.wallets.set(req.shop_id, wallet);
    this.transactions.unshift(tx);

    return { request: { ...req }, wallet: { ...wallet }, transaction: { ...tx } };
  }

  async rejectWithdrawal(requestId: string, adminId: string, note?: string): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }> {
    const req = this.withdrawals.get(requestId);
    if (!req || req.status !== 'PENDING') throw new WithdrawalNotFoundError();

    const wallet = await this.getOrCreateWallet(req.shop_id);
    const balance = Number(wallet.balance);
    const hold = Number(wallet.hold_balance);
    const amount = Number(req.amount);

    wallet.balance = (balance + amount).toFixed(2);
    wallet.hold_balance = Math.max(0, hold - amount).toFixed(2);

    req.status = 'REJECTED';
    req.processed_by = adminId;
    req.processed_at = new Date().toISOString();
    req.admin_note = note || null;

    const tx: WalletTransaction = {
      transaction_id: `tx-rej-${Date.now()}`,
      wallet_id: wallet.wallet_id,
      type: 'WITHDRAWAL_REJECTED',
      amount: req.amount,
      balance_before: balance.toFixed(2),
      balance_after: wallet.balance,
      reference_type: 'WITHDRAWAL',
      reference_id: req.request_id,
      description: `Hoàn tiền: ${note || 'Bị từ chối'}`,
      created_at: new Date().toISOString(),
    };

    this.withdrawals.set(requestId, req);
    this.wallets.set(req.shop_id, wallet);
    this.transactions.unshift(tx);

    return { request: { ...req }, wallet: { ...wallet }, transaction: { ...tx } };
  }

  async listWithdrawalRequests(filter?: { shop_id?: string; status?: 'PENDING' | 'APPROVED' | 'REJECTED' }): Promise<WithdrawalRequest[]> {
    let list = Array.from(this.withdrawals.values());
    if (filter?.shop_id) list = list.filter((r) => r.shop_id === filter.shop_id);
    if (filter?.status) list = list.filter((r) => r.status === filter.status);
    return list;
  }

  async listTransactions(shopId: string, limit = 50): Promise<WalletTransaction[]> {
    const wallet = this.wallets.get(shopId);
    if (!wallet) return [];
    return this.transactions.filter((t) => t.wallet_id === wallet.wallet_id).slice(0, limit);
  }

  async getFinanceOverview(): Promise<FinanceOverview> {
    let holding = 0;
    let commission = 0;
    for (const e of this.escrows.values()) {
      if (e.status === 'HOLDING') holding += Number(e.gross_amount);
      if (e.status === 'RELEASED') commission += Number(e.commission_fee);
    }
    let balance = 0;
    for (const w of this.wallets.values()) {
      balance += Number(w.balance);
    }
    let withdrawn = 0;
    let pending = 0;
    for (const w of this.withdrawals.values()) {
      if (w.status === 'APPROVED') withdrawn += Number(w.amount);
      if (w.status === 'PENDING') pending++;
    }
    return {
      total_escrow_holding: holding.toFixed(2),
      total_commission_collected: commission.toFixed(2),
      total_wallets_balance: balance.toFixed(2),
      total_withdrawn: withdrawn.toFixed(2),
      pending_withdrawals_count: pending,
    };
  }
}

describe('Wallet, Escrow, and PayOS Integration Core Tests', () => {
  let repo: InMemoryWalletRepository;
  let escrowService: EscrowService;
  let shopWalletService: ShopWalletService;
  let adminFinanceService: AdminFinanceService;
  let payosService: PayosService;

  const sellerContext = createRequestContext({
    request_id: 'req-seller-1',
    user_id: 'user-seller-1',
    role: 'SELLER',
    shop_id: 'shop-100',
    shop_status: 'ACTIVE',
  });

  const adminContext = createRequestContext({
    request_id: 'req-admin-1',
    user_id: 'user-admin-1',
    role: 'ADMIN',
  });

  beforeEach(() => {
    repo = new InMemoryWalletRepository();
    escrowService = new EscrowService(repo);
    shopWalletService = new ShopWalletService(repo);
    adminFinanceService = new AdminFinanceService(repo);
    payosService = new PayosService({
      clientId: 'dummy-client-id',
      apiKey: 'dummy-api-key',
      checksumKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    });
  });

  describe('1. Escrow Lifecycle & Platform Commission', () => {
    it('creates an escrow record holding 100% of order gross amount and calculating 5% platform fee', async () => {
      const escrow = await escrowService.createEscrow({
        order_id: 'order-001',
        shop_id: 'shop-100',
        gross_amount: '200000.00',
        commission_rate: 0.05,
      });

      assert.equal(escrow.order_id, 'order-001');
      assert.equal(escrow.gross_amount, '200000.00');
      assert.equal(escrow.commission_fee, '10000.00'); // 5% of 200,000 = 10,000
      assert.equal(escrow.net_amount, '190000.00');   // Shop receives 190,000
      assert.equal(escrow.status, 'HOLDING');
      assert.equal(escrow.released_at, null);
    });

    it('settles escrow to shop wallet on order completion and credits net amount', async () => {
      await escrowService.createEscrow({
        order_id: 'order-001',
        shop_id: 'shop-100',
        gross_amount: '200000.00',
        commission_rate: 0.05,
      });

      const settled = await escrowService.settleEscrow('order-001');
      assert.ok(settled);
      assert.equal(settled.escrow.status, 'RELEASED');
      assert.ok(settled.escrow.released_at);

      // Verify wallet balance
      assert.equal(settled.wallet.balance, '190000.00');
      assert.equal(settled.transaction.type, 'SETTLEMENT');
      assert.equal(settled.transaction.amount, '190000.00');
      assert.equal(settled.transaction.balance_after, '190000.00');
    });

    it('rejects double settlement of the same order (idempotency safety)', async () => {
      await escrowService.createEscrow({
        order_id: 'order-001',
        shop_id: 'shop-100',
        gross_amount: '200000.00',
      });
      await escrowService.settleEscrow('order-001');

      await assert.rejects(
        async () => escrowService.settleEscrow('order-001'),
        (err: Error) => err instanceof EscrowAlreadySettledError,
      );
    });
  });

  describe('2. Shop Wallet Operations & Bank Info', () => {
    it('allows active seller to update bank details for payouts', async () => {
      const updated = await shopWalletService.updateBankInfo(sellerContext, {
        bank_name: 'MBBank',
        bank_account_number: '0987654321',
        bank_account_holder: 'nguyen van a',
      });

      assert.equal(updated.bank_name, 'MBBank');
      assert.equal(updated.bank_account_number, '0987654321');
      assert.equal(updated.bank_account_holder, 'NGUYEN VAN A');
    });

    it('rejects withdrawal if shop has not configured bank info', async () => {
      // Credit some money first
      await escrowService.createEscrow({ order_id: 'ord-1', shop_id: 'shop-100', gross_amount: '100000.00' });
      await escrowService.settleEscrow('ord-1');

      await assert.rejects(
        async () => shopWalletService.requestWithdrawal(sellerContext, '80000.00'),
        { code: 'MISSING_BANK_INFO' },
      );
    });

    it('rejects withdrawal if amount is less than 50,000 VND', async () => {
      await shopWalletService.updateBankInfo(sellerContext, {
        bank_name: 'MBBank',
        bank_account_number: '123',
        bank_account_holder: 'A',
      });

      await assert.rejects(
        async () => shopWalletService.requestWithdrawal(sellerContext, '20000.00'),
        { code: 'INVALID_WITHDRAWAL_AMOUNT' },
      );
    });

    it('rejects withdrawal if amount exceeds available balance', async () => {
      await shopWalletService.updateBankInfo(sellerContext, {
        bank_name: 'MBBank',
        bank_account_number: '123',
        bank_account_holder: 'A',
      });

      await assert.rejects(
        async () => shopWalletService.requestWithdrawal(sellerContext, '100000.00'),
        { code: 'INSUFFICIENT_WALLET_BALANCE' },
      );
    });

    it('moves requested funds to hold_balance when withdrawal is initiated', async () => {
      await shopWalletService.updateBankInfo(sellerContext, {
        bank_name: 'MBBank',
        bank_account_number: '123',
        bank_account_holder: 'A',
      });
      // Settle 200,000 (net 190,000)
      await escrowService.createEscrow({ order_id: 'ord-1', shop_id: 'shop-100', gross_amount: '200000.00' });
      await escrowService.settleEscrow('ord-1');

      const result = await shopWalletService.requestWithdrawal(sellerContext, '100000.00');
      assert.equal(result.wallet.balance, '90000.00');
      assert.equal(result.wallet.hold_balance, '100000.00');
      assert.equal(result.request.status, 'PENDING');
      assert.equal(result.transaction.type, 'WITHDRAWAL_HOLD');
    });
  });

  describe('3. Admin Finance Oversight & Payout Processing', () => {
    beforeEach(async () => {
      await shopWalletService.updateBankInfo(sellerContext, {
        bank_name: 'MBBank',
        bank_account_number: '123',
        bank_account_holder: 'A',
      });
      await escrowService.createEscrow({ order_id: 'ord-1', shop_id: 'shop-100', gross_amount: '200000.00' });
      await escrowService.settleEscrow('ord-1');
    });

    it('approves withdrawal: clears hold_balance and completes payout', async () => {
      const { request } = await shopWalletService.requestWithdrawal(sellerContext, '100000.00');

      const approved = await adminFinanceService.approveWithdrawal(adminContext, request.request_id, 'Chuyển khoản thành công VietQR');
      assert.equal(approved.request.status, 'APPROVED');
      assert.equal(approved.wallet.hold_balance, '0.00');
      assert.equal(approved.wallet.balance, '90000.00');
      assert.equal(approved.transaction.type, 'WITHDRAWAL_SUCCESS');
    });

    it('rejects withdrawal: refunds held balance back to available balance', async () => {
      const { request } = await shopWalletService.requestWithdrawal(sellerContext, '100000.00');

      const rejected = await adminFinanceService.rejectWithdrawal(adminContext, request.request_id, 'Sai số tài khoản ngân hàng');
      assert.equal(rejected.request.status, 'REJECTED');
      assert.equal(rejected.wallet.hold_balance, '0.00');
      assert.equal(rejected.wallet.balance, '190000.00'); // Refunded!
      assert.equal(rejected.transaction.type, 'WITHDRAWAL_REJECTED');
    });

    it('provides accurate platform financial overview', async () => {
      // Create another holding escrow
      await escrowService.createEscrow({ order_id: 'ord-2', shop_id: 'shop-100', gross_amount: '500000.00' });

      const overview = await adminFinanceService.getOverview(adminContext);
      assert.equal(overview.total_escrow_holding, '500000.00');
      assert.equal(overview.total_commission_collected, '10000.00');
      assert.equal(overview.total_wallets_balance, '190000.00');
    });
  });

  describe('4. PayOS Signature and Webhook Verification', () => {
    it('creates deterministic HMAC-SHA256 signature for payment payload', () => {
      const payload = {
        amount: 200000,
        cancelUrl: 'http://localhost:3000/cancel',
        description: 'Thanh toan DH1234',
        orderCode: 1234,
        returnUrl: 'http://localhost:3000/success',
      };
      const signature = payosService.createSignature(payload);
      assert.ok(signature);
      assert.equal(typeof signature, 'string');
      assert.equal(signature.length, 64); // SHA-256 hex is 64 chars
    });

    it('verifies valid webhook payload signature from PayOS', () => {
      const data = {
        amount: 200000,
        orderCode: 1234,
        description: 'Thanh toan DH1234',
        accountNumber: '0123456789',
        reference: 'FT123456',
        transactionDateTime: '2026-10-02 12:00:00',
        currency: 'VND',
        paymentLinkId: 'link-123',
        code: '00',
        desc: 'success',
      };
      const signature = payosService.createSignature(data);

      const isValid = payosService.verifyWebhook({
        code: '00',
        desc: 'success',
        data,
        signature,
      });

      assert.equal(isValid, true);
    });

    it('rejects tampered webhook payload signature', () => {
      const data = {
        amount: 200000,
        orderCode: 1234,
        description: 'Thanh toan DH1234',
        accountNumber: '0123456789',
        reference: 'FT123456',
        transactionDateTime: '2026-10-02 12:00:00',
        currency: 'VND',
        paymentLinkId: 'link-123',
        code: '00',
        desc: 'success',
      };
      const signature = payosService.createSignature(data);

      const isValid = payosService.verifyWebhook({
        code: '00',
        desc: 'success',
        data: { ...data, amount: 999999 }, // Tampered amount!
        signature,
      });

      assert.equal(isValid, false);
    });
  });

  describe('5. Escrow Reconciliation & Failure Recovery', () => {
    it('reconciles completed orders stuck in HOLDING and credits shop wallet', async () => {
      // Create escrow stuck in HOLDING
      await escrowService.createEscrow({ order_id: 'stuck-ord-1', shop_id: 'shop-reconcile', gross_amount: '100000.00' });
      // Record order status as COMPLETED
      repo.orderStatuses.set('stuck-ord-1', 'COMPLETED');

      const result = await escrowService.reconcilePendingEscrows();
      assert.equal(result.settled_count, 1);
      assert.deepEqual(result.settled_order_ids, ['stuck-ord-1']);
      assert.equal(result.refunded_count, 0);

      const escrow = await escrowService.getEscrowByOrderId('stuck-ord-1');
      assert.equal(escrow?.status, 'RELEASED');

      const wallet = await repo.findWalletByShopId('shop-reconcile');
      assert.equal(wallet?.balance, '95000.00'); // 100k - 5% fee
    });

    it('reconciles cancelled orders stuck in HOLDING and marks REFUNDED without crediting shop wallet', async () => {
      // Create escrow stuck in HOLDING
      await escrowService.createEscrow({ order_id: 'stuck-ord-2', shop_id: 'shop-reconcile-cancel', gross_amount: '200000.00' });
      // Record order status as CANCELLED
      repo.orderStatuses.set('stuck-ord-2', 'CANCELLED');

      const result = await escrowService.reconcilePendingEscrows();
      assert.equal(result.refunded_count, 1);
      assert.deepEqual(result.refunded_order_ids, ['stuck-ord-2']);

      const escrow = await escrowService.getEscrowByOrderId('stuck-ord-2');
      assert.equal(escrow?.status, 'REFUNDED');

      const wallet = await repo.findWalletByShopId('shop-reconcile-cancel');
      assert.equal(wallet, null); // Shop wallet not even created for cancelled order
    });

    it('allows Admin to trigger reconciliation via AdminFinanceService and rejects non-admin', async () => {
      await escrowService.createEscrow({ order_id: 'stuck-ord-3', shop_id: 'shop-admin-reconcile', gross_amount: '150000.00' });
      repo.orderStatuses.set('stuck-ord-3', 'COMPLETED');

      // Admin trigger
      const result = await adminFinanceService.reconcileEscrows(adminContext);
      assert.equal(result.settled_count, 1);
      assert.deepEqual(result.settled_order_ids, ['stuck-ord-3']);

      // Non-admin trigger rejects
      const buyerContext = createRequestContext({
        request_id: 'req-buyer-1',
        user_id: 'buyer-user',
        role: 'BUYER',
      });
      await assert.rejects(
        () => adminFinanceService.reconcileEscrows(buyerContext),
        { name: 'ForbiddenError' }
      );
    });
  });
});
