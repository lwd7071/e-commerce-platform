import { describe, it, expect } from "vitest";
import { repositories } from "../src/lib/repositories/repository-factory";

describe("Seller Orders Management and Sequential Fulfillment (O-504, O-505)", () => {
  it("fetches seller orders with optional shop_id and status filters (O-504)", async () => {
    const orderRepo = repositories.order();
    const allOrders = await orderRepo.getOrders();
    expect(allOrders.length).toBeGreaterThan(0);

    const beautyShopOrders = await orderRepo.getOrders({
      shop_id: "00000000-0000-0000-0000-000000000001",
    });
    expect(beautyShopOrders.length).toBeGreaterThan(0);
    expect(
      beautyShopOrders.every((o) => o.shop_id === "00000000-0000-0000-0000-000000000001")
    ).toBe(true);

    const shippingOrders = await orderRepo.getOrders({ status: "SHIPPING" });
    expect(shippingOrders.every((o) => o.status === "SHIPPING")).toBe(true);
  });

  it("confirms a pending order transitioning PENDING_CONFIRMATION -> CONFIRMED (O-505)", async () => {
    const orderRepo = repositories.order();
    const pendingOrders = await orderRepo.getOrders({ status: "PENDING_CONFIRMATION" });
    expect(pendingOrders.length).toBeGreaterThan(0);

    const target = pendingOrders[0];
    const confirmed = await orderRepo.confirmOrder(target.id, "Người bán xác nhận đơn");
    expect(confirmed.id).toBe(target.id);
    expect(confirmed.status).toBe("CONFIRMED");

    // Verify retrieval
    const fetched = await orderRepo.getOrderById(target.id);
    expect(fetched.status).toBe("CONFIRMED");
  });

  it("executes sequential fulfillment: CONFIRMED -> PREPARING -> SHIPPING (O-505)", async () => {
    const orderRepo = repositories.order();
    const confirmedOrders = await orderRepo.getOrders({ status: "CONFIRMED" });
    expect(confirmedOrders.length).toBeGreaterThan(0);

    const target = confirmedOrders[0];

    // Step 1: CONFIRMED -> PREPARING
    const preparing = await orderRepo.transitionOrder(target.id, "PREPARING");
    expect(preparing.status).toBe("PREPARING");

    // Step 2: PREPARING -> SHIPPING
    const shipping = await orderRepo.transitionOrder(target.id, "SHIPPING");
    expect(shipping.status).toBe("SHIPPING");

    // Verify persistence
    const reFetched = await orderRepo.getOrderById(target.id);
    expect(reFetched.status).toBe("SHIPPING");
  });

  it("allows seller to reject/cancel an order with mandatory reason", async () => {
    const orderRepo = repositories.order();
    const all = await orderRepo.getOrders();
    const activeOrder = all.find(
      (o) => o.status === "PENDING_CONFIRMATION" || o.status === "CONFIRMED"
    );
    expect(activeOrder).toBeDefined();

    if (activeOrder) {
      const reason = "Sản phẩm tạm thời hết hàng trong kho";
      const cancelled = await orderRepo.transitionOrder(activeOrder.id, "CANCELLED", reason);
      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.cancel_reason).toBe(reason);
    }
  });

  it("throws 409 conflict when trying to transition a terminal order", async () => {
    const orderRepo = repositories.order();
    const completedOrders = await orderRepo.getOrders({ status: "COMPLETED" });
    expect(completedOrders.length).toBeGreaterThan(0);

    const completed = completedOrders[0];
    await expect(
      orderRepo.transitionOrder(completed.id, "SHIPPING")
    ).rejects.toMatchObject({
      status: 409,
    });
  });
});
