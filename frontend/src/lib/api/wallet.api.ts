import { apiClient } from './client';

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

export interface WalletTransaction {
  transaction_id: string;
  wallet_id: string;
  type: 'SETTLEMENT' | 'WITHDRAWAL_HOLD' | 'WITHDRAWAL_SUCCESS' | 'WITHDRAWAL_REJECTED';
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
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  admin_note: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface FinanceOverview {
  total_escrow_holding: string;
  total_commission_collected: string;
  total_wallets_balance: string;
  total_withdrawn: string;
  pending_withdrawals_count: number;
}

export interface EscrowReconciliationResult {
  settled_count: number;
  settled_order_ids: string[];
  refunded_count: number;
  refunded_order_ids: string[];
  errors: Array<{ order_id: string; action: 'SETTLE' | 'REFUND'; error: string }>;
}

export interface PayosLinkResult {
  order_id: string;
  order_code: number;
  amount: number;
  checkout_url: string;
  qr_code: string;
  bin: string;
  account_number: string;
  account_name: string;
}

export const walletApi = {
  // Seller
  async getWallet(): Promise<ShopWallet> {
    return apiClient.get<ShopWallet>('/seller/wallet');
  },

  async updateBankInfo(bankInfo: { bank_name: string; bank_account_number: string; bank_account_holder: string }): Promise<ShopWallet> {
    return apiClient.put<ShopWallet>('/seller/wallet/bank-info', bankInfo);
  },

  async requestWithdrawal(amount: string): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }> {
    return apiClient.post<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }>('/seller/wallet/withdraw', { amount });
  },

  async getTransactions(limit = 50): Promise<WalletTransaction[]> {
    return apiClient.get<WalletTransaction[]>(`/seller/wallet/transactions?limit=${limit}`);
  },

  async getWithdrawals(): Promise<WithdrawalRequest[]> {
    return apiClient.get<WithdrawalRequest[]>('/seller/wallet/withdrawals');
  },

  // Admin
  async getFinanceOverview(): Promise<FinanceOverview> {
    return apiClient.get<FinanceOverview>('/admin/finance/overview');
  },

  async getAdminWithdrawals(params?: { status?: string; shop_id?: string }): Promise<WithdrawalRequest[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.shop_id) query.set('shop_id', params.shop_id);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<WithdrawalRequest[]>(`/admin/finance/withdrawals${qs}`);
  },

  async approveWithdrawal(id: string, note?: string): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }> {
    return apiClient.post<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }>(`/admin/finance/withdrawals/${id}/approve`, { note });
  },

  async rejectWithdrawal(id: string, note?: string): Promise<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }> {
    return apiClient.post<{ request: WithdrawalRequest; wallet: ShopWallet; transaction: WalletTransaction }>(`/admin/finance/withdrawals/${id}/reject`, { note });
  },

  async reconcileEscrow(): Promise<EscrowReconciliationResult> {
    return apiClient.post<EscrowReconciliationResult>('/admin/finance/escrow/reconcile', {});
  },

  // PayOS
  async createPayosLink(orderId: string): Promise<PayosLinkResult> {
    return apiClient.post<PayosLinkResult>('/payments/payos/create-link', { order_id: orderId });
  },
};
