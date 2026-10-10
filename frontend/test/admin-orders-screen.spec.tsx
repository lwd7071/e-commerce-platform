// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminOrdersScreen } from "../src/features/admin/admin-orders-screen";

describe("Admin order management", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ data: [{ order_id: "order-1", buyer_id: "buyer-1", buyer_email: "buyer@example.test", shop_id: "shop-1", shop_name: "Dino Store", status: "SHIPPING", subtotal: "100000.00", discount_amount: "0.00", shipping_fee: "0.00", total_amount: "100000.00", cancel_reason: null, created_at: "2026-10-02T00:00:00Z", updated_at: "2026-10-02T00:00:00Z", items: [], status_history: [], payments: [], shipment: null }], meta: { next_cursor: null, has_more: false, limit: 20 }, request_id: "req-test" }), { status: 200, headers: { "content-type": "application/json" } }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("shows global order data and searches through the Admin API", async () => {
    render(<AdminOrdersScreen />);
    expect(await screen.findByText("Dino Store")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Tìm mã đơn/), { target: { value: "order-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Lọc đơn hàng" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("search=order-1"), expect.anything()));
  });
});
