// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SellerOrdersScreen } from "@/features/seller/seller-orders-screen";

const { mockGetOrdersPaginated } = vi.hoisted(() => ({ mockGetOrdersPaginated: vi.fn() }));

vi.mock("@/components/navigation/protected-page", () => ({ ProtectedPage: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => vi.fn() }));
vi.mock("@/lib/repositories/repository-factory", () => ({
  repositories: { order: () => ({ getOrdersPaginated: mockGetOrdersPaginated }) },
}));

const baseOrder = {
  buyer_id: "buyer-1", shop_id: "shop-1", shop_name: "Dino Store", status: "CONFIRMED" as const,
  subtotal: "100000.00", total_amount: "100000.00", shipping_fee: "0.00", discount_amount: "0.00",
  created_at: "2026-10-19T00:00:00.000Z", items: [], payments: [],
};

describe("SellerOrdersScreen payment status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrdersPaginated.mockResolvedValue({
      data: [
        { ...baseOrder, id: "online-order", payments: [{ payment_id: "payment-1", method: "ONLINE", status: "SUCCESS", paid_at: "2026-10-19T00:00:00.000Z" }] },
        { ...baseOrder, id: "cod-order", payments: [{ payment_id: "payment-2", method: "COD", status: "PENDING", paid_at: null }] },
        { ...baseOrder, id: "waiting-order", payments: [{ payment_id: "payment-3", method: "ONLINE", status: "PENDING", paid_at: null }] },
      ],
      meta: { limit: 20, has_more: false, next_cursor: null },
    });
  });

  afterEach(() => vi.useRealTimers());

  it("distinguishes online payments confirmed by the gateway from pending and COD payments", async () => {
    render(<SellerOrdersScreen />);

    expect((await screen.findAllByText("Đã thanh toán online")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Thanh toán khi nhận hàng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chờ thanh toán online").length).toBeGreaterThan(0);
  });

  it("refreshes payment state while the seller order page is open", async () => {
    vi.useFakeTimers();
    const waiting = { ...baseOrder, id: "online-order", payments: [{ payment_id: "payment-1", method: "ONLINE", status: "PENDING", paid_at: null }] };
    const paid = { ...baseOrder, id: "online-order", payments: [{ payment_id: "payment-1", method: "ONLINE", status: "SUCCESS", paid_at: "2026-10-19T00:00:00.000Z" }] };
    const page = (data: unknown[]) => ({ data, meta: { limit: 20, has_more: false, next_cursor: null } });
    mockGetOrdersPaginated.mockReset().mockResolvedValueOnce(page([waiting])).mockResolvedValueOnce(page([paid]));

    render(<SellerOrdersScreen />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getAllByText("Chờ thanh toán online").length).toBeGreaterThan(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getAllByText("Đã thanh toán online").length).toBeGreaterThan(0);
  });
});
