/**
 * Factory tập trung các Query Keys cho toàn bộ ứng dụng.
 * Tuân thủ cấu trúc phân cấp để dễ dàng invalidate theo nhóm:
 * Ví dụ: queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
 */
export const queryKeys = {
  profile: {
    all: ["profile"] as const,
    details: (userId: string) => [...queryKeys.profile.all, userId, "details"] as const,
    loyalty: (userId: string) => [...queryKeys.profile.all, userId, "loyalty"] as const,
    loyaltyHistory: (userId: string, params?: { page?: number; limit?: number }) => [...queryKeys.profile.all, userId, "loyaltyHistory", params ?? {}] as const,
    addresses: (userId: string) => [...queryKeys.profile.all, userId, "addresses"] as const,
  },
  catalog: {
    all: ["catalog"] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.catalog.all, "list", filters ?? {}] as const,
    detail: (id: string) => [...queryKeys.catalog.all, "detail", id] as const,
    reviews: (productId: string) => [...queryKeys.catalog.all, "reviews", productId] as const,
  },
  cart: {
    all: ["cart"] as const,
    items: (userId: string) => [...queryKeys.cart.all, userId, "items"] as const,
  },
  orders: {
    all: ["orders"] as const,
    list: (userId: string, status?: string) => [...queryKeys.orders.all, userId, "list", status ?? "ALL"] as const,
    detail: (userId: string, id: string) => [...queryKeys.orders.all, userId, "detail", id] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (userId: string) => [...queryKeys.notifications.all, userId, "list"] as const,
  },
  seller: {
    all: ["seller"] as const,
    dashboard: (userId: string) => [...queryKeys.seller.all, userId, "dashboard"] as const,
    products: (userId: string, filters?: Record<string, unknown>) => [...queryKeys.seller.all, userId, "products", filters ?? {}] as const,
    orders: (userId: string, status?: string) => [...queryKeys.seller.all, userId, "orders", status ?? "ALL"] as const,
    vouchers: (userId: string) => [...queryKeys.seller.all, userId, "vouchers"] as const,
    reports: (userId: string, filters?: Record<string, unknown>) => [...queryKeys.seller.all, userId, "reports", filters ?? {}] as const,
    shop: (userId: string) => [...queryKeys.seller.all, userId, "shop"] as const,
    wallet: (userId: string) => [...queryKeys.seller.all, userId, "wallet"] as const,
  },
  admin: {
    all: ["admin"] as const,
    shops: (userId: string, filters?: Record<string, unknown>) => [...queryKeys.admin.all, userId, "shops", filters ?? {}] as const,
    categories: (userId: string) => [...queryKeys.admin.all, userId, "categories"] as const,
    orders: (userId: string, filters?: Record<string, unknown>) => [...queryKeys.admin.all, userId, "orders", filters ?? {}] as const,
    vouchers: (userId: string) => [...queryKeys.admin.all, userId, "vouchers"] as const,
    reviews: (userId: string, filters?: Record<string, unknown>) => [...queryKeys.admin.all, userId, "reviews", filters ?? {}] as const,
    reports: (userId: string, filters?: Record<string, unknown>) => [...queryKeys.admin.all, userId, "reports", filters ?? {}] as const,
    audit: (userId: string, filters?: Record<string, unknown>) => [...queryKeys.admin.all, userId, "audit", filters ?? {}] as const,
  },
} as const;
