// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import { ProfileScreen } from "@/features/profile/profile-screen";
import type { ProfileRequestState } from "@/features/profile/profile-request-state";

vi.mock("@/features/profile/address-manager", () => ({ AddressManager: () => <div>Địa chỉ giao hàng</div> }));
vi.mock("@/lib/api/buyer.api", () => ({
  buyerApi: {
    updateProfile: vi.fn().mockRejectedValue(new Error("Máy chủ tạm thời không khả dụng")),
    updateAvatar: vi.fn().mockResolvedValue({ avatar_url: "https://storage.test/profile/avatar.jpg" }),
  },
}));
vi.mock("@/lib/api/media.api", () => ({
  uploadMediaAsset: vi.fn().mockResolvedValue({ mediaId: "avatar-media-id", url: "https://storage.test/profile/avatar.jpg" }),
}));

const ready: ProfileRequestState = {
  status: "ready",
  profile: { email: "buyer@dino.vn", role: "BUYER", fullName: "Nguyễn An", phone: "0900000000" },
};

describe("ProfileScreen request state UI", () => {
  it("renders distinct loading, signed-out, missing, and API error states", () => {
    const retry = vi.fn();
    const { rerender } = render(<ProfileScreen state={{ status: "loading" }} onRetry={retry} />);
    expect(screen.getByLabelText("Đang tải hồ sơ")).toBeTruthy();

    rerender(<ProfileScreen state={{ status: "signed_out" }} onRetry={retry} />);
    expect(screen.getByRole("link", { name: "Đăng nhập" }).getAttribute("href")).toBe("/login?returnTo=%2Fprofile");

    rerender(<ProfileScreen state={{ status: "missing" }} onRetry={retry} />);
    expect(screen.getByRole("link", { name: "Hoàn tất hồ sơ" })).toBeTruthy();

    rerender(<ProfileScreen state={{ status: "error", message: "Không kết nối được", requestId: "req-1" }} onRetry={retry} />);
    expect(screen.getByText(/Mã yêu cầu: req-1/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeTruthy();
  });

  it("keeps user-entered profile values when saving fails", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ProfileScreen state={ready} onRetry={vi.fn()} /></ToastProvider>);

    const name = screen.getByLabelText("Họ và tên");
    await user.clear(name);
    await user.type(name, "Tên vừa chỉnh");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((name as HTMLInputElement).value).toBe("Tên vừa chỉnh");
    expect((screen.getByLabelText("Số điện thoại") as HTMLInputElement).value).toBe("0900000000");
  });

  it("uploads an avatar through media_id and renders the server URL", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ProfileScreen state={ready} onRetry={vi.fn()} /></ToastProvider>);
    const input = screen.getByTestId("profile-avatar-upload") as HTMLInputElement;
    const avatar = new File([new Uint8Array([1, 2, 3])], "lvvd.jpg", { type: "image/jpeg" });
    await user.upload(input, avatar);

    const renderedAvatar = await screen.findByRole("img", { name: "Ảnh đại diện của Nguyễn An" });
    expect(renderedAvatar.getAttribute("src")).toBe("https://storage.test/profile/avatar.jpg");
    const { buyerApi } = await import("@/lib/api/buyer.api");
    expect(buyerApi.updateAvatar).toHaveBeenCalledWith("avatar-media-id");
  });
});
