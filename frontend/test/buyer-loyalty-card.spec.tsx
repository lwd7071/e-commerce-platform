// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BuyerLoyaltyCard } from "@/features/profile/loyalty-card";
import { buyerApi } from "@/lib/api/buyer.api";

vi.mock("@/lib/api/buyer.api", () => ({
  buyerApi: {
    getLoyalty: vi.fn(),
    getLoyaltyHistory: vi.fn(),
    getLoyaltyRewards: vi.fn(),
    redeemLoyalty: vi.fn(),
  },
}));

describe("BuyerLoyaltyCard Component", () => {
  it('reuses the redemption key if the successful POST is followed by a failed refresh', async () => {
    vi.mocked(buyerApi.getLoyalty).mockRejectedValueOnce(new Error('Refresh failed')).mockResolvedValue({ tier: 'STANDARD', total_spent: '1000000.00', loyalty_points: 0, vip_threshold: '5000000.00', points_multiplier: 1, next_tier: 'VIP' });
    vi.mocked(buyerApi.getLoyaltyHistory).mockResolvedValue({ items: [], page: 1, limit: 10, total: 0 });
    vi.mocked(buyerApi.redeemLoyalty).mockResolvedValue({ voucher_id: 'voucher', code: 'DINO-PRIVATE', end_at: '2026-11-11T10:00:00Z' });
    render(<BuyerLoyaltyCard initialLoyalty={{ tier: 'STANDARD', total_spent: '1000000.00', loyalty_points: 100, vip_threshold: '5000000.00', points_multiplier: 1, next_tier: 'VIP' }} initialHistory={{ items: [], page: 1, limit: 10, total: 0 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Đổi 100 điểm lấy voucher' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Refresh failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Đổi 100 điểm lấy voucher' }));
    await waitFor(() => expect(screen.getByText('0')).toBeTruthy());
    const calls = vi.mocked(buyerApi.redeemLoyalty).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe(calls[1][0]);
  });
  it('redeems a voucher and refreshes externally supplied balance and history', async () => {
    vi.mocked(buyerApi.getLoyalty).mockResolvedValue({ tier: 'STANDARD', total_spent: '1000000.00', loyalty_points: 0, vip_threshold: '5000000.00', points_multiplier: 1, next_tier: 'VIP' });
    vi.mocked(buyerApi.getLoyaltyHistory).mockResolvedValue({ items: [{ transaction_id: 'redeem', points_delta: -100, reference_order_id: null, reason: 'POINTS_REDEEMED', created_at: '2026-10-11T10:00:00Z' }], page: 1, limit: 10, total: 1 });
    const reward = { voucher_id: 'voucher', code: 'DINO-PRIVATE', end_at: '2026-11-11T10:00:00Z', quantity: 1 };
    vi.mocked(buyerApi.redeemLoyalty).mockResolvedValue(reward);
    vi.mocked(buyerApi.getLoyaltyRewards).mockResolvedValue([reward]);
    render(<BuyerLoyaltyCard initialLoyalty={{ tier: 'STANDARD', total_spent: '1000000.00', loyalty_points: 100, vip_threshold: '5000000.00', points_multiplier: 1, next_tier: 'VIP' }} initialHistory={{ items: [], page: 1, limit: 10, total: 0 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Đổi 100 điểm lấy voucher' }));
    await waitFor(() => expect(screen.getByText('Đổi voucher')).toBeTruthy());
    expect(screen.getByText('DINO-PRIVATE')).toBeTruthy();
    expect(screen.getByText('-100')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Đổi 100 điểm lấy voucher' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('disables redemption for a debt balance and displays a negative refund without a plus sign', async () => {
    render(<BuyerLoyaltyCard initialLoyalty={{ tier: 'VIP', total_spent: '0.00', loyalty_points: -100, vip_threshold: '5000000.00', points_multiplier: 2, next_tier: null }} initialHistory={{ items: [{ transaction_id: 'refund', points_delta: -100, reference_order_id: 'order', reason: 'ORDER_REFUND', created_at: '2026-10-11T10:00:00Z' }], page: 1, limit: 10, total: 1 }} />);
    expect(screen.getByText('Thu hồi sau hoàn tiền')).toBeTruthy();
    expect(screen.queryByText('+-100')).toBeNull();
    expect((screen.getByRole('button', { name: 'Đổi 100 điểm lấy voucher' }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(buyerApi.getLoyaltyRewards).toHaveBeenCalled());
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buyerApi.getLoyaltyRewards).mockResolvedValue([]);
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
