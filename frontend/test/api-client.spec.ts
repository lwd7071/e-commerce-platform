import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiClient, setAuthTokenProvider } from "@/lib/api/client";
import { AppError } from "@/lib/api/app-error";

describe("ApiClient & Envelope Parser (F-102)", () => {
  const originalFetch = global.fetch;
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient("http://test.api/v1");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setAuthTokenProvider(() => null);
  });

  it("unwraps standard SuccessEnvelope { data, request_id }", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        data: { id: "p1", name: "Test Product" },
        request_id: "req_test_123",
      }),
    });

    const result = await client.get<{ id: string; name: string }>("/products/p1");
    expect(result).toEqual({ id: "p1", name: "Test Product" });
  });

  it("handles HTTP 204 No Content safely without calling res.json()", async () => {
    const mockJson = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      json: mockJson,
    });

    const result = await client.delete("/items/1");
    expect(result).toBeUndefined();
    expect(mockJson).not.toHaveBeenCalled();
  });

  it("parses ErrorEnvelope into AppError with status, code, details and requestId", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      headers: new Headers({
        "content-type": "application/json",
        "x-request-id": "req_error_456",
      }),
      json: async () => ({
        error: {
          code: "VALIDATION_FAILED",
          message: "Email is already taken",
          details: [{ field: "email", message: "duplicate" }],
        },
        request_id: "req_error_456",
      }),
    });

    await expect(client.post("/register", {})).rejects.toThrow(AppError);

    try {
      await client.post("/register", {});
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.status).toBe(422);
      expect(appErr.code).toBe("VALIDATION_FAILED");
      expect(appErr.message).toBe("Email is already taken");
      expect(appErr.requestId).toBe("req_error_456");
      expect(appErr.details).toEqual([{ field: "email", message: "duplicate" }]);
    }
  });

  it("handles non-JSON error bodies gracefully without crashing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => "<html>502 Bad Gateway</html>",
    });

    try {
      await client.get("/broken");
      expect.fail("Should have thrown");
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.status).toBe(502);
      expect(appErr.code).toBe("UNKNOWN_ERROR");
    }
  });

  it("attaches Authorization Bearer header when tokenProvider returns a token", async () => {
    let capturedHeaders: Headers | undefined;
    global.fetch = vi.fn().mockImplementation((_url, init) => {
      capturedHeaders = init?.headers as Headers;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ data: { success: true } }),
      });
    });

    setAuthTokenProvider(() => "valid_access_jwt_123");

    await client.get("/protected/resource");
    expect(capturedHeaders?.get("Authorization")).toBe("Bearer valid_access_jwt_123");
    expect(capturedHeaders?.get("X-Request-Id")).toBeTruthy();
  });

  it("preserves PaginatedEnvelope with meta when getPaginated is called", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        data: [{ id: "p1" }, { id: "p2" }],
        meta: { limit: 20, has_more: true, next_cursor: "cur_opaque_123" },
        request_id: "req_page_1",
      }),
    });

    const envelope = await client.getPaginated<{ id: string }>("/products");
    expect(envelope.data).toHaveLength(2);
    expect(envelope.meta).toBeDefined();
    expect(envelope.meta.has_more).toBe(true);
    expect(envelope.meta.next_cursor).toBe("cur_opaque_123");
  });
});
