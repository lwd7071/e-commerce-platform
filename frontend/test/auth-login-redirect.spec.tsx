import { describe, expect, it } from "vitest";
import { resolvePostLoginRedirect } from "@/lib/auth/route-guards";

describe("resolvePostLoginRedirect - Role-based landing & Anti-privilege bypass", () => {
  describe("Default role redirects when returnTo is missing or root", () => {
    it("redirects BUYER to root '/'", () => {
      expect(resolvePostLoginRedirect(null, "BUYER")).toBe("/");
      expect(resolvePostLoginRedirect(undefined, "BUYER")).toBe("/");
      expect(resolvePostLoginRedirect("", "BUYER")).toBe("/");
      expect(resolvePostLoginRedirect("/", "BUYER")).toBe("/");
    });

    it("redirects SELLER to '/seller'", () => {
      expect(resolvePostLoginRedirect(null, "SELLER")).toBe("/seller");
      expect(resolvePostLoginRedirect(undefined, "SELLER")).toBe("/seller");
      expect(resolvePostLoginRedirect("", "SELLER")).toBe("/seller");
      expect(resolvePostLoginRedirect("/", "SELLER")).toBe("/seller");
    });

    it("redirects ADMIN to '/admin'", () => {
      expect(resolvePostLoginRedirect(null, "ADMIN")).toBe("/admin");
      expect(resolvePostLoginRedirect(undefined, "ADMIN")).toBe("/admin");
      expect(resolvePostLoginRedirect("", "ADMIN")).toBe("/admin");
      expect(resolvePostLoginRedirect("/", "ADMIN")).toBe("/admin");
    });
  });

  describe("Valid authenticated deep links matching permissions", () => {
    it("allows BUYER to navigate to buyer-allowed routes", () => {
      expect(resolvePostLoginRedirect("/cart", "BUYER")).toBe("/cart");
      expect(resolvePostLoginRedirect("/checkout", "BUYER")).toBe("/checkout");
      expect(resolvePostLoginRedirect("/orders", "BUYER")).toBe("/orders");
      expect(resolvePostLoginRedirect("/profile", "BUYER")).toBe("/profile");
    });

    it("allows SELLER to navigate to seller portal sub-routes", () => {
      expect(resolvePostLoginRedirect("/seller/orders", "SELLER")).toBe("/seller/orders");
      expect(resolvePostLoginRedirect("/seller/products", "SELLER")).toBe("/seller/products");
      expect(resolvePostLoginRedirect("/seller/wallet", "SELLER")).toBe("/seller/wallet");
      expect(resolvePostLoginRedirect("/profile", "SELLER")).toBe("/profile");
    });

    it("allows ADMIN to navigate to admin routes", () => {
      expect(resolvePostLoginRedirect("/admin/categories", "ADMIN")).toBe("/admin/categories");
      expect(resolvePostLoginRedirect("/admin/moderation", "ADMIN")).toBe("/admin/moderation");
      expect(resolvePostLoginRedirect("/seller", "ADMIN")).toBe("/seller"); // Admin is allowed in seller portal
    });
  });

  describe("Vertical & Lateral Privilege Escalation Prevention", () => {
    it("neutralizes BUYER trying to access /admin by redirecting to '/'", () => {
      expect(resolvePostLoginRedirect("/admin", "BUYER")).toBe("/");
      expect(resolvePostLoginRedirect("/admin/dashboard", "BUYER")).toBe("/");
    });

    it("neutralizes SELLER trying to access /admin by redirecting to '/seller'", () => {
      expect(resolvePostLoginRedirect("/admin", "SELLER")).toBe("/seller");
      expect(resolvePostLoginRedirect("/admin/settings", "SELLER")).toBe("/seller");
    });

    it("neutralizes BUYER trying to access /seller by redirecting to '/'", () => {
      expect(resolvePostLoginRedirect("/seller", "BUYER")).toBe("/");
      expect(resolvePostLoginRedirect("/seller/orders", "BUYER")).toBe("/");
      expect(resolvePostLoginRedirect("/seller/wallet", "BUYER")).toBe("/");
    });
  });

  describe("Open Redirect & Malicious Protocol Protection", () => {
    it("neutralizes external URLs and protocol-relative URLs", () => {
      expect(resolvePostLoginRedirect("https://attacker.com", "SELLER")).toBe("/seller");
      expect(resolvePostLoginRedirect("//attacker.com", "BUYER")).toBe("/");
      expect(resolvePostLoginRedirect("/\\attacker.com", "ADMIN")).toBe("/admin");
      expect(resolvePostLoginRedirect("javascript:alert(1)", "BUYER")).toBe("/");
    });

    it("prevents redirect loops on auth routes", () => {
      expect(resolvePostLoginRedirect("/login", "SELLER")).toBe("/seller");
      expect(resolvePostLoginRedirect("/register", "ADMIN")).toBe("/admin");
    });
  });
});
