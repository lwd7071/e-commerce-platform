import { describe, it, expect } from "vitest";
import { repositories } from "../src/lib/repositories/repository-factory";
import { ORDER_TABS, PREDEFINED_CANCEL_REASONS } from "../src/features/orders/orders.types";
import { checkoutRepository } from "../src/features/checkout/checkout.repository";

describe("Orders Center and Cancellation Lifecycle (O-502, O-503)", () => {
  it("provides all 7 valid order status tabs plus ALL tab", () => {
    expect(ORDER_TABS).toHaveLength(8);
    expect(ORDER_TABS.map((t) => t.key)).toEqual([
      "ALL",
      "PENDING_CONFIRMATION",
      "CONFIRMED",
      "PREPARING",
      "SHIPPING",
      "COMPLETED",
      "CANCELLED",
      "DELIVERY_FAILED",
    ]);
  });

  it("fetches orders and filters by status accurately", async () => {
    const orderRepo = repositories.order();
    const allOrders = await orderRepo.getOrders();
    expect(allOrders.length).toBeGreaterThan(0);

    const pendingOrders = await orderRepo.getOrders({ status: "PENDING_CONFIRMATION" });
    expect(pendingOrders.every((o) => o.status === "PENDING_CONFIRMATION")).toBe(true);

    const confirmedOrders = await orderRepo.getOrders({ status: "CONFIRMED" });
    expect(confirmedOrders.every((o) => o.status === "CONFIRMED")).toBe(true);
  });

  it("cancels an order in PENDING_CONFIRMATION with reason and updates status to CANCELLED", async () => {
    const orderRepo = repositories.order();
    const pendingOrders = await orderRepo.getOrders({ status: "PENDING_CONFIRMATION" });
    expect(pendingOrders.length).toBeGreaterThan(0);

    const targetOrder = pendingOrders[0];
    const reason = PREDEFINED_CANCEL_REASONS[0];

    const result = await orderRepo.cancelOrder(targetOrder.id, reason);
    expect(result.id).toBe(targetOrder.id);
    expect(result.status).toBe("CANCELLED");
    expect(result.cancel_reason).toBe(reason);

    // Verify when fetched directly
    const reFetched = await orderRepo.getOrderById(targetOrder.id);
    expect(reFetched.status).toBe("CANCELLED");
  });

  it("rejects cancellation with 409 error if order is not in PENDING_CONFIRMATION", async () => {
    const orderRepo = repositories.order();
    const confirmedOrders = await orderRepo.getOrders({ status: "CONFIRMED" });
    expect(confirmedOrders.length).toBeGreaterThan(0);

    const nonPendingOrder = confirmedOrders[0];
    await expect(
      orderRepo.cancelOrder(nonPendingOrder.id, "Muốn hủy đơn")
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it("registers newly created orders from checkout and allows lifecycle actions (O-502, O-503)", async () => {
    const orderRepo = repositories.order();
    const createdResult = await checkoutRepository.submitCheckout(
      {
        address_id: "addr_01",
        payment_method: "COD",
        vouchers: [],
      },
      "test-idempotency-key-01"
    );

    expect(createdResult.orders).toHaveLength(1);
    const newOrderId = createdResult.orders[0].order_id;

    // Immediately readable via mock store
    const fetched = await orderRepo.getOrderById(newOrderId);
    expect(fetched).toBeDefined();
    expect(fetched.id).toBe(newOrderId);
    expect(fetched.status).toBe("PENDING_CONFIRMATION");

    // Actionable: can be cancelled by buyer
    const cancelled = await orderRepo.cancelOrder(newOrderId, "Đổi ý mua món khác");
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancel_reason).toBe("Đổi ý mua món khác");
  });
});
