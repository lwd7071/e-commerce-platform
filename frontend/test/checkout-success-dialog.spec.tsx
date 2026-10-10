// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutScreen } from '@/features/checkout/checkout-screen';

const mocks = vi.hoisted(() => ({
  getCart: vi.fn(),
  removeSelected: vi.fn(),
  getAddresses: vi.fn(),
  quoteShipping: vi.fn(),
  submitCheckout: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/features/cart/cart.repository', () => ({
  cartRepository: {
    getCart: mocks.getCart,
    removeSelected: mocks.removeSelected,
  },
}));

vi.mock('@/features/checkout/checkout.repository', () => ({
  checkoutRepository: {
    getAddresses: mocks.getAddresses,
    quoteShipping: mocks.quoteShipping,
    submitCheckout: mocks.submitCheckout,
    getVouchers: vi.fn().mockResolvedValue([]),
    evaluateVoucher: vi.fn(),
    createAddress: vi.fn(),
  },
}));

const cart = [{
  id: 'cart-item-1', variantId: 'variant-1', productId: 'product-1', productName: 'Áo thun Dino',
  variantName: 'Đen', price: '45000.00', quantity: 1, stock: 10, shopId: 'shop-1', shopName: 'Dino Shop',
  imageUrl: null, isSelected: true, isAvailable: true, productStatus: 'ACTIVE' as const,
  variantStatus: 'ACTIVE' as const, shopStatus: 'ACTIVE',
}];

const address = [{
  addressId: 'address-1', recipientName: 'Nguyễn Văn A', phone: '0901234567', province: 'Hà Nội',
  provinceCode: '01', district: null, ward: 'Ba Đình', wardCode: '00004', detailAddress: '123 Phố Huế', isDefault: true,
}];

const quote = [{ shop_id: 'shop-1', fee: '0.00', weight_grams: 200, provider: 'mock' as const }];
const createdOrder = {
  orders: [{
    order_id: 'order-123',
    shop_id: 'shop-1',
    status: 'PENDING_CONFIRMATION',
    total_amount: '45000.00',
    payment_id: 'payment-123',
  }],
};

describe('Checkout success dialog behavior', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    sessionStorage.clear();
    vi.clearAllMocks();
    mocks.getCart.mockResolvedValue(cart);
    mocks.removeSelected.mockResolvedValue(undefined);
    mocks.getAddresses.mockResolvedValue(address);
    mocks.quoteShipping.mockResolvedValue(quote);
    mocks.submitCheckout.mockResolvedValue(createdOrder);
  });

  afterEach(() => cleanup());

  it('giữ dialog Đặt hàng thành công hiển thị và chỉ chuyển hướng khi người dùng chủ động bấm Xem đơn hàng', async () => {
    const user = userEvent.setup();
    render(<CheckoutScreen />);

    // Chờ giao diện load xong
    const submitBtn = await screen.findByRole('button', { name: /Đặt hàng ngay/ });
    await user.click(submitBtn);

    // Xác nhận đã gọi checkout
    await waitFor(() => expect(mocks.submitCheckout).toHaveBeenCalledTimes(1));

    // Dialog thành công phải hiển thị trên màn hình
    expect(await screen.findByText('Đặt hàng thành công!')).toBeTruthy();

    // router.push KHÔNG ĐƯỢC gọi tự động ngay lập tức (tránh hiện tượng chớp tắt)
    expect(mocks.push).not.toHaveBeenCalled();

    // Bấm nút Xem đơn hàng trong Dialog
    const viewOrderBtn = screen.getByRole('button', { name: 'Xem đơn hàng' });
    await user.click(viewOrderBtn);

    // Lúc này router.push mới được gọi để chuyển sang trang đơn hàng
    expect(mocks.push).toHaveBeenCalledWith('/orders?created=order-123');
  });
});
