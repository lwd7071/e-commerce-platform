/**
 * Central exports for Frontend Platform (C-005).
 * Exported seams for Người 2, 3, 4, 5 consumption.
 */

export * from "./api/client";
export * from "./api/app-error";
export * from "./api/types";
export * from "./api/catalog.api";
export * from "./api/buyer.api";
export * from "./api/order.api";
export * from "./api/voucher.api";

export * from "./auth/auth-context";
export * from "./auth/types";
export * from "./auth/route-guards";

export * from "./config/env";
export * from "./config/features";

export * from "./repositories/types";
export * from "./repositories/repository-factory";

export * from "./adapters/money.adapter";
