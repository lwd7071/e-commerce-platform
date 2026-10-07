import type { IconName } from "../ui/icon";

export type AppRole = "BUYER" | "SELLER" | "ADMIN" | null;
export type NavItem = { href: string; label: string; icon: IconName; roles: AppRole[] };

const items: NavItem[] = [
  { href: "/", label: "Khám phá", icon: "home", roles: [null, "BUYER"] },
  { href: "/", label: "Trang chủ", icon: "home", roles: ["SELLER", "ADMIN"] },
  { href: "/admin", label: "Quản trị", icon: "grid", roles: ["ADMIN"] },
  { href: "/seller", label: "Kênh người bán", icon: "grid", roles: ["SELLER"] },
  { href: "/seller/wallet", label: "Ví người bán", icon: "bag", roles: ["SELLER"] },
  { href: "/cart", label: "Giỏ hàng", icon: "bag", roles: ["BUYER"] },
  { href: "/orders", label: "Đơn hàng", icon: "bag", roles: ["BUYER"] },
  { href: "/notifications", label: "Thông báo", icon: "bell", roles: ["BUYER", "SELLER"] },
  { href: "/profile", label: "Tài khoản", icon: "user", roles: ["BUYER", "SELLER", "ADMIN"] },
];

export type SellerNavChild = {
  href: string;
  label: string;
  icon?: IconName;
};

export type SellerNavGroup = {
  title: string;
  icon: IconName;
  href?: string;
  children?: SellerNavChild[];
};

export function getNavigationItems(role: AppRole): NavItem[] {
  return items.filter((item) => item.roles.includes(role));
}

// Top navbar chỉ giữ các liên kết dùng chung / mua sắm chính
export function getTopNavItems(role: AppRole): NavItem[] {
  if (role === "ADMIN") {
    return [
      { href: "/", label: "Trang chủ", icon: "home", roles: ["ADMIN"] },
      { href: "/admin", label: "Quản trị", icon: "grid", roles: ["ADMIN"] },
    ];
  }

  if (role === "SELLER") {
    return [
      { href: "/", label: "Khám phá", icon: "home", roles: ["SELLER"] },
      { href: "/notifications", label: "Thông báo", icon: "bell", roles: ["SELLER"] },
    ];
  }

  if (role === "BUYER") {
    return [
      { href: "/", label: "Khám phá", icon: "home", roles: ["BUYER"] },
      { href: "/cart", label: "Giỏ hàng", icon: "bag", roles: ["BUYER"] },
      { href: "/notifications", label: "Thông báo", icon: "bell", roles: ["BUYER"] },
    ];
  }

  // Khách (chưa đăng nhập)
  return [
    { href: "/", label: "Khám phá", icon: "home", roles: [null] },
  ];
}

// Cấu trúc Sidebar chuẩn cho khu vực Người bán (Seller Center)
export function getSellerSidebarGroups(): SellerNavGroup[] {
  return [
    {
      title: "Tổng quan",
      icon: "home",
      href: "/seller",
    },
    {
      title: "Đơn hàng",
      icon: "bag",
      children: [
        { href: "/seller/orders", label: "Đơn bán" },
        { href: "/seller/chat", label: "Tin nhắn khách hàng" },
      ],
    },
    {
      title: "Sản phẩm",
      icon: "bag",
      href: "/seller/products",
    },
    {
      title: "Marketing",
      icon: "grid",
      children: [
        { href: "/seller/vouchers", label: "Mã giảm giá" },
      ],
    },
    {
      title: "Báo cáo",
      icon: "grid",
      children: [
        { href: "/seller/reports", label: "Doanh thu" },
      ],
    },
    {
      title: "Hồ sơ gian hàng",
      icon: "user",
      href: "/seller/shop",
    },
  ];
}

