export type EscrowStatus = 'HOLDING' | 'RELEASED' | 'REFUNDED';
export type WalletTransactionType = 'SETTLEMENT' | 'WITHDRAWAL_HOLD' | 'WITHDRAWAL_SUCCESS' | 'WITHDRAWAL_REJECTED';
export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ShopWallet {
  wallet_id: string;
  shop_id: string;
  balance: string;
  hold_balance: string;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  created_at: string;
  updated_at: string;
}

export interface EscrowRecord {
  escrow_id: string;
  order_id: string;
  shop_id: string;
  gross_amount: string;
  commission_rate: string;
  commission_fee: string;
  net_amount: string;
  status: EscrowStatus;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  transaction_id: string;
  wallet_id: string;
  type: WalletTransactionType;
  amount: string;
  balance_before: string;
  balance_after: string;
  reference_type: 'ORDER' | 'WITHDRAWAL';
  reference_id: string;
  description: string | null;
  created_at: string;
}

export interface WithdrawalRequest {
  request_id: string;
  shop_id: string;
  amount: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
  status: WithdrawalStatus;
  admin_note: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface UpdateBankInfoInput {
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
}

export interface FinanceOverview {
  total_escrow_holding: string;
  total_commission_collected: string;
  total_wallets_balance: string;
  total_withdrawn: string;
  pending_withdrawals_count: number;
}

export interface IWalletRepository {
  getOrCreateWallet(shopId: string): Promise<ShopWallet>;
  findWalletByShopId(shopId: string): Promise<ShopWallet | null>;
  updateBankInfo(shopId: string, bankInfo: UpdateBankInfoInput): Promise<ShopWallet>;

  // Escrow
  createEscrow(input: {
    order_id: string;
    shop_id: string;
    gross_amount: string;
    commission_rate?: number;
  }): Promise<EscrowRecord>;
  findEscrowByOrderId(orderId: string): Promise<EscrowRecord | null>;
  settleEscrow(orderId: string): Promise<{ escrow: EscrowRecord; wallet: ShopWallet; transaction: WalletTransaction } | null>;
  refundEscrow(orderId: string): Promise<EscrowRecord | null>;

  // Withdrawal
  requestWithdrawal(shopId: string, amount: string): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }>;
  approveWithdrawal(requestId: string, adminId: string, note?: string): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }>;
  rejectWithdrawal(requestId: string, adminId: string, note?: string): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }>;
  listWithdrawalRequests(filter?: { shop_id?: string; status?: WithdrawalStatus }): Promise<WithdrawalRequest[]>;

  // Ledger / Transactions
  listTransactions(shopId: string, limit?: number): Promise<WalletTransaction[]>;
  getFinanceOverview(): Promise<FinanceOverview>;
}
