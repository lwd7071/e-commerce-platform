// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminFinanceScreen } from '@/features/admin/admin-finance-screen';
import { walletApi, type FinanceOverview, type WithdrawalRequest } from '@/lib/api/wallet.api';

vi.mock('@/lib/api/wallet.api', () => ({
  walletApi: {
    getFinanceOverview: vi.fn(),
    getAdminWithdrawals: vi.fn(),
    approveWithdrawal: vi.fn(),
    rejectWithdrawal: vi.fn(),
  },
}));

const mockOverview: FinanceOverview = {
  total_escrow_holding: '15000000.00',
  total_commission_collected: '750000.00',
  total_wallets_balance: '14250000.00',
  total_withdrawn: '5000000.00',
  pending_withdrawals_count: 2,
};

const mockWithdrawals: WithdrawalRequest[] = [
  {
    request_id: 'wd-req-001',
    shop_id: 'shp-1',
    amount: '2000000.00',
    bank_name: 'Techcombank',
    bank_account_number: '1903123456789',
    bank_account_holder: 'TRAN VAN A',
    status: 'PENDING',
    admin_note: null,
    processed_by: null,
    processed_at: null,
    created_at: '2026-10-02T12:00:00Z',
  },
  {
    request_id: 'wd-req-002',
    shop_id: 'shp-2',
    amount: '1500000.00',
    bank_name: 'Vietcombank',
    bank_account_number: '0071000123456',
    bank_account_holder: 'LE THI B',
    status: 'APPROVED',
    admin_note: 'FT999888 qua VietQR',
    processed_by: 'admin-1',
    processed_at: '2026-10-01T11:00:00Z',
    created_at: '2026-10-01T10:00:00Z',
  },
];

describe('AdminFinanceScreen', () => {
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

  it('renders overview metrics and withdrawal list', async () => {
    vi.mocked(walletApi.getFinanceOverview).mockResolvedValueOnce(mockOverview);
    vi.mocked(walletApi.getAdminWithdrawals).mockResolvedValueOnce(mockWithdrawals);

    render(<AdminFinanceScreen />);

    expect(screen.getByText('Quản lý Tài chính & Ký quỹ sàn (Escrow)')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getAllByText(/15\.000\.000/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/750\.000/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/14\.250\.000/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/5\.000\.000/).length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Techcombank')).toBeTruthy();
    expect(screen.getByText(/1903123456789/)).toBeTruthy();
    expect(screen.getByText('TRAN VAN A')).toBeTruthy();
  });

  it('allows admin to approve a withdrawal request', async () => {
    vi.mocked(walletApi.getFinanceOverview).mockResolvedValue(mockOverview);
    vi.mocked(walletApi.getAdminWithdrawals).mockResolvedValue(mockWithdrawals);
    vi.mocked(walletApi.approveWithdrawal).mockResolvedValueOnce({
      request: { ...mockWithdrawals[0], status: 'APPROVED', processed_by: 'admin-1', processed_at: '2026-10-02T12:00:00Z' },
      wallet: {
        wallet_id: 'wal-1',
        shop_id: 'shp-1',
        balance: '0',
        hold_balance: '0',
        bank_name: null,
        bank_account_number: null,
        bank_account_holder: null,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-02T12:00:00Z',
      },
      transaction: {
        transaction_id: 'tx-app',
        wallet_id: 'wal-1',
        type: 'WITHDRAWAL_SUCCESS',
        amount: '-2000000.00',
        balance_before: '0',
        balance_after: '0',
        reference_type: 'WITHDRAWAL',
        reference_id: 'wd-req-001',
        description: 'Rút tiền hoàn tất',
        created_at: '2026-10-02T12:00:00Z',
      },
    });

    const user = userEvent.setup();
    render(<AdminFinanceScreen />);

    await waitFor(() => {
      expect(screen.getByText('Techcombank')).toBeTruthy();
    });

    // Click "Duyệt & Chi tiền"
    await user.click(screen.getByRole('button', { name: 'Duyệt & Chi tiền' }));

    expect(screen.getByText('Xác nhận duyệt chuyển tiền')).toBeTruthy();

    const noteInput = screen.getByPlaceholderText('Ví dụ: FT12345678 qua VietQR');
    fireEvent.change(noteInput, { target: { value: 'TX-PAYOUT-888' } });

    await user.click(screen.getByRole('button', { name: 'Xác nhận đã chi tiền' }));

    await waitFor(() => {
      expect(walletApi.approveWithdrawal).toHaveBeenCalledWith('wd-req-001', 'TX-PAYOUT-888');
    });
  });

  it('allows admin to reject a withdrawal request', async () => {
    vi.mocked(walletApi.getFinanceOverview).mockResolvedValue(mockOverview);
    vi.mocked(walletApi.getAdminWithdrawals).mockResolvedValue(mockWithdrawals);
    vi.mocked(walletApi.rejectWithdrawal).mockResolvedValueOnce({
      request: { ...mockWithdrawals[0], status: 'REJECTED', processed_by: 'admin-1', processed_at: '2026-10-02T12:00:00Z' },
      wallet: {
        wallet_id: 'wal-1',
        shop_id: 'shp-1',
        balance: '2000000.00',
        hold_balance: '0',
        bank_name: null,
        bank_account_number: null,
        bank_account_holder: null,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-02T12:00:00Z',
      },
      transaction: {
        transaction_id: 'tx-rej',
        wallet_id: 'wal-1',
        type: 'WITHDRAWAL_REJECTED',
        amount: '2000000.00',
        balance_before: '0',
        balance_after: '2000000.00',
        reference_type: 'WITHDRAWAL',
        reference_id: 'wd-req-001',
        description: 'Hoàn trả tiền',
        created_at: '2026-10-02T12:00:00Z',
      },
    });

    const user = userEvent.setup();
    render(<AdminFinanceScreen />);

    await waitFor(() => {
      expect(screen.getByText('Techcombank')).toBeTruthy();
    });

    // Click "Từ chối" in the row
    const row = screen.getByText('Techcombank').closest('tr')!;
    const rejectBtn = within(row).getByRole('button', { name: 'Từ chối' });
    await user.click(rejectBtn);

    expect(screen.getByText('Từ chối yêu cầu rút tiền')).toBeTruthy();

    const noteInput = screen.getByPlaceholderText('Ví dụ: Sai số tài khoản hoặc tên chủ tài khoản');
    fireEvent.change(noteInput, { target: { value: 'Số tài khoản không chính xác' } });

    await user.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }));

    await waitFor(() => {
      expect(walletApi.rejectWithdrawal).toHaveBeenCalledWith('wd-req-001', 'Số tài khoản không chính xác');
    });
  });
});
