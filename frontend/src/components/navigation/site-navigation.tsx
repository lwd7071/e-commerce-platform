"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../ui/icon";

export type AppRole = "BUYER" | "SELLER" | "ADMIN" | null;
type NavItem = { href: string; label: string; icon: IconName; roles: AppRole[] };
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

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ role = null }: { role?: AppRole }) {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand-lockup" href="/" aria-label="Dino - trang chủ">
          <span>Dino</span>
        </Link>
        <form className="header-search" action="/" role="search">
          <Icon name="search" className="header-search__icon" />
          <input className="form-control" type="search" name="q" placeholder="Tìm sản phẩm..." aria-label="Tìm sản phẩm" />
        </form>
        <nav className="primary-nav desktop-nav" aria-label="Điều hướng chính">
          {items.filter((item) => item.roles.includes(role)).map((item) => (
            <Link className="primary-nav__link" href={item.href} key={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
              <Icon name={item.icon} />{item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions"><Link className="button button--secondary" href={role ? "/profile" : "/login"}>{role ? "Tài khoản" : "Đăng nhập"}</Link></div>
      </div>
    </header>
  );
}

export function MobileDock({ role = null }: { role?: AppRole }) {
  const pathname = usePathname();
  const visible = items.filter((item) => item.roles.includes(role));
  return <nav className="mobile-dock" aria-label="Điều hướng nhanh">{visible.map((item) => (
    <Link className="mobile-dock__link" href={item.href} key={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
      <Icon name={item.icon} /><span>{item.label}</span>
    </Link>
  ))}</nav>;
}
