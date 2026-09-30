import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiClient } from "@/lib/api/client";
import { AppError } from "@/lib/api/app-error";

describe("Resilience & Error Handling (Q-806 Acceptance Gate)", () => {
  const originalFetch = global.fetch;
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient("http://test.api/v1");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("[Q-806-01] 401 Unauthorized: parses AUTH_REQUIRED / AUTH_INVALID_TOKEN correctly", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "application/json", "x-request-id": "req_401" }),
      json: async () => ({
        error: { code: "AUTH_REQUIRED", message: "Authentication required" },
        request_id: "req_401",
      }),
    });

    try {
      await client.get("/profile");
      expect.fail("Should have thrown AppError");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.status).toBe(401);
      expect(appErr.code).toBe("AUTH_REQUIRED");
      expect(appErr.requestId).toBe("req_401");
    }
  });

  it("[Q-806-02] 403 Forbidden: parses USER_LOCKED and RESOURCE_FORBIDDEN correctly", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ "content-type": "application/json", "x-request-id": "req_403" }),
      json: async () => ({
        error: { code: "USER_LOCKED", message: "Your account has been locked by an administrator" },
        request_id: "req_403",
      }),
    });

    try {
      await client.get("/orders");
      expect.fail("Should have thrown AppError");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.status).toBe(403);
      expect(appErr.code).toBe("USER_LOCKED");
    }
  });

  it("[Q-806-03] 409 Conflict: parses INVENTORY_INSUFFICIENT and CART_CONFLICT correctly", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Headers({ "content-type": "application/json", "x-request-id": "req_409" }),
      json: async () => ({
        error: { code: "INVENTORY_INSUFFICIENT", message: "Requested quantity exceeds available stock" },
        request_id: "req_409",
      }),
    });

    try {
      await client.post("/checkout", {});
      expect.fail("Should have thrown AppError");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.status).toBe(409);
      expect(appErr.code).toBe("INVENTORY_INSUFFICIENT");
    }
  });

  it("[Q-806-04] 422 Unprocessable Entity: unwraps VALIDATION_FAILED and REASON_REQUIRED with field details", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      headers: new Headers({ "content-type": "application/json", "x-request-id": "req_422" }),
      json: async () => ({
        error: {
          code: "VALIDATION_FAILED",
          message: "Validation failed",
          details: [{ field: "phone", message: "Invalid phone number format" }],
        },
        request_id: "req_422",
      }),
    });

    try {
      await client.post("/addresses", {});
      expect.fail("Should have thrown AppError");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.status).toBe(422);
      expect(appErr.code).toBe("VALIDATION_FAILED");
      expect(appErr.details).toHaveLength(1);
    }
  });

  it("[Q-806-05] 429 Too Many Requests: parses RATE_LIMITED error with request id", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "content-type": "application/json", "x-request-id": "req_429" }),
      json: async () => ({
        error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
        request_id: "req_429",
      }),
    });

    try {
      await client.get("/products");
      expect.fail("Should have thrown AppError");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.status).toBe(429);
      expect(appErr.code).toBe("RATE_LIMITED");
    }
  });

  it("[Q-806-06] 503 Service Unavailable: parses DEPENDENCY_UNAVAILABLE correctly", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers({ "content-type": "application/json", "x-request-id": "req_503" }),
      json: async () => ({
        error: { code: "DEPENDENCY_UNAVAILABLE", message: "Database connection pool exhausted" },
        request_id: "req_503",
      }),
    });

    try {
      await client.get("/health");
      expect.fail("Should have thrown AppError");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.status).toBe(503);
      expect(appErr.code).toBe("DEPENDENCY_UNAVAILABLE");
    }
  });

  it("[Q-806-07] Timeout Resilience: transforms AbortError into timeout AppError with status 408", async () => {
    global.fetch = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal) {
          signal.addEventListener("abort", () => {
            const abortErr = new DOMException("The operation was aborted.", "AbortError");
            reject(abortErr);
          });
        }
      });
    });

    try {
      await client.get("/slow-operation", { timeoutMs: 20 });
      expect.fail("Should have timed out");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.status).toBe(408);
      expect(appErr.code).toBe("REQUEST_TIMEOUT");
    }
  });

  it("[Q-806-08] Network Failure Resilience: wraps TypeError into network AppError with status 0", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    try {
      await client.get("/offline");
      expect.fail("Should have thrown network error");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.status).toBe(0);
      expect(appErr.code).toBe("NETWORK_ERROR");
    }
  });
});
