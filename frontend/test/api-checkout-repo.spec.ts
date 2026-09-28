import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiCheckoutRepository } from "@/features/checkout/checkout.repository";
import { apiClient } from "@/lib/api/client";
import { AppError } from "@/lib/api/app-error";
import type { CheckoutPayload, CreateAddressInput } from "@/features/checkout/checkout.types";

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("ApiCheckoutRepository without silent mock fallbacks", () => {
  let repo: ApiCheckoutRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ApiCheckoutRepository();
  });

  it("Case 3.1: getAddresses throws AppError on 500 and does NOT fallback to mock addr_01", async () => {
    const error500 = new AppError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Database connection failed",
      requestId: "req_123",
    });
    vi.mocked(apiClient.get).mockRejectedValue(error500);

    let thrownError: unknown;
    try {
      await repo.getAddresses();
    } catch (e) {
      thrownError = e;
    }
    expect(thrownError).toBeInstanceOf(AppError);
    expect(thrownError).toMatchObject({
      code: "INTERNAL_ERROR",
      requestId: "req_123",
    });
  });

  it("Case 3.2 (Regression Guard): getAddresses resolves [] faithfully when user has no addresses", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const result = await repo.getAddresses();
    expect(result).toEqual([]);
  });

  it("Case 3.3: createAddress throws AppError on 422 VALIDATION_FAILED with details and does NOT fallback", async () => {
    const error422 = new AppError({
      status: 422,
      code: "VALIDATION_FAILED",
      message: "Validation failed",
      details: [{ field: "phone", issue: "invalid" }],
    });
    vi.mocked(apiClient.post).mockRejectedValue(error422);

    const input: CreateAddressInput = {
      recipientName: "Test User",
      phone: "invalid_phone",
      province: "HN",
      district: "CG",
      ward: "MP",
      detailAddress: "123",
      isDefault: false,
    };

    let thrownError: unknown;
    try {
      await repo.createAddress(input);
    } catch (e) {
      thrownError = e;
    }
    expect(thrownError).toBeInstanceOf(AppError);
    expect(thrownError).toMatchObject({
      code: "VALIDATION_FAILED",
      details: [{ field: "phone", issue: "invalid" }],
    });
  });

  it("Case 3.4: getVouchers throws AppError on 500 and does NOT return mock vouchers", async () => {
    const error500 = new AppError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Voucher service unavailable",
    });
    vi.mocked(apiClient.get).mockRejectedValueOnce(error500);

    await expect(repo.getVouchers()).rejects.toThrow(AppError);
  });

  it("Case 3.5a: evaluateVoucher resolves { isValid: false, errorMessage } on HTTP 200 without throwing", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      isValid: false,
      errorCode: "VOUCHER_NOT_APPLICABLE",
      errorMessage: "Đơn chưa đủ 200k",
    });

    const result = await repo.evaluateVoucher("CODE200", "150000.00", "shop_01");
    expect(result).toEqual({
      isValid: false,
      errorCode: "VOUCHER_NOT_APPLICABLE",
      errorMessage: "Đơn chưa đủ 200k",
    });
  });

  it("Case 3.5b: evaluateVoucher rejects with AppError on HTTP 400 and does NOT fallback", async () => {
    const error400 = new AppError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Malformed coupon payload",
    });
    vi.mocked(apiClient.post).mockRejectedValueOnce(error400);

    await expect(repo.evaluateVoucher("BAD_CODE", "100000.00")).rejects.toThrow(AppError);
  });

  it("Case 3.6: submitCheckout passes Idempotency-Key header, excludes shipping_fee, rejects on 409", async () => {
    const payload: CheckoutPayload = {
      address_id: "addr_real_1",
      payment_method: "COD",
      vouchers: [{ shop_id: "shop_01", code: "DISCOUNT10" }],
    };
    const key = "test-uuid-key-12345678";

    const error409 = new AppError({
      status: 409,
      code: "INVENTORY_INSUFFICIENT",
      message: "Out of stock",
    });
    vi.mocked(apiClient.post).mockRejectedValueOnce(error409);

    await expect(repo.submitCheckout(payload, key)).rejects.toThrow(AppError);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/checkout",
      payload,
      expect.objectContaining({
        headers: {
          "Idempotency-Key": key,
        },
      })
    );
    // Verify body definitely does NOT contain shipping_fee
    expect(payload).not.toHaveProperty("shipping_fee");
  });
});
