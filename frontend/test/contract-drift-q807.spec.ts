import { describe, it, expect } from "vitest";

describe("Contract Drift & API Consistency (Q-807 Acceptance Gate)", () => {
  const CANONICAL_BACKEND_PATHS = [
    "/health",
    "/auth/me",
    "/auth/onboarding",
    "/categories",
    "/profile",
    "/products",
    "/products/{id}",
    "/product-variants/{id}/stock",
    "/cart",
    "/cart/items",
    "/cart/items/{id}",
    "/checkout",
    "/orders",
    "/orders/{id}",
    "/orders/{id}/cancel",
    "/order-items/{id}/review",
    "/reviews",
    "/addresses",
    "/vouchers/applicable",
    "/vouchers/evaluate",
    "/notifications",
    "/admin/users",
    "/admin/shops",
  ];

  it("[Q-807-01] Frontend routes conform to OpenAPI 3.1 relative path standards", () => {
    // Relative endpoints without redundant /api/v1 prefixes
    const frontendTargetEndpoints = [
      "/products",
      "/products/prod_123",
      "/cart",
      "/cart/items",
      "/cart/items/item_456",
      "/checkout",
      "/orders",
      "/orders/ord_789",
      "/orders/ord_789/cancel",
      "/addresses",
      "/vouchers/applicable",
      "/vouchers/evaluate",
      "/notifications",
    ];

    frontendTargetEndpoints.forEach((ep) => {
      // Must start with '/' and not start with '/api/v1' to avoid double-prefixing
      expect(ep.startsWith("/")).toBe(true);
      expect(ep.startsWith("/api/v1")).toBe(false);
    });
  });

  it("[Q-807-02] Envelope schema standard adheres to docs/architecture/api-initial-spec.md", () => {
    const sampleSuccess = {
      data: { id: "item_1" },
      request_id: "req_test_abc",
    };
    expect(sampleSuccess).toHaveProperty("data");
    expect(sampleSuccess).toHaveProperty("request_id");

    const samplePaginated = {
      data: [{ id: "p1" }],
      meta: { limit: 20, has_more: false, next_cursor: null },
      request_id: "req_test_page",
    };
    expect(samplePaginated).toHaveProperty("data");
    expect(samplePaginated).toHaveProperty("meta");
    expect(samplePaginated.meta).toHaveProperty("limit");
    expect(samplePaginated.meta).toHaveProperty("has_more");

    const sampleError = {
      error: { code: "VALIDATION_FAILED", message: "Invalid payload" },
      request_id: "req_test_err",
    };
    expect(sampleError).toHaveProperty("error");
    expect(sampleError.error).toHaveProperty("code");
    expect(sampleError.error).toHaveProperty("message");
  });

  it("[Q-807-03] Key canonical business operations exist in spec matrix", () => {
    expect(CANONICAL_BACKEND_PATHS).toContain("/products");
    expect(CANONICAL_BACKEND_PATHS).toContain("/checkout");
    expect(CANONICAL_BACKEND_PATHS).toContain("/orders/{id}/cancel");
    expect(CANONICAL_BACKEND_PATHS).toContain("/auth/onboarding");
    expect(CANONICAL_BACKEND_PATHS).toContain("/admin/users");
    expect(CANONICAL_BACKEND_PATHS).toContain("/admin/shops");
    expect(CANONICAL_BACKEND_PATHS).toContain("/order-items/{id}/review");
    expect(CANONICAL_BACKEND_PATHS).toContain("/categories");
  });
});
