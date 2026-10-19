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
vi.mock("@/lib/api/buyer.api", () => ({ buyerApi: { getAddresses: vi.fn() } }));
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
    const detailInput = within(form!).getByLabelText("Địa chỉ chi tiết") as HTMLInputElement;
    expect(detailInput.value).toBe("Ấp An Thịnh");
    expect(within(form!).queryByLabelText("Thôn/ấp/tổ dân phố")).toBeNull();

    const province = within(form!).getByRole("combobox", { name: "Tỉnh/thành phố" });
    const ward = within(form!).getByRole("combobox", { name: "Phường/xã" });
    expect(province.compareDocumentPosition(ward) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ward.compareDocumentPosition(detailInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(detailInput.parentElement?.className).toContain("sm:col-span-2");
  });
});
