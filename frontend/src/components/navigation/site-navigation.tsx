"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Icon } from "../ui/icon";
import { getNavigationItems, type AppRole } from "./navigation-items";

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ role = null }: { role?: AppRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

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
          {getNavigationItems(role).map((item) => (
            <Link className="primary-nav__link" href={item.href} key={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
              <Icon name={item.icon} />{item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          {role ? (
            <button
              type="button"
              className="button button--ghost text-sm min-h-[38px] px-3 py-1.5"
              onClick={handleLogout}
              aria-label="Đăng xuất khỏi hệ thống"
            >
              <Icon name="logout" />
              <span>Đăng xuất</span>
            </button>
          ) : (
            <Link className="button button--secondary" href="/login">
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileDock({ role = null }: { role?: AppRole }) {
  const pathname = usePathname();
  const visible = getNavigationItems(role);
  return <nav className="mobile-dock" aria-label="Điều hướng nhanh">{visible.map((item) => (
    <Link className="mobile-dock__link" href={item.href} key={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
      <Icon name={item.icon} /><span>{item.label}</span>
    </Link>
  ))}</nav>;
}
