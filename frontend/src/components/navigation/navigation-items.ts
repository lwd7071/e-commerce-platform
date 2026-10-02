import type { IconName } from "../ui/icon";

export type AppRole = "BUYER" | "SELLER" | "ADMIN" | null;
export type NavItem = { href: string; label: string; icon: IconName; roles: AppRole[] };

const items: NavItem[] = [
  { href: "/", label: "Khám phá", icon: "home", roles: [null, "BUYER", "SELLER"] },
  { href: "/", label: "Trang chủ", icon: "home", roles: ["ADMIN"] },
  { href: "/admin", label: "Quản trị", icon: "grid", roles: ["ADMIN"] },
  { href: "/cart", label: "Giỏ hàng", icon: "bag", roles: ["BUYER"] },
  { href: "/orders", label: "Đơn hàng", icon: "bag", roles: ["BUYER"] },
  { href: "/notifications", label: "Thông báo", icon: "bell", roles: ["BUYER", "SELLER"] },
  { href: "/profile", label: "Tài khoản", icon: "user", roles: ["BUYER", "SELLER", "ADMIN"] },
  { href: "/seller", label: "Kênh người bán", icon: "grid", roles: ["SELLER"] },
  { href: "/seller/shop", label: "Hồ sơ gian hàng", icon: "grid", roles: ["SELLER"] },
  { href: "/seller/orders", label: "Đơn bán", icon: "bag", roles: ["SELLER"] },
  { href: "/seller/products", label: "Sản phẩm", icon: "bag", roles: ["SELLER"] },
  { href: "/seller/vouchers", label: "Mã giảm giá", icon: "grid", roles: ["SELLER"] },
  { href: "/seller/reports", label: "Báo cáo doanh thu", icon: "grid", roles: ["SELLER"] },
];

export function getNavigationItems(role: AppRole): NavItem[] {
  return items.filter((item) => item.roles.includes(role));
}
