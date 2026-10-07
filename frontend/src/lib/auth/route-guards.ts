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
  { pathPrefix: "/orders", requireAuth: true, allowedRoles: ["BUYER"] },
  { pathPrefix: "/notifications", requireAuth: true, allowedRoles: ["BUYER"] },

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
  // Must start with '/' and not '//' or '/\' (which browsers can treat as protocol-relative external URLs)
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) {
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

/**
 * Resolves the destination URL after a successful login:
 * 1. Checks open redirect safety (relative path, no //, no /\, no external protocols).
 * 2. If no returnTo, or returnTo is root/auth route, falls back to role default:
 *    - ADMIN -> /admin
 *    - SELLER -> /seller
 *    - BUYER / default -> /
 * 3. If returnTo is provided, matches against ROUTE_RULES:
 *    - If destination route has allowedRoles and the current user role is not permitted
 *      (e.g., BUYER trying /admin, SELLER trying /admin, BUYER trying /seller),
 *      neutralizes privilege bypass by falling back to the role's default portal.
 */
export function resolvePostLoginRedirect(returnTo: string | null | undefined, role?: UserRole): string {
  const defaultPath = role === "ADMIN" ? "/admin" : role === "SELLER" ? "/seller" : "/";
  const safePath = sanitizeReturnTo(returnTo);

  if (!returnTo || safePath === "/" || safePath === "/login" || safePath === "/register") {
    return defaultPath;
  }

  const matchedRule = matchRouteRule(safePath);
  if (matchedRule?.allowedRoles && role && !matchedRule.allowedRoles.includes(role)) {
    return defaultPath;
  }

  return safePath;
}
