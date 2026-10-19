// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddressManager } from "@/features/profile/address-manager";
import { QueryProvider } from "@/lib/query/query-provider";
import { clearAppQueryCache } from "@/lib/query/query-client";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthContextType } from "@/lib/auth/types";
import { buyerApi, type WireAddress } from "@/lib/api/buyer.api";

vi.mock("@/lib/auth/auth-context", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api/buyer.api", () => ({ buyerApi: { getAddresses: vi.fn(), createAddress: vi.fn(), updateAddress: vi.fn() } }));
const mockUseAuth = vi.mocked(useAuth);

const authValue = (id: string, email: string): AuthContextType => ({
  user: { id, email, role: "BUYER" },
  accessToken: null,
  isLoading: false,
  isAuthenticated: true,
  login: vi.fn(),
  register: vi.fn(async () => "mock" as const),
  loginWithGoogle: vi.fn(),
  verifySignupOtp: vi.fn(),
  resendSignupOtp: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  completeOnboarding: vi.fn(),
  reloadUser: vi.fn(),
  logout: vi.fn(),
  hasRole: vi.fn(() => true),
});

describe("Address manager loading layout", () => {
  beforeEach(() => {
    clearAppQueryCache();
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(authValue("buyer-1", "buyer@test.vn"));
    vi.mocked(buyerApi.getAddresses).mockReturnValue(new Promise(() => {}));
  });

  it("announces address loading and reserves at least 220px", () => {
    render(<QueryProvider><AddressManager /></QueryProvider>);
    const status = screen.getByRole("status", { name: "Đang tải địa chỉ" });

    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.className).toContain("min-h-[220px]");
    expect(status.children).toHaveLength(2);
  });

  it("does not display another account's cached addresses", async () => {
    const address = (recipientName: string): WireAddress => ({
      addressId: recipientName,
      recipientName,
      phone: "0900000000",
      province: "Hà Nội",
      district: "Ba Đình",
      ward: "Điện Biên",
      detailAddress: "Số 1",
      isDefault: true,
      provinceCode: null,
      wardCode: null,
    });
    vi.mocked(buyerApi.getAddresses)
      .mockResolvedValueOnce([address("Địa chỉ A")])
      .mockResolvedValueOnce([address("Địa chỉ B")]);
    mockUseAuth.mockReturnValue(authValue("buyer-1", "buyer@test.vn"));

    const view = render(<QueryProvider><AddressManager /></QueryProvider>);
    await waitFor(() => expect(screen.getByText(/Địa chỉ A/)).toBeTruthy());

    mockUseAuth.mockReturnValue(authValue("buyer-2", "second@test.vn"));
    view.rerender(<QueryProvider><AddressManager /></QueryProvider>);

    expect(screen.queryByText(/Địa chỉ A/)).toBeNull();
    await waitFor(() => expect(screen.getByText(/Địa chỉ B/)).toBeTruthy());
    expect(buyerApi.getAddresses).toHaveBeenCalledTimes(2);
  });

  it("keeps a legacy locality once in the full-width detail address field", async () => {
    const user = userEvent.setup();
    vi.mocked(buyerApi.getAddresses).mockResolvedValueOnce([{
      addressId: "legacy-address",
      recipientName: "Lương Việt Ví Đồng",
      phone: "0399597291",
      province: "Đồng Tháp",
      provinceCode: "82",
      ward: "Hồng Ngự",
      wardCode: "00000",
      district: "Ấp An Thịnh",
      detailAddress: "Ấp An Thịnh",
      isDefault: true,
    }]);

    render(<QueryProvider><AddressManager /></QueryProvider>);
    await screen.findByText("Lương Việt Ví Đồng · 0399597291", { exact: false });
    expect(screen.getByText("Ấp An Thịnh, Hồng Ngự, Đồng Tháp")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Sửa" }));

    const form = screen.getByRole("button", { name: "Hủy" }).closest("form");
    expect(form).toBeTruthy();
    const detailInput = within(form!).getByRole("textbox", { name: /Địa chỉ chi tiết/ }) as HTMLInputElement;
    expect(detailInput.value).toBe("Ấp An Thịnh");
    expect(within(form!).queryByLabelText("Thôn/ấp/tổ dân phố")).toBeNull();

    const province = within(form!).getByRole("combobox", { name: "Tỉnh/thành phố" });
    const ward = within(form!).getByRole("combobox", { name: "Phường/xã" });
    expect(province.compareDocumentPosition(ward) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ward.compareDocumentPosition(detailInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(detailInput.parentElement?.parentElement?.className).toContain("sm:col-span-2");
  });

  it("shows invalid recipient data inline and does not submit it", async () => {
    const user = userEvent.setup();
    render(<QueryProvider><AddressManager /></QueryProvider>);
    await user.click(screen.getByRole("button", { name: "Thêm địa chỉ" }));
    const recipient = screen.getByRole("textbox", { name: /Người nhận/ });
    await user.type(recipient, "A".repeat(101));
    expect(await screen.findByText("Tên người nhận tối đa 100 ký tự.")).toBeTruthy();
    expect(recipient.getAttribute("aria-invalid")).toBe("true");

    await user.clear(recipient);
    await user.type(recipient, "Nguyễn Văn A");
    const phone = screen.getByRole("textbox", { name: /Số điện thoại/ });
    await user.type(phone, "09123456789");
    expect(await screen.findByText("Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Lưu địa chỉ" }));
    expect(buyerApi.createAddress).not.toHaveBeenCalled();
  });
});
