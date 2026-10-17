"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Icon } from "../ui/icon";
import { getTopNavItems, type AppRole } from "./navigation-items";
import { UserDropdown } from "./user-dropdown";
import { NotificationPopover } from "@/features/notifications/notification-popover";
import { apiNotificationRepository, demoNotificationRepository } from "@/features/notifications/notification-repository";

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

type SiteHeaderProps = {
  role?: AppRole;
  isSellerArea?: boolean;
};

export function SiteHeader({ role = null, isSellerArea = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const liveNotificationsAvailable = process.env.NEXT_PUBLIC_USE_MOCK !== "true" || process.env.NEXT_PUBLIC_NOTIFICATIONS_API === "live";
  const notificationRepository = liveNotificationsAvailable ? apiNotificationRepository : demoNotificationRepository;
  const notifications = user && (user.role === "BUYER" || user.role === "SELLER")
    ? <NotificationPopover production={process.env.NODE_ENV === "production"} liveAvailable={liveNotificationsAvailable} repository={notificationRepository} />
    : null;

  const [searchQuery, setSearchQuery] = useState("");

  // Sync input value with current URL query 'search' or 'q'
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const q = sp.get("search") || sp.get("q") || "";
      setSearchQuery(q);
    }
  }, [pathname]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("catalog-search-submit", { detail: trimmed }));
    }
    if (trimmed) {
      router.push(`/products?search=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/products");
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Header dành riêng cho Kênh Người Bán (Seller Center)
  if (isSellerArea) {
    return (
      <header className="site-header site-header--seller">
        <div className="site-header__inner">
          <div className="flex items-center gap-3">
            <Link className="brand-lockup flex items-center gap-2" href="/seller" aria-label="Dino Kênh người bán">
              <span className="font-bold text-xl tracking-tight">Dino</span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-[var(--primary-surface)] text-[var(--primary-active)] border border-[var(--primary-border)]">
                Kênh người bán
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--subtext)] hover:text-[var(--foreground)] hover:bg-[var(--card-muted)] rounded-lg transition-colors min-h-[38px]"
              aria-label="Quay lại mua sắm"
            >
              <Icon name="home" className="w-4 h-4" />
              <span className="hidden sm:inline">Quay lại mua sắm</span>
            </Link>

            {notifications}
            <UserDropdown user={user} onLogout={handleLogout} />
          </div>
        </div>
      </header>
    );
  }

  // Header thông thường cho Người mua / Khách
  return (
    <header className={`site-header${pathname === "/" ? " site-header--home" : ""}`}>
        {pathname === "/" && (
          <div className="site-header__announcement">
            <span>Khám phá món hay từ các gian hàng đang hoạt động</span>
          </div>
        )}
      <div className="site-header__inner">
        <Link className="brand-lockup" href="/" aria-label="Dino - trang chủ">
          <span>Dino</span>
        </Link>
        <form className="header-search" onSubmit={handleSearchSubmit} action="/products" role="search">
          <Icon name="search" className="header-search__icon" />
          <input
            className="form-control"
            type="search"
            name="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm sản phẩm..."
            aria-label="Tìm sản phẩm"
          />
        </form>
        <nav className="primary-nav desktop-nav" aria-label="Điều hướng chính">
          {getTopNavItems(role).map((item) => (
            <Link className="primary-nav__link" href={item.href} key={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
              <Icon name={item.icon} />{item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions flex items-center gap-2">
          {notifications}
          {user ? (
            <UserDropdown user={user} onLogout={handleLogout} />
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
  const visible = getTopNavItems(role);
  return (
    <nav className="mobile-dock" aria-label="Điều hướng nhanh">
      {visible.map((item) => (
        <Link className="mobile-dock__link" href={item.href} key={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
          <Icon name={item.icon} /><span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

