import { AppError } from "../../lib/api/app-error";
import type { UserRole } from "../../lib/auth/types";

import type { BuyerLoyaltyInfo, BuyerLoyaltyHistory } from "../../lib/api/buyer.api";

export type ProfileSnapshot = {
  userId: string;
  email: string;
  role: UserRole;
  fullName: string | null;
  phone: string | null;
  avatarUrl?: string | null;
  loyalty?: BuyerLoyaltyInfo | null;
  loyaltyHistory?: BuyerLoyaltyHistory | null;
};
export type ProfileRequestState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "missing" }
  | { status: "error"; message: string; code?: string; requestId?: string }
  | { status: "ready"; profile: ProfileSnapshot };

export function profileFailureState(error: unknown): Extract<ProfileRequestState, { status: "missing" | "signed_out" | "error" }> {
  if (error instanceof AppError && (error.status === 401 || error.code === "UNAUTHORIZED")) {
    return { status: "signed_out" };
  }
  if (error instanceof AppError && error.status === 404 && error.code === "RESOURCE_NOT_FOUND") {
    return { status: "missing" };
  }
  return {
    status: "error",
    message: error instanceof Error ? error.message : "Không thể tải hồ sơ. Vui lòng thử lại.",
    ...(error instanceof AppError ? { code: error.code } : {}),
    ...(error instanceof AppError && error.requestId ? { requestId: error.requestId } : {}),
  };
}
