// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OrderCard } from '@/features/orders/order-card';
import { walletApi, type PayosLinkResult } from '@/lib/api/wallet.api';
import type { WireOrder } from '@/lib/api/order.api';

vi.mock('@/lib/api/wallet.api', () => ({
  walletApi: {
    createPayosLink: vi.fn(),
  },
}));

const mockOrder: WireOrder = {
  id: 'ord-vietqr-100',
  order_code: 'DH100',
  buyer_id: 'buyer-1',
  shop_id: 'shop-1',
  shop_name: 'Dino Official Store',
  status: 'PENDING_CONFIRMATION',
  total_amount: '250000.00',
  shipping_fee: '30000.00',
  discount_amount: '0.00',
  subtotal: '220000.00',
  cancel_reason: null,
  created_at: '2026-10-02T10:00:00Z',
  items: [
    {
      id: 'item-1',
      product_name: 'Áo thun Dino Premium',
      variant_name: 'Size L - Đen',
      price: '220000.00',
      quantity: 1,
      subtotal: '220000.00',
    },
  ],
};

const mockPayosLink: PayosLinkResult = {
  order_id: 'ord-vietqr-100',
  order_code: 100,
  amount: 250000,
  checkout_url: 'https://pay.payos.vn/web/test-checkout-100',
  qr_code: 'vietqr-code-data',
  bin: '970422',
  account_number: '0987654321',
  account_name: 'CONG TY SAN TMDT DINO',
};

describe('OrderCard PayOS VietQR Payment Flow', () => {
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

  it('renders "Thanh toán VietQR" button when order is in PENDING_CONFIRMATION', () => {
    render(<OrderCard order={mockOrder} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Thanh toán VietQR/ })).toBeTruthy();
  });

  it('opens PayOS VietQR dialog and displays payment details on click', async () => {
    vi.mocked(walletApi.createPayosLink).mockResolvedValueOnce(mockPayosLink);

    const user = userEvent.setup();
    render(<OrderCard order={mockOrder} onCancel={vi.fn()} />);

    const payButton = screen.getByRole('button', { name: /Thanh toán VietQR/ });
    await user.click(payButton);

    await waitFor(() => {
      expect(walletApi.createPayosLink).toHaveBeenCalledWith('ord-vietqr-100');
    });

    expect(await screen.findByText('Thanh toán đơn hàng qua VietQR (PayOS)')).toBeTruthy();
    expect(screen.getByText('CONG TY SAN TMDT DINO')).toBeTruthy();
    expect(screen.getByText('0987654321')).toBeTruthy();
    expect(screen.getByText(/Mở cổng thanh toán PayOS/)).toBeTruthy();
  });

  it('displays error message when generating VietQR link fails', async () => {
    vi.mocked(walletApi.createPayosLink).mockRejectedValueOnce(new Error('Cổng thanh toán quá tải'));

    const user = userEvent.setup();
    render(<OrderCard order={mockOrder} onCancel={vi.fn()} />);

    const payButton = screen.getByRole('button', { name: /Thanh toán VietQR/ });
    await user.click(payButton);

    await waitFor(() => {
      expect(screen.getByText('Cổng thanh toán quá tải')).toBeTruthy();
    });
  });
});
