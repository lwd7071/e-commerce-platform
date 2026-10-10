// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BuyerLoyaltyCard } from "@/features/profile/loyalty-card";
import type { BuyerLoyaltyInfo, BuyerLoyaltyHistory } from "@/lib/api/buyer.api";

describe("BuyerLoyaltyCard Synchronized Loading & UI tokens", () => {
  const mockLoyalty: BuyerLoyaltyInfo = {
    tier: "STANDARD",
    total_spent: "2500000.00",
    loyalty_points: 250,
    vip_threshold: "5000000.00",
    points_multiplier: 1,
    next_tier: "VIP",
  };

  const mockHistory: BuyerLoyaltyHistory = {
    items: [
      {
        transaction_id: "tx-1",
        points_delta: 25,
        reference_order_id: "order-9999",
        reason: "ORDER_COMPLETED",
        created_at: "2026-10-05T08:00:00Z",
      },
    ],
    page: 1,
    limit: 10,
    total: 1,
  };

  it("renders instantly with synchronous props without triggering internal fetch waterfall", () => {
    render(
      <BuyerLoyaltyCard
        initialLoyalty={mockLoyalty}
        initialHistory={mockHistory}
        isLoading={false}
      />
    );

    // Render ngay tức thì không cần đợi useEffect hay hiển thị spinner
    expect(screen.getByText("Hạng thành viên & DinoPoint")).toBeTruthy();
    expect(screen.getByText("250")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("Hoàn tất đơn hàng")).toBeTruthy();
  });

  it("does not render raw emoji ⭐ and uses vector star icon", () => {
    render(
      <BuyerLoyaltyCard
        initialLoyalty={mockLoyalty}
        initialHistory={mockHistory}
        isLoading={false}
      />
    );

    // Không dùng emoji thô
    expect(screen.queryByText("⭐")).toBeNull();
    // Badge điểm có chứa container dữ liệu
    expect(screen.getByTestId("loyalty-points-badge")).toBeTruthy();
  });
});
