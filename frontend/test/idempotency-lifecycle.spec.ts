import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getOrCreateIdempotencyKey,
  clearIdempotencySnapshot,
  computePayloadFingerprint,
} from "@/features/checkout/idempotency";
import type { CheckoutPayload } from "@/features/checkout/checkout.types";

describe("idempotency lifecycle and fingerprinting", () => {
  const basePayload: CheckoutPayload = {
    address_id: "addr_01",
    payment_method: "COD",
    vouchers: [
      { shop_id: "shop_01", code: "VOUCHER10" },
      { shop_id: "shop_02", code: "DISCOUNT20" },
    ],
  };

  beforeEach(() => {
    clearIdempotencySnapshot();
  });

  it("Case 2.1: returns same key with isRetry=true when called with identical payload", () => {
    const res1 = getOrCreateIdempotencyKey(basePayload);
    expect(res1.key).toBeDefined();
    expect(res1.isRetry).toBe(false);

    const res2 = getOrCreateIdempotencyKey(basePayload);
    expect(res2.key).toBe(res1.key);
    expect(res2.isRetry).toBe(true);
  });

  it("Case 2.2: generates new key on address change, normalizes vouchers order, handles empty/undefined vouchers", () => {
    const res1 = getOrCreateIdempotencyKey(basePayload);

    // Changed address_id -> new key
    const changedPayload: CheckoutPayload = {
      ...basePayload,
      address_id: "addr_02",
    };
    const res2 = getOrCreateIdempotencyKey(changedPayload);
    expect(res2.key).not.toBe(res1.key);
    expect(res2.isRetry).toBe(false);

    // Reordered vouchers -> deterministic fingerprint -> reuse key
    const reorderedPayload: CheckoutPayload = {
      ...changedPayload,
      vouchers: [
        { shop_id: "shop_02", code: "DISCOUNT20" },
        { shop_id: "shop_01", code: "VOUCHER10" },
      ],
    };
    expect(computePayloadFingerprint(reorderedPayload)).toBe(
      computePayloadFingerprint(changedPayload)
    );
    const res3 = getOrCreateIdempotencyKey(reorderedPayload);
    expect(res3.key).toBe(res2.key);
    expect(res3.isRetry).toBe(true);

    // Empty vouchers vs undefined vouchers normalization
    const emptyVouchersPayload = { ...basePayload, vouchers: [] };
    const undefinedVouchersPayload = {
      ...basePayload,
      vouchers: undefined as unknown as [],
    };
    expect(computePayloadFingerprint(emptyVouchersPayload)).toBe(
      computePayloadFingerprint(undefinedVouchersPayload)
    );
  });

  it("Case 2.3: clearIdempotencySnapshot causes subsequent call to generate a fresh key with isRetry=false", () => {
    const res1 = getOrCreateIdempotencyKey(basePayload);
    clearIdempotencySnapshot();

    const res2 = getOrCreateIdempotencyKey(basePayload);
    expect(res2.key).not.toBe(res1.key);
    expect(res2.isRetry).toBe(false);
  });

  it("Case 2.4: falls back to in-memory storage safely when sessionStorage throws", () => {
    const mockStorage = {
      getItem: vi.fn(() => {
        throw new Error("QuotaExceededError");
      }),
      setItem: vi.fn(() => {
        throw new Error("QuotaExceededError");
      }),
      removeItem: vi.fn(() => {
        throw new Error("QuotaExceededError");
      }),
    };

    const originalWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = { sessionStorage: mockStorage };

    try {
      const res1 = getOrCreateIdempotencyKey(basePayload);
      expect(res1.key).toBeDefined();
      expect(res1.isRetry).toBe(false);

      const res2 = getOrCreateIdempotencyKey(basePayload);
      expect(res2.key).toBe(res1.key);
      expect(res2.isRetry).toBe(true);
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as Record<string, unknown>).window;
      } else {
        (globalThis as Record<string, unknown>).window = originalWindow;
      }
    }
  });
});
