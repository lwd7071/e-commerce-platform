import type { UserRole } from "./types";

/**
 * Route protection rules matching 01-project-overview.md §5 and F-106.
 */

export interface RouteRule {
  pathPrefix: string;
  allowedRoles?: UserRole[];
  requireAuth: boolean;
}

export const ROUTE_RULES: RouteRule[] = [
  // Public-only authentication routes
  { pathPrefix: "/login", requireAuth: false },
  { pathPrefix: "/register", requireAuth: false },

  // General authenticated routes
  { pathPrefix: "/profile", requireAuth: true },

  // Buyer protected routes
  { pathPrefix: "/cart", requireAuth: true, allowedRoles: ["BUYER"] },
  { pathPrefix: "/checkout", requireAuth: true, allowedRoles: ["BUYER"] },
  { pathPrefix: "/orders", requireAuth: true, allowedRoles: ["BUYER", "SELLER", "ADMIN"] },
  { pathPrefix: "/notifications", requireAuth: true },

  // Seller portal
  { pathPrefix: "/seller", requireAuth: true, allowedRoles: ["SELLER", "ADMIN"] },

  // Admin moderation & category management
  { pathPrefix: "/admin", requireAuth: true, allowedRoles: ["ADMIN"] },
];

/**
 * Sanitizes returnTo parameter to prevent open redirect vulnerabilities.
 * Only allows relative internal application paths (e.g. /cart, /checkout).
 */
export function sanitizeReturnTo(url: string | null | undefined): string {
  if (!url) return "/";
  // Must start with '/' and not '//' (which browsers treat as protocol-relative external URLs)
  if (url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }
  return "/";
}

/**
 * Matches a pathname against configured route rules.
 */
export function matchRouteRule(pathname: string): RouteRule | undefined {
  return ROUTE_RULES.find((rule) => pathname === rule.pathPrefix || pathname.startsWith(`${rule.pathPrefix}/`));
}
