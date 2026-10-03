// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppError } from '@/lib/api/app-error';
import { CheckoutScreen } from '@/features/checkout/checkout-screen';

const mocks = vi.hoisted(() => ({
  getCart: vi.fn(),
  removeSelected: vi.fn(),
  getAddresses: vi.fn(),
  quoteShipping: vi.fn(),
  submitCheckout: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/features/cart/cart.repository', () => ({ cartRepository: { getCart: mocks.getCart, removeSelected: mocks.removeSelected } }));
vi.mock('@/features/checkout/checkout.repository', () => ({ checkoutRepository: {
  getAddresses: mocks.getAddresses,
  quoteShipping: mocks.quoteShipping,
  submitCheckout: mocks.submitCheckout,
  getVouchers: vi.fn().mockResolvedValue([]),
  evaluateVoucher: vi.fn(),
  createAddress: vi.fn(),
} }));

const cart = [{
  id: 'cart-item-1', variantId: 'variant-1', productId: 'product-1', productName: 'Áo linen',
  variantName: 'Màu', price: '100000.00', quantity: 1, stock: 10, shopId: 'shop-1', shopName: 'Shop Linen',
  imageUrl: null, isSelected: true, isAvailable: true, productStatus: 'ACTIVE' as const,
  variantStatus: 'ACTIVE' as const, shopStatus: 'ACTIVE',
}];
const address = [{
  addressId: 'address-1', recipientName: 'Nguyễn An', phone: '0900000000', province: 'Hà Nội',
  provinceCode: '01', district: null, ward: 'Ba Đình', wardCode: '00004', detailAddress: '1 phố X', isDefault: true,
}];
const quote = (fee: string) => [{ shop_id: 'shop-1', fee, weight_grams: 400, provider: 'mock' as const }];
const createdOrder = { orders: [{ order_id: 'order-1', shop_id: 'shop-1', status: 'PENDING_CONFIRMATION', total_amount: '110000.00', payment_id: 'payment-1' }] };

describe('Checkout shipping quote flow', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    sessionStorage.clear();
    vi.clearAllMocks();
    mocks.getCart.mockResolvedValue(cart);
    mocks.removeSelected.mockResolvedValue(undefined);
    mocks.getAddresses.mockResolvedValue(address);
    mocks.quoteShipping.mockResolvedValue(quote('10000.00'));
    mocks.submitCheckout.mockResolvedValue(createdOrder);
  });
  afterEach(() => cleanup());

  it('shows the per-shop quote in the shipment step and sends it as checkout confirmation', async () => {
    const user = userEvent.setup();
    render(<CheckoutScreen />);

    expect(await screen.findByText('Giao từ Shop Linen')).toBeTruthy();
    expect(await screen.findByText(/Vận chuyển \(10\.000/)).toBeTruthy();
    expect(screen.getByText('Phí vận chuyển mô phỏng.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Đặt hàng ngay/ }));
    await waitFor(() => expect(mocks.submitCheckout).toHaveBeenCalledTimes(1));
    expect(mocks.submitCheckout.mock.calls[0][0]).toMatchObject({
      address_id: 'address-1', expected_shipping_fees: [{ shop_id: 'shop-1', fee: '10000.00' }],
    });
  });

  it('shows a changed quote and requires another submit with the refreshed per-shop fee', async () => {
    const user = userEvent.setup();
    mocks.submitCheckout
      .mockRejectedValueOnce(new AppError({
        status: 409, code: 'SHIPPING_QUOTE_CHANGED', message: 'Shipping fee changed',
        details: { quotes: quote('15000.00') },
      }))
      .mockResolvedValueOnce({ ...createdOrder, orders: [{ ...createdOrder.orders[0], total_amount: '115000.00' }] });
    render(<CheckoutScreen />);

    await user.click(await screen.findByRole('button', { name: /Đặt hàng ngay/ }));
    expect(await screen.findByText(/Phí vận chuyển vừa thay đổi/)).toBeTruthy();
    expect(await screen.findByText(/Vận chuyển \(15\.000/)).toBeTruthy();
    expect(screen.getAllByText((_, element) => element?.textContent?.includes('115.000') ?? false).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Đặt hàng ngay/ }));
    await waitFor(() => expect(mocks.submitCheckout).toHaveBeenCalledTimes(2));
    expect(mocks.submitCheckout.mock.calls[1][0].expected_shipping_fees).toEqual([{ shop_id: 'shop-1', fee: '15000.00' }]);
    expect(mocks.submitCheckout.mock.calls[1][1]).not.toBe(mocks.submitCheckout.mock.calls[0][1]);
  });
});
