import { describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api/client";
import { orderApi } from "@/lib/api/order.api";

vi.mock("@/lib/api/client", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

describe("order API DTO adapter", () => {
  it("maps backend order and item DTOs to the UI model without inventing totals", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([{
      order_id: "order-12345678", buyer_id: "buyer1", shop_id: "shop1", shop_name: "Dino Shop", status: "PENDING_CONFIRMATION",
      subtotal: "24001.00", discount_amount: "0.00", shipping_fee: "0.00", total_amount: "24001.00", cancel_reason: null,
      created_at: "2026-09-29T10:00:00Z", updated_at: "2026-09-29T10:00:00Z",
      items: [{ order_item_id: "item1", product_id: "p1", variant_id: "v1", product_name: "Áo", variant_name: "M", unit_price: "12000.50", quantity: 2, line_total: "24001.00", image_url: null }],
    }]);
    const orders = await orderApi.getOrders();
    expect(orders[0]).toMatchObject({ id: "order-12345678", total_amount: "24001.00", items: [{ id: "item1", price: "12000.50", subtotal: "24001.00", image_url: null }] });
    expect(orders[0]).not.toHaveProperty("order_code");
    expect(orders[0]).not.toHaveProperty("final_amount");
    expect(apiClient.get).toHaveBeenCalledWith("/orders", { params: undefined });
  });
});
