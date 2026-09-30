/**
 * Capability Readiness Registry (Dino MVP 30/09/2026 §10 & P0-04)
 *
 * Manages release readiness states:
 * - LIVE: Fully operational with live backend runtime.
 * - MOCK_DEV_ONLY: Development fixture mode. Renders "Dữ liệu demo" warning badge.
 * - BLOCKED: Incomplete or missing backend contract. Hidden from navigation/CTA.
 */

export type CapabilityState = "LIVE" | "MOCK_DEV_ONLY" | "BLOCKED";

export const MUST_CAPABILITIES = [
  "auth",
  "catalog",
  "cart",
  "checkout",
  "seller_catalog",
  "media",
  "orders",
  "reviews",
  "notifications",
  "admin_users",
  "admin_shops",
  "admin_categories",
] as const;

export type MustCapability = (typeof MUST_CAPABILITIES)[number];

export type CapabilityManifest = Record<MustCapability, CapabilityState>;

/**
 * Resolves current capability states based on runtime environment and feature flags.
 */
export function getCapabilityManifest(options?: {
  isProduction?: boolean;
  useMock?: boolean;
  overrides?: Partial<CapabilityManifest>;
}): CapabilityManifest {
  const isProduction = options?.isProduction ?? process.env.NODE_ENV === "production";
  const useMock = options?.useMock ?? (process.env.NEXT_PUBLIC_USE_MOCK === "true");

  const defaultState: CapabilityState = isProduction
    ? (useMock ? "MOCK_DEV_ONLY" : "LIVE")
    : (useMock ? "MOCK_DEV_ONLY" : "LIVE");

  const manifest: CapabilityManifest = {
    auth: "LIVE",
    catalog: "LIVE",
    cart: defaultState,
    checkout: defaultState,
    seller_catalog: defaultState,
    media: "LIVE",
    orders: defaultState,
    reviews: defaultState,
    notifications: defaultState,
    admin_users: defaultState,
    admin_shops: defaultState,
    admin_categories: defaultState,
    ...options?.overrides,
  };

  return manifest;
}

/**
 * Validates release readiness for deployment gates.
 * In production:
 * - Fails build if any MUST capability is BLOCKED or MOCK_DEV_ONLY.
 * - Fails build if NEXT_PUBLIC_USE_MOCK is explicitly enabled.
 */
export function validateReleaseReadiness(options?: {
  manifest?: CapabilityManifest;
  isProduction?: boolean;
  useMock?: boolean;
}): { valid: boolean; errors: string[] } {
  const isProduction =
    options?.isProduction ??
    (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_RELEASE_PHASE === "production");
  const useMock = options?.useMock ?? (process.env.NEXT_PUBLIC_USE_MOCK === "true");
  const manifest = options?.manifest ?? getCapabilityManifest({ isProduction, useMock });
  const errors: string[] = [];

  if (isProduction) {
    if (useMock) {
      errors.push("Production release cannot enable NEXT_PUBLIC_USE_MOCK=true.");
    }

    for (const cap of MUST_CAPABILITIES) {
      const state = manifest[cap];
      if (state !== "LIVE") {
        errors.push(`Capability MUST "${cap}" is not LIVE (current: ${state}).`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function isCapabilityLive(cap: MustCapability, manifest?: CapabilityManifest): boolean {
  const current = manifest ?? getCapabilityManifest();
  return current[cap] === "LIVE";
}

export function isCapabilityMock(cap: MustCapability, manifest?: CapabilityManifest): boolean {
  const current = manifest ?? getCapabilityManifest();
  return current[cap] === "MOCK_DEV_ONLY";
}

export function isCapabilityBlocked(cap: MustCapability, manifest?: CapabilityManifest): boolean {
  const current = manifest ?? getCapabilityManifest();
  return current[cap] === "BLOCKED";
}
