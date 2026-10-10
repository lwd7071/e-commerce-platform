import { AppError } from "@/lib/api/app-error";

export type CheckoutErrorClassification =
  | "GROUP_A"
  | "GROUP_B"
  | "AUTH"
  | "USER_LOCKED"
  | "IN_PROGRESS";

/**
 * Pure function that classifies checkout errors according to the idempotency lifecycle
 * and error handling policy.
 * - GROUP_A: Domain / business validation failures -> clear snapshot, generate new key next submit.
 * - GROUP_B: Network, 5xx server errors, timeouts -> keep snapshot, retry with same key.
 * - AUTH: 401 unauthorized -> keep snapshot, redirect to login, safe to retry upon re-auth.
 * - USER_LOCKED: Account locked -> clear snapshot, signOut, redirect to locked page.
 * - IN_PROGRESS: 409 in progress -> keep snapshot & key, disable button 3s.
 */
export function classifyCheckoutError(err: unknown): CheckoutErrorClassification {
  if (err instanceof AppError) {
    if (err.code === "USER_LOCKED") return "USER_LOCKED";
    if (err.code === "REQUEST_IN_PROGRESS") return "IN_PROGRESS";
    if (
      err.code === "AUTH_REQUIRED" ||
      err.code === "AUTH_INVALID_TOKEN" ||
      err.status === 401
    ) {
      return "AUTH";
    }
    if (
      [
        "INVENTORY_INSUFFICIENT",
        "VALIDATION_FAILED",
        "IDEMPOTENCY_KEY_REUSED",
        "VOUCHER_NOT_APPLICABLE",
        "VOUCHER_NOT_FOUND",
      ].includes(err.code)
    ) {
      return "GROUP_A";
    }
  }
  return "GROUP_B"; // TypeError network failure, 500, 502, 503, 504 Timeout, unknown codes
}
