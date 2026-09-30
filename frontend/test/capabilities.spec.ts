import { describe, it, expect } from "vitest";
import {
  MUST_CAPABILITIES,
  getCapabilityManifest,
  validateReleaseReadiness,
  isCapabilityLive,
  isCapabilityMock,
  isCapabilityBlocked,
} from "@/lib/config/capabilities";

describe("Capability Readiness Registry & Release Build Guard (P0-04)", () => {
  it("defines all 12 MUST capabilities according to implementation plan §10", () => {
    expect(MUST_CAPABILITIES).toHaveLength(12);
    expect(MUST_CAPABILITIES).toContain("auth");
    expect(MUST_CAPABILITIES).toContain("catalog");
    expect(MUST_CAPABILITIES).toContain("cart");
    expect(MUST_CAPABILITIES).toContain("checkout");
    expect(MUST_CAPABILITIES).toContain("seller_catalog");
    expect(MUST_CAPABILITIES).toContain("media");
    expect(MUST_CAPABILITIES).toContain("orders");
    expect(MUST_CAPABILITIES).toContain("reviews");
    expect(MUST_CAPABILITIES).toContain("notifications");
    expect(MUST_CAPABILITIES).toContain("admin_users");
    expect(MUST_CAPABILITIES).toContain("admin_shops");
    expect(MUST_CAPABILITIES).toContain("admin_categories");
  });

  it("passes validation when all MUST capabilities are LIVE in production", () => {
    const liveManifest = getCapabilityManifest({
      isProduction: true,
      useMock: false,
    });
    const result = validateReleaseReadiness({
      manifest: liveManifest,
      isProduction: true,
      useMock: false,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(isCapabilityLive("auth", liveManifest)).toBe(true);
  });

  it("fails production release validation if any capability is MOCK_DEV_ONLY or BLOCKED", () => {
    const blockedManifest = getCapabilityManifest({
      isProduction: true,
      useMock: false,
      overrides: {
        admin_categories: "BLOCKED",
        reviews: "MOCK_DEV_ONLY",
      },
    });

    const result = validateReleaseReadiness({
      manifest: blockedManifest,
      isProduction: true,
      useMock: false,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Capability MUST "admin_categories" is not LIVE (current: BLOCKED).');
    expect(result.errors).toContain('Capability MUST "reviews" is not LIVE (current: MOCK_DEV_ONLY).');
    expect(isCapabilityBlocked("admin_categories", blockedManifest)).toBe(true);
    expect(isCapabilityMock("reviews", blockedManifest)).toBe(true);
  });

  it("strictly rejects NEXT_PUBLIC_USE_MOCK in production release", () => {
    const result = validateReleaseReadiness({
      isProduction: true,
      useMock: true,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Production release cannot enable NEXT_PUBLIC_USE_MOCK=true.");
  });

  it("allows MOCK_DEV_ONLY in non-production development environments", () => {
    const devResult = validateReleaseReadiness({
      isProduction: false,
      useMock: true,
    });

    expect(devResult.valid).toBe(true);
    expect(devResult.errors).toHaveLength(0);
  });
});
