import { describe, it, expect } from "vitest";
import { sanitizeReturnTo, matchRouteRule } from "@/lib/auth/route-guards";

describe("RouteGuards & Open Redirect Protection (F-106)", () => {
  it("sanitizes relative returnTo paths safely", () => {
    expect(sanitizeReturnTo("/cart")).toBe("/cart");
    expect(sanitizeReturnTo("/checkout")).toBe("/checkout");
    expect(sanitizeReturnTo("/orders/123")).toBe("/orders/123");
  });

  it("blocks malicious external and protocol-relative redirect URLs", () => {
    expect(sanitizeReturnTo("https://evil.com")).toBe("/");
    expect(sanitizeReturnTo("//evil.com")).toBe("/");
    expect(sanitizeReturnTo("javascript:alert(1)")).toBe("/");
    expect(sanitizeReturnTo(null)).toBe("/");
    expect(sanitizeReturnTo("")).toBe("/");
  });

  it("identifies protected routes and allowed roles", () => {
    const cartRule = matchRouteRule("/cart");
    expect(cartRule?.requireAuth).toBe(true);
    expect(cartRule?.allowedRoles).toContain("BUYER");

    const sellerRule = matchRouteRule("/seller/products");
    expect(sellerRule?.requireAuth).toBe(true);
    expect(sellerRule?.allowedRoles).toContain("SELLER");

    const loginRule = matchRouteRule("/login");
    expect(loginRule?.requireAuth).toBe(false);
  });
});
