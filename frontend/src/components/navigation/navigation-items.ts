import type { IconName } from "../ui/icon";

export type AppRole = "BUYER" | "SELLER" | "ADMIN" | null;
export type NavItem = { href: string; label: string; icon: IconName; roles: AppRole[] };

const items: NavItem[] = [
  { href: "/", label: "Khám phá", icon: "home", roles: [null, "BUYER", "SELLER", "ADMIN"] },
  { href: "/cart", label: "Giỏ hàng", icon: "bag", roles: ["BUYER"] },
  { href: "/orders", label: "Đơn hàng", icon: "bag", roles: ["BUYER"] },
  { href: "/notifications", label: "Thông báo", icon: "bell", roles: ["BUYER"] },
  { href: "/profile", label: "Tài khoản", icon: "user", roles: ["BUYER", "SELLER", "ADMIN"] },
  { href: "/seller", label: "Kênh người bán", icon: "grid", roles: ["SELLER"] },
  { href: "/admin", label: "Quản trị", icon: "grid", roles: ["ADMIN"] },
  { href: "/admin/categories", label: "Danh mục", icon: "grid", roles: ["ADMIN"] },
];

export function getNavigationItems(role: AppRole): NavItem[] {
  return items.filter((item) => item.roles.includes(role));
}
