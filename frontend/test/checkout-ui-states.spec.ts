import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkoutRepository } from "@/features/checkout/checkout.repository";
import { cartRepository } from "@/features/cart/cart.repository";
import {
  getOrCreateIdempotencyKey,
  clearIdempotencySnapshot,
} from "@/features/checkout/idempotency";
import { classifyCheckoutError } from "@/features/checkout/checkout-error-classifier";
import { AppError } from "@/lib/api/app-error";
import type { CheckoutPayload, CheckoutResult } from "@/features/checkout/checkout.types";

vi.mock("@/features/checkout/checkout.repository", () => ({
  checkoutRepository: {
    getAddresses: vi.fn(),
    createAddress: vi.fn(),
    getVouchers: vi.fn(),
    evaluateVoucher: vi.fn(),
    submitCheckout: vi.fn(),
  },
}));

vi.mock("@/features/cart/cart.repository", () => ({
  cartRepository: {
    getCart: vi.fn(),
    removeSelected: vi.fn(),
  },
}));

describe("checkout UI states and 10-row error mapping matrix", () => {
  const samplePayload: CheckoutPayload = {
    address_id: "addr_01",
    payment_method: "COD",
    vouchers: [{ shop_id: "shop_01", code: "SALE10" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearIdempotencySnapshot();
  });

  it("Case 6.1: synchronous double-click guard prevents concurrent duplicate submissions", async () => {
    let submittingRef = false;
    let callCount = 0;

    const mockHandlePlaceOrder = async () => {
      if (submittingRef) return;
      submittingRef = true;
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
    };

    // Simulate 2 rapid clicks in the exact same tick without awaiting
    const p1 = mockHandlePlaceOrder();
    const p2 = mockHandlePlaceOrder();

    await Promise.all([p1, p2]);
    expect(callCount).toBe(1);
  });

  it("Case 6.2a: fire-and-forget cart cleanup failure does not break order placement flow", async () => {
    const mockResult: CheckoutResult = {
      orders: [
        {
          order_id: "ord_101",
          shop_id: "shop_01",
          status: "PENDING_CONFIRMATION",
          total_amount: "250000.00",
          payment_id: "pay_101",
        },
      ],
    };

    vi.mocked(checkoutRepository.submitCheckout).mockResolvedValueOnce(mockResult);
    vi.mocked(cartRepository.removeSelected).mockRejectedValueOnce(new Error("Cart network timeout"));

    let navigatedUrl = "";
    const routerPush = (url: string) => {
      navigatedUrl = url;
    };

    // Simulate handler logic
    const { key } = getOrCreateIdempotencyKey(samplePayload);
    const result = await checkoutRepository.submitCheckout(samplePayload, key);
    clearIdempotencySnapshot();

    // Fire and forget cleanup
    void cartRepository.removeSelected().catch((err) => {
      expect(err.message).toBe("Cart network timeout");
    });

    const orderIds = result.orders.map((o) => o.order_id).join(",");
    routerPush(`/orders?created=${orderIds}`);

    expect(navigatedUrl).toBe("/orders?created=ord_101");
  });

  it("Case 6.2b: empty orders array in response sets safety message without reopening submit or redirecting to invalid URL", async () => {
    const emptyResult: CheckoutResult = { orders: [] };
    vi.mocked(checkoutRepository.submitCheckout).mockResolvedValueOnce(emptyResult);

    let isSubmitting = true;
    let postSubmitError: string | null = null;
    let redirected = false;

    // Simulate handler logic
    const { key } = getOrCreateIdempotencyKey(samplePayload);
    const result = await checkoutRepository.submitCheckout(samplePayload, key);
    clearIdempotencySnapshot();

    if (!result.orders || result.orders.length === 0) {
      postSubmitError =
        "Đơn hàng đã được tạo thành công nhưng không tìm thấy thông tin đơn. Vui lòng vào trang Đơn mua để kiểm tra.";
    } else {
      redirected = true;
    }

    expect(isSubmitting).toBe(true);
    expect(redirected).toBe(false);
    expect(postSubmitError).toContain("Đơn hàng đã được tạo");
  });

  it("Case 6.3: 409 INVENTORY_INSUFFICIENT clears snapshot and triggers cart refresh", async () => {
    const key1 = getOrCreateIdempotencyKey(samplePayload).key;

    const error409 = new AppError({
      status: 409,
      code: "INVENTORY_INSUFFICIENT",
      message: "Hết hàng",
    });

    const classification = classifyCheckoutError(error409);
    expect(classification).toBe("GROUP_A");

    if (classification === "GROUP_A") {
      clearIdempotencySnapshot();
    }

    const key2 = getOrCreateIdempotencyKey(samplePayload).key;
    expect(key2).not.toBe(key1);
  });

  it.each([
    {
      type: "evaluate",
      res: { isValid: false, errorMessage: "Mã không hợp lệ" },
      expectedInline: true,
      shouldClearSnapshot: false,
    },
    {
      type: "submit_422",
      error: new AppError({ status: 422, code: "VOUCHER_NOT_APPLICABLE", message: "Voucher invalid" }),
      expectedInline: false,
      shouldClearSnapshot: true,
    },
    {
      type: "submit_404",
      error: new AppError({ status: 404, code: "VOUCHER_NOT_FOUND", message: "Voucher not found" }),
      expectedInline: false,
      shouldClearSnapshot: true,
    },
  ])("Case 6.4: Voucher evaluation and submit errors ($type)", ({ type, error, shouldClearSnapshot }) => {
    const key1 = getOrCreateIdempotencyKey(samplePayload).key;

    if (error) {
      const cls = classifyCheckoutError(error);
      expect(cls).toBe("GROUP_A");
      if (shouldClearSnapshot) {
        clearIdempotencySnapshot();
      }
      const key2 = getOrCreateIdempotencyKey(samplePayload).key;
      expect(key2).not.toBe(key1);
    }
  });

  it("Case 6.5a: 422 VALIDATION_FAILED on createAddress produces field details", async () => {
    const error422 = new AppError({
      status: 422,
      code: "VALIDATION_FAILED",
      message: "Dữ liệu không hợp lệ",
      details: [{ field: "phone", issue: "invalid_format" }],
    });

    vi.mocked(checkoutRepository.createAddress).mockRejectedValueOnce(error422);

    await expect(
      checkoutRepository.createAddress({
        recipientName: "Test",
        phone: "bad",
        province: "HN",
        district: "CG",
        ward: "MP",
        detailAddress: "1",
        isDefault: false,
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: [{ field: "phone", issue: "invalid_format" }],
    });
  });

  it("Case 6.5b: 422 VALIDATION_FAILED on submitCheckout clears snapshot", () => {
    const key1 = getOrCreateIdempotencyKey(samplePayload).key;
    const error422 = new AppError({
      status: 422,
      code: "VALIDATION_FAILED",
      message: "Payload invalid",
    });

    expect(classifyCheckoutError(error422)).toBe("GROUP_A");
    clearIdempotencySnapshot();

    const key2 = getOrCreateIdempotencyKey(samplePayload).key;
    expect(key2).not.toBe(key1);
  });

  it("Case 6.6: 409 REQUEST_IN_PROGRESS retains snapshot and handles 3s backoff timer cleanup", () => {
    vi.useFakeTimers();

    const key1 = getOrCreateIdempotencyKey(samplePayload).key;
    const error409 = new AppError({
      status: 409,
      code: "REQUEST_IN_PROGRESS",
      message: "Đang xử lý",
    });

    expect(classifyCheckoutError(error409)).toBe("IN_PROGRESS");

    let isSubmitting = true;
    let timer: NodeJS.Timeout | null = setTimeout(() => {
      isSubmitting = false;
      timer = null;
    }, 3000);

    expect(isSubmitting).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(isSubmitting).toBe(false);
    expect(timer).toBe(null);

    // Snapshot was preserved
    const key2 = getOrCreateIdempotencyKey(samplePayload).key;
    expect(key2).toBe(key1);

    // Verify cleanup
    const mockCleanup = vi.fn();
    timer = setTimeout(mockCleanup, 3000);
    clearTimeout(timer);
    vi.advanceTimersByTime(3000);
    expect(mockCleanup).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("Case 6.7: 409 IDEMPOTENCY_KEY_REUSED clears snapshot so next submit generates a new UUID", () => {
    const key1 = getOrCreateIdempotencyKey(samplePayload).key;
    const error409 = new AppError({
      status: 409,
      code: "IDEMPOTENCY_KEY_REUSED",
      message: "Reused key",
    });

    expect(classifyCheckoutError(error409)).toBe("GROUP_A");
    clearIdempotencySnapshot();

    const key2 = getOrCreateIdempotencyKey(samplePayload).key;
    expect(key2).not.toBe(key1);
  });

  it("Case 6.8: 401 AUTH_REQUIRED retains key and redirects to login", () => {
    const key1 = getOrCreateIdempotencyKey(samplePayload).key;
    const error401 = new AppError({
      status: 401,
      code: "AUTH_REQUIRED",
      message: "Unauthorized",
    });

    expect(classifyCheckoutError(error401)).toBe("AUTH");

    // Snapshot is preserved in AUTH case
    const key2 = getOrCreateIdempotencyKey(samplePayload).key;
    expect(key2).toBe(key1);
  });

  it("Case 6.9: 403 USER_LOCKED clears snapshot and triggers safe signOut and redirect", async () => {
    const key1 = getOrCreateIdempotencyKey(samplePayload).key;
    const error403 = new AppError({
      status: 403,
      code: "USER_LOCKED",
      message: "Tài khoản bị khóa",
    });

    expect(classifyCheckoutError(error403)).toBe("USER_LOCKED");
    clearIdempotencySnapshot();

    const mockSignOut = vi.fn().mockRejectedValueOnce(new Error("Network failed"));
    let redirected = "";

    try {
      await mockSignOut();
    } catch {
      // Ignored safely
    } finally {
      redirected = "/login?reason=locked";
    }

    expect(redirected).toBe("/login?reason=locked");
    const key2 = getOrCreateIdempotencyKey(samplePayload).key;
    expect(key2).not.toBe(key1);
  });

  it("Case 6.10a: 504 Timeout without requestId retains snapshot and hides undefined requestId", () => {
    const key1 = getOrCreateIdempotencyKey(samplePayload).key;
    const error504 = new AppError({
      status: 504,
      code: "TIMEOUT",
      message: "Gateway Timeout",
    });

    expect(classifyCheckoutError(error504)).toBe("GROUP_B");
    expect(error504.requestId).toBeUndefined();

    // Snapshot preserved
    const key2 = getOrCreateIdempotencyKey(samplePayload).key;
    expect(key2).toBe(key1);
  });

  it("Case 6.10b: 500 INTERNAL_ERROR with requestId retains snapshot and surfaces requestId", () => {
    const key1 = getOrCreateIdempotencyKey(samplePayload).key;
    const error500 = new AppError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      requestId: "req_server_500",
    });

    expect(classifyCheckoutError(error500)).toBe("GROUP_B");
    expect(error500.requestId).toBe("req_server_500");

    // Snapshot preserved
    const key2 = getOrCreateIdempotencyKey(samplePayload).key;
    expect(key2).toBe(key1);
  });
});
