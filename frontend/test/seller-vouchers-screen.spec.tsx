// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SellerVouchersScreen } from '@/features/seller/seller-vouchers-screen';
import { sellerVoucherApi, type SellerVoucher } from '@/lib/api/seller-voucher.api';

vi.mock('@/lib/api/seller-voucher.api', () => ({
  sellerVoucherApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn(),
  },
}));

const mockVoucher: SellerVoucher = {
  voucher_id: '00000000-0000-0000-0000-000000000001',
  shop_id: '00000000-0000-0000-0000-000000000010',
  code: 'SHOP10K',
  voucher_name: 'Giảm 10K cho đơn từ 100K',
  discount_type: 'FIXED',
  discount_value: '10000.00',
  max_discount: null,
  min_order_value: '100000.00',
  quantity: 50,
  used_count: 5,
  status: 'ACTIVE',
  start_at: '2026-10-01T00:00:00.000Z',
  end_at: '2026-10-31T23:59:59.000Z',
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
};

describe('SellerVouchersScreen UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders vouchers list from API', async () => {
    vi.mocked(sellerVoucherApi.list).mockResolvedValueOnce([mockVoucher]);

    render(<SellerVouchersScreen />);

    expect(await screen.findByText('SHOP10K')).toBeTruthy();
    expect(screen.getByText('Giảm 10K cho đơn từ 100K')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
  });

  it('creates a new voucher upon form submission', async () => {
    vi.mocked(sellerVoucherApi.list).mockResolvedValue([mockVoucher]);
    vi.mocked(sellerVoucherApi.create).mockResolvedValueOnce(mockVoucher);

    const user = userEvent.setup();
    render(<SellerVouchersScreen />);

    expect(await screen.findByText('SHOP10K')).toBeTruthy();

    await user.type(screen.getByLabelText(/Mã voucher/), 'DISCOUNT10');
    await user.type(screen.getByLabelText(/Tên voucher/), 'Giảm 10%');
    await user.type(screen.getByLabelText(/Phần trăm giảm/), '10');
    await user.type(screen.getByLabelText(/Bắt đầu/), '2026-10-01T08:00');
    await user.type(screen.getByLabelText(/Kết thúc/), '2026-10-15T20:00');

    await user.click(screen.getByRole('button', { name: 'Tạo voucher' }));

    await waitFor(() => {
      expect(sellerVoucherApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DISCOUNT10',
          voucher_name: 'Giảm 10%',
          discount_value: '10',
        }),
      );
    });
  });

  it('toggles an active voucher to inactive', async () => {
    vi.mocked(sellerVoucherApi.list).mockResolvedValueOnce([mockVoucher]);
    vi.mocked(sellerVoucherApi.setStatus).mockResolvedValueOnce({
      ...mockVoucher,
      status: 'INACTIVE',
    });

    const user = userEvent.setup();
    render(<SellerVouchersScreen />);

    expect(await screen.findByText('SHOP10K')).toBeTruthy();

    const toggleBtn = screen.getByRole('button', { name: 'Tắt' });
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(sellerVoucherApi.setStatus).toHaveBeenCalledWith(mockVoucher.voucher_id, 'INACTIVE');
    });
    expect(await screen.findByText('Đã tắt voucher.')).toBeTruthy();
  });
});
