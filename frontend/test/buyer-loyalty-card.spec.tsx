// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BuyerLoyaltyCard } from "@/features/profile/loyalty-card";
import { buyerApi } from "@/lib/api/buyer.api";

vi.mock("@/lib/api/buyer.api", () => ({
  buyerApi: {
    getLoyalty: vi.fn(),
    getLoyaltyHistory: vi.fn(),
  },
}));

describe("BuyerLoyaltyCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Standard tier with points and progress bar towards VIP", async () => {
    vi.mocked(buyerApi.getLoyalty).mockResolvedValue({
      tier: "STANDARD",
      total_spent: "3000000.00",
      loyalty_points: 300,
      vip_threshold: "5000000.00",
      points_multiplier: 1,
      next_tier: "VIP",
    });
    vi.mocked(buyerApi.getLoyaltyHistory).mockResolvedValue({
      items: [
        {
          transaction_id: "tx-1",
          points_delta: 15,
          reference_order_id: "order-12345678",
          reason: "ORDER_COMPLETED",
          created_at: "2026-10-02T10:00:00Z",
        },
      ],
      page: 1,
      limit: 10,
      total: 1,
    });

    render(<BuyerLoyaltyCard />);

    await waitFor(() => {
      expect(screen.getByText("Hạng thành viên & DinoPoint")).toBeTruthy();
    });

    // Check points
    expect(screen.getByText("300")).toBeTruthy();
    expect(screen.getByText("60%")).toBeTruthy();

    // Check history item
    expect(screen.getByText("Hoàn tất đơn hàng")).toBeTruthy();
    expect(screen.getByText("+15")).toBeTruthy();
    expect(screen.getByText("#order-12")).toBeTruthy();
  });

  it("renders VIP tier with VIP badge and x2 perk description", async () => {
    vi.mocked(buyerApi.getLoyalty).mockResolvedValue({
      tier: "VIP",
      total_spent: "6500000.00",
      loyalty_points: 1200,
      vip_threshold: "5000000.00",
      points_multiplier: 2,
      next_tier: null,
    });
    vi.mocked(buyerApi.getLoyaltyHistory).mockResolvedValue({
      items: [],
      page: 1,
      limit: 10,
      total: 0,
    });

    render(<BuyerLoyaltyCard />);

    await waitFor(() => {
      expect(screen.getByText("VIP")).toBeTruthy();
    });

    expect(screen.getByText(/x2 điểm DinoPoint/)).toBeTruthy();
    expect(screen.getByText("1.200")).toBeTruthy();
    expect(screen.getByText("Đạt VIP")).toBeTruthy();
    expect(screen.getByText(/Chưa có giao dịch tích điểm nào/)).toBeTruthy();
  });
});
