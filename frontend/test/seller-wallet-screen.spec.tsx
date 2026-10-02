// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SellerWalletScreen } from '@/features/seller/seller-wallet-screen';
import { walletApi, type ShopWallet, type WalletTransaction, type WithdrawalRequest } from '@/lib/api/wallet.api';

vi.mock('@/lib/api/wallet.api', () => ({
  walletApi: {
    getWallet: vi.fn(),
    getTransactions: vi.fn(),
    getWithdrawals: vi.fn(),
    updateBankInfo: vi.fn(),
    requestWithdrawal: vi.fn(),
  },
}));

const mockWallet: ShopWallet = {
  wallet_id: 'wal-123',
  shop_id: 'shp-123',
  balance: '5000000.00',
  hold_balance: '1000000.00',
  bank_name: 'MB Bank',
  bank_account_number: '0987654321',
  bank_account_holder: 'NGUYEN VAN BAN',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

const mockTransactions: WalletTransaction[] = [
  {
    transaction_id: 'tx-1',
    wallet_id: 'wal-123',
    type: 'SETTLEMENT',
    amount: '950000.00',
    balance_before: '4050000.00',
    balance_after: '5000000.00',
    reference_type: 'ORDER',
    reference_id: 'ord-999',
    description: 'Quyết toán đơn hàng #ord-999 (đã trừ 5% phí sàn)',
    created_at: '2026-10-02T10:00:00Z',
  },
];

const mockWithdrawals: WithdrawalRequest[] = [
  {
    request_id: 'wd-1',
    shop_id: 'shp-123',
    amount: '1000000.00',
    bank_name: 'MB Bank',
    bank_account_number: '0987654321',
    bank_account_holder: 'NGUYEN VAN BAN',
    status: 'PENDING',
    admin_note: null,
    processed_by: null,
    processed_at: null,
    created_at: '2026-10-02T11:00:00Z',
  },
];

describe('SellerWalletScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    });
  });

  it('renders loading skeletons initially, then displays wallet balance and bank account', async () => {
    vi.mocked(walletApi.getWallet).mockResolvedValueOnce(mockWallet);
    vi.mocked(walletApi.getTransactions).mockResolvedValueOnce(mockTransactions);
    vi.mocked(walletApi.getWithdrawals).mockResolvedValueOnce(mockWithdrawals);

    render(<SellerWalletScreen />);

    // Check heading
    expect(screen.getByText('Ví người bán (Escrow & Wallet)')).toBeTruthy();

    // Wait for balance and bank info to appear
    await waitFor(() => {
      expect(screen.getAllByText(/5\.000\.000/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/1\.000\.000/).length).toBeGreaterThan(0);
      expect(screen.getByText('MB Bank')).toBeTruthy();
      expect(screen.getByText('0987654321')).toBeTruthy();
      expect(screen.getByText('NGUYEN VAN BAN')).toBeTruthy();
    });

    // Check transactions tab content
    expect(screen.getByText(/Quyết toán đơn hàng/)).toBeTruthy();
  });

  it('switches to withdrawals tab and shows withdrawal requests', async () => {
    vi.mocked(walletApi.getWallet).mockResolvedValueOnce(mockWallet);
    vi.mocked(walletApi.getTransactions).mockResolvedValueOnce(mockTransactions);
    vi.mocked(walletApi.getWithdrawals).mockResolvedValueOnce(mockWithdrawals);

    const user = userEvent.setup();
    render(<SellerWalletScreen />);

    await waitFor(() => {
      expect(screen.getAllByText(/5\.000\.000/).length).toBeGreaterThan(0);
    });

    // Click withdrawals tab
    await user.click(screen.getByRole('button', { name: /Lệnh rút tiền/ }));

    await waitFor(() => {
      expect(screen.getByText('Chờ duyệt')).toBeTruthy();
    });
  });

  it('allows seller to submit a withdrawal request', async () => {
    vi.mocked(walletApi.getWallet).mockResolvedValue(mockWallet);
    vi.mocked(walletApi.getTransactions).mockResolvedValue(mockTransactions);
    vi.mocked(walletApi.getWithdrawals).mockResolvedValue(mockWithdrawals);
    vi.mocked(walletApi.requestWithdrawal).mockResolvedValueOnce({
      request: mockWithdrawals[0],
      wallet: mockWallet,
      transaction: mockTransactions[0],
    });

    const user = userEvent.setup();
    render(<SellerWalletScreen />);

    await waitFor(() => {
      expect(screen.getAllByText(/5\.000\.000/).length).toBeGreaterThan(0);
    });

    // Click withdrawal button
    await user.click(screen.getByRole('button', { name: /Yêu cầu rút tiền/ }));

    expect(screen.getByText('Yêu cầu rút tiền về tài khoản')).toBeTruthy();

    const amountInput = screen.getByPlaceholderText('Ví dụ: 100000');
    fireEvent.change(amountInput, { target: { value: '200000' } });

    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu rút tiền' }));

    await waitFor(() => {
      expect(walletApi.requestWithdrawal).toHaveBeenCalledWith('200000');
    });
  });
});
