import { describe, it, expect, beforeEach } from "vitest";
import { moneyAdapter } from "../src/lib/adapters/money.adapter";
import {
  computePayloadFingerprint,
  getOrCreateIdempotencyKey,
  clearIdempotencySnapshot,
} from "../src/features/checkout/idempotency";
import type { CheckoutPayload } from "../src/features/checkout/checkout.types";
import {
  checkoutRepository,
  MockCheckoutRepository,
} from "../src/features/checkout/checkout.repository";

describe("Cart and Money Calculations", () => {
  it("correctly calculates subtotal without floating point issues", () => {
    const items = [
      { price: "289000.00", quantity: 2 },
      { price: "340000.00", quantity: 1 },
      { price: "420000.00", quantity: 3 },
    ];

    const subtotal = items.reduce((acc, item) => {
      const p = moneyAdapter.toInteger(item.price);
      return acc + p * item.quantity;
    }, 0);

    expect(subtotal).toBe(289000 * 2 + 340000 * 1 + 420000 * 3); // 578000 + 340000 + 1260000 = 2178000
    expect(moneyAdapter.formatVND(subtotal)).toContain("2.178.000");
  });

  it("handles null and empty prices safely", () => {
    expect(moneyAdapter.toInteger(null)).toBe(0);
    expect(moneyAdapter.toInteger("")).toBe(0);
    expect(moneyAdapter.formatVND(0)).toContain("0");
  });
});

describe("Checkout Idempotency Lifecycle (B-407)", () => {
  beforeEach(() => {
    clearIdempotencySnapshot();
  });

  const basePayload: CheckoutPayload = {
    address_id: "addr_uuid_1",
    payment_method: "COD",
    vouchers: [{ shop_id: "shop_uuid_1", code: "SALE10" }],
  };

  it("produces deterministic fingerprint regardless of voucher order", () => {
    const p1: CheckoutPayload = {
      address_id: "addr_1",
      payment_method: "ONLINE",
      vouchers: [
        { shop_id: "shop_a", code: "CODE_A" },
        { shop_id: "shop_b", code: "CODE_B" },
      ],
    };

    const p2: CheckoutPayload = {
      address_id: "addr_1",
      payment_method: "ONLINE",
      vouchers: [
        { shop_id: "shop_b", code: "CODE_B" },
        { shop_id: "shop_a", code: "CODE_A" },
      ],
    };

    expect(computePayloadFingerprint(p1)).toBe(computePayloadFingerprint(p2));
  });

  it("reuses the same key on identical payload retry (network error / retry)", () => {
    const first = getOrCreateIdempotencyKey(basePayload);
    expect(first.key).toBeDefined();
    expect(first.isRetry).toBe(false);

    // Second call with same payload simulates retry
    const second = getOrCreateIdempotencyKey(basePayload);
    expect(second.key).toBe(first.key);
    expect(second.isRetry).toBe(true);
  });

  it("generates a new key when payload changes", () => {
    const first = getOrCreateIdempotencyKey(basePayload);

    // Change payment method
    const modifiedPayload: CheckoutPayload = {
      ...basePayload,
      payment_method: "ONLINE",
    };

    const second = getOrCreateIdempotencyKey(modifiedPayload);
    expect(second.key).not.toBe(first.key);
    expect(second.isRetry).toBe(false);
  });

  it("generates a new key after snapshot is cleared (order succeeded)", () => {
    const first = getOrCreateIdempotencyKey(basePayload);
    clearIdempotencySnapshot();

    const second = getOrCreateIdempotencyKey(basePayload);
    expect(second.key).not.toBe(first.key);
  });
});

describe("Voucher Evaluation and Invariants (B-406)", () => {
  const repo = new MockCheckoutRepository();

  it("applies fixed discount correctly", async () => {
    const res = await repo.evaluateVoucher("DINO50K", "300000.00");
    expect(res.isValid).toBe(true);
    if (res.isValid) {
      expect(res.discountAmount).toBe("50000.00");
    }
  });

  it("rejects voucher if min order value is not met", async () => {
    const res = await repo.evaluateVoucher("DINO50K", "100000.00");
    expect(res.isValid).toBe(false);
    if (!res.isValid) {
      expect(res.errorCode).toBe("MIN_ORDER_VALUE_NOT_MET");
    }
  });

  it("rejects non-existent voucher code", async () => {
    const res = await repo.evaluateVoucher("INVALID_CODE_XYZ", "500000.00");
    expect(res.isValid).toBe(false);
    if (!res.isValid) {
      expect(res.errorCode).toBe("VOUCHER_NOT_FOUND");
    }
  });
});

describe("Address Book Management (B-404, B-405)", () => {
  const repo = new MockCheckoutRepository();

  it("fetches list of addresses with default address", async () => {
    const addresses = await repo.getAddresses();
    expect(addresses.length).toBeGreaterThan(0);
    const hasDefault = addresses.some((a) => a.isDefault);
    expect(hasDefault).toBe(true);
  });

  it("creates a new address and prepends to list", async () => {
    const newAddr = await repo.createAddress({
      recipient_name: "Trần Thị B",
      phone: "0987654321",
      province: "Đà Nẵng",
      district: "Hải Châu",
      ward: "Hải Châu 1",
      detail_address: "99 Bạch Đằng",
      is_default: true,
    });

    expect(newAddr.addressId).toBeDefined();
    expect(newAddr.recipientName).toBe("Trần Thị B");
    expect(newAddr.isDefault).toBe(true);

    const list = await repo.getAddresses();
    expect(list[0].addressId).toBe(newAddr.addressId);
  });
});
