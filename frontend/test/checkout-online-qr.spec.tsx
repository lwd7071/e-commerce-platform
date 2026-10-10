// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutScreen } from "@/features/checkout/checkout-screen";

const mocks = vi.hoisted(() => ({
  getCart: vi.fn(),
  removeSelected: vi.fn(),
  getAddresses: vi.fn(),
  quoteShipping: vi.fn(),
  submitCheckout: vi.fn(),
  createPayosLink: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/features/cart/cart.repository", () => ({
  cartRepository: {
    getCart: mocks.getCart,
    removeSelected: mocks.removeSelected,
  },
}));

vi.mock("@/features/checkout/checkout.repository", () => ({
  checkoutRepository: {
    getAddresses: mocks.getAddresses,
    quoteShipping: mocks.quoteShipping,
    submitCheckout: mocks.submitCheckout,
    getVouchers: vi.fn().mockResolvedValue([]),
    evaluateVoucher: vi.fn(),
    createAddress: vi.fn(),
  },
}));

vi.mock("@/lib/api/wallet.api", () => ({
  walletApi: {
    createPayosLink: mocks.createPayosLink,
  },
}));

const cart = [{
  id: "cart-item-1", variantId: "variant-1", productId: "product-1", productName: "Áo thun Dino",
  variantName: "Đen", price: "45000.00", quantity: 1, stock: 10, shopId: "shop-1", shopName: "Dino Shop",
  imageUrl: null, isSelected: true, isAvailable: true, productStatus: "ACTIVE" as const,
  variantStatus: "ACTIVE" as const, shopStatus: "ACTIVE",
}];

const address = [{
  addressId: "address-1", recipientName: "Nguyễn Văn A", phone: "0901234567", province: "Hà Nội",
  provinceCode: "01", district: null, ward: "Ba Đình", wardCode: "00004", detailAddress: "123 Phố Huế", isDefault: true,
}];

const quote = [{ shop_id: "shop-1", fee: "0.00", weight_grams: 200, provider: "mock" as const }];

const createdOrder = {
  orders: [{
    order_id: "order-999",
    shop_id: "shop-1",
    status: "PENDING_CONFIRMATION",
    total_amount: "45000.00",
    payment_id: "payment-999",
  }],
};

const payosLinkData = {
  order_id: "order-999",
  order_code: 123456789,
  amount: 45000,
  checkout_url: "https://pay.payos.vn/web/test123456",
  qr_code: "vietqr_code_sample",
  bin: "970407",
  account_number: "0987654321",
  account_name: "SAN TMDT DINO",
};

describe("Checkout Online VietQR Auto Generation", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    sessionStorage.clear();
    vi.clearAllMocks();
    mocks.getCart.mockResolvedValue(cart);
    mocks.removeSelected.mockResolvedValue(undefined);
    mocks.getAddresses.mockResolvedValue(address);
    mocks.quoteShipping.mockResolvedValue(quote);
    mocks.submitCheckout.mockResolvedValue(createdOrder);
    mocks.createPayosLink.mockResolvedValue(payosLinkData);
  });

  afterEach(() => cleanup());

  it("tự động tạo mã VietQR và hiển thị thông tin tài khoản khi chọn thanh toán ONLINE", async () => {
    const user = userEvent.setup();
    render(<CheckoutScreen />);

    // 1. Chọn phương thức ONLINE
    const onlineRadio = await screen.findByRole("radio", { name: /Thanh toán trực tuyến/i });
    await user.click(onlineRadio);

    // 2. Bấm đặt hàng
    const submitBtn = screen.getByRole("button", { name: /Đặt hàng ngay/ });
    await user.click(submitBtn);

    // 3. Tự động gọi createPayosLink cho order vừa tạo
    await waitFor(() => {
      expect(mocks.createPayosLink).toHaveBeenCalledWith("order-999");
    });

    // 4. Modal phải hiển thị thông tin mã VietQR và tài khoản
    expect(await screen.findByText(/0987654321/)).toBeTruthy();
    expect(screen.getByText(/SAN TMDT DINO/)).toBeTruthy();
    expect(screen.getByText(/Mã VietQR thanh toán/i)).toBeTruthy();
  });
});
