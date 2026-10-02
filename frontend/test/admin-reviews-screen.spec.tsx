// @vitest-environment jsdom

import { AuthContext } from "@/lib/auth/auth-context";
import type { AuthContextType } from "@/lib/auth/types";
import { AdminReviewsScreen } from "@/features/admin/admin-reviews-screen";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/reviews", useRouter: () => ({ replace: vi.fn() }) }));

const authValue = {
  user: { id: "admin-1", email: "admin@example.test", role: "ADMIN", fullName: "Admin", shopId: null },
  accessToken: "token", isLoading: false, isAuthenticated: true,
  login: vi.fn(), register: vi.fn(), loginWithGoogle: vi.fn(), verifySignupOtp: vi.fn(),
  resendSignupOtp: vi.fn(), requestPasswordReset: vi.fn(), updatePassword: vi.fn(),
  completeOnboarding: vi.fn(), reloadUser: vi.fn(), logout: vi.fn(), hasRole: () => true,
} as unknown as AuthContextType;

describe("Admin Review moderation UI", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  });
  afterEach(() => vi.unstubAllGlobals());

  it("requires a reason, posts the moderation command, and updates the visible state", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ review_id: "review-1", product_id: "product-1", product_name: "Ấm siêu tốc", buyer_id: "buyer-1", rating: 1, content: "Nội dung vi phạm", status: "VISIBLE", created_at: "2026-09-01T00:00:00.000Z" }] }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: "HIDDEN" } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AuthContext.Provider value={authValue}><AdminReviewsScreen /></AuthContext.Provider>);

    await user.click(await screen.findByRole("button", { name: "Ẩn đánh giá" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Ẩn đánh giá" }));
    expect(await within(dialog).findByRole("alert")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.type(within(dialog).getByLabelText(/^Lý do kiểm duyệt/), "Vi phạm quy định cộng đồng");
    await user.click(within(dialog).getByRole("button", { name: "Ẩn đánh giá" }));
    const row = screen.getByRole("row", { name: /Ấm siêu tốc/ });
    await waitFor(() => expect(within(row).getByText("Đã ẩn")).toBeTruthy());
    const moderationRequest = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(moderationRequest?.[0]).toContain("/admin/reviews/review-1/moderate");
    expect(JSON.parse(String(moderationRequest?.[1]?.body))).toEqual({ status: "HIDDEN", reason: "Vi phạm quy định cộng đồng" });
  });
});
