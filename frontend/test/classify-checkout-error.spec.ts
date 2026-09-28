import { describe, it, expect } from "vitest";
import { classifyCheckoutError } from "@/features/checkout/checkout-error-classifier";
import { AppError } from "@/lib/api/app-error";

describe("classifyCheckoutError", () => {
  it("USER_LOCKED: only based on err.code, not on status 403", () => {
    expect(
      classifyCheckoutError(
        new AppError({ code: "USER_LOCKED", status: 403, message: "Account locked" })
      )
    ).toBe("USER_LOCKED");
  });

  it("403 not USER_LOCKED -> GROUP_B (e.g. wrong role or CSRF)", () => {
    expect(
      classifyCheckoutError(
        new AppError({ code: "FORBIDDEN", status: 403, message: "Forbidden" })
      )
    ).toBe("GROUP_B");
  });

  it("IN_PROGRESS for REQUEST_IN_PROGRESS", () => {
    expect(
      classifyCheckoutError(
        new AppError({ code: "REQUEST_IN_PROGRESS", status: 409, message: "In progress" })
      )
    ).toBe("IN_PROGRESS");
  });

  it("AUTH_REQUIRED -> AUTH", () => {
    expect(
      classifyCheckoutError(
        new AppError({ code: "AUTH_REQUIRED", status: 401, message: "Auth required" })
      )
    ).toBe("AUTH");
  });

  it("AUTH_INVALID_TOKEN -> AUTH", () => {
    expect(
      classifyCheckoutError(
        new AppError({ code: "AUTH_INVALID_TOKEN", status: 401, message: "Invalid token" })
      )
    ).toBe("AUTH");
  });

  it("401 with unknown code -> AUTH (safe status fallback)", () => {
    expect(
      classifyCheckoutError(
        new AppError({ code: "UNKNOWN_AUTH_CODE", status: 401, message: "Unauthorized" })
      )
    ).toBe("AUTH");
  });

  it.each([
    "INVENTORY_INSUFFICIENT",
    "VALIDATION_FAILED",
    "IDEMPOTENCY_KEY_REUSED",
    "VOUCHER_NOT_APPLICABLE",
    "VOUCHER_NOT_FOUND",
  ])("GROUP_A: %s", (code) => {
    expect(
      classifyCheckoutError(
        new AppError({ code, status: 409, message: "Business rejection" })
      )
    ).toBe("GROUP_A");
  });

  it("TypeError network failure -> GROUP_B", () => {
    expect(classifyCheckoutError(new TypeError("Failed to fetch"))).toBe("GROUP_B");
  });

  it("AppError with future unknown code -> GROUP_B (safe fallback)", () => {
    expect(
      classifyCheckoutError(
        new AppError({ code: "NEW_UNKNOWN_CODE", status: 500, message: "Server error" })
      )
    ).toBe("GROUP_B");
  });

  it("500 INTERNAL_ERROR -> GROUP_B (retain snapshot for retry)", () => {
    expect(
      classifyCheckoutError(
        new AppError({ code: "INTERNAL_ERROR", status: 500, message: "Internal error" })
      )
    ).toBe("GROUP_B");
  });
});
