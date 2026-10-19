"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import { voucherApi, type PublicPlatformVoucher } from "@/lib/api/voucher.api";
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
  onToggleSellerMenu?: () => void;
};

export function SiteHeader({ role = null, isSellerArea = false, onToggleSellerMenu }: SiteHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const liveNotificationsAvailable = process.env.NEXT_PUBLIC_USE_MOCK !== "true" || process.env.NEXT_PUBLIC_NOTIFICATIONS_API === "live";
  const notificationRepository = liveNotificationsAvailable ? apiNotificationRepository : demoNotificationRepository;
  const notifications = user && (user.role === "BUYER" || user.role === "SELLER")
    ? <NotificationPopover production={process.env.NODE_ENV === "production"} liveAvailable={liveNotificationsAvailable} repository={notificationRepository} />
    : null;

  const [searchQuery, setSearchQuery] = useState("");
  const [publicVouchers, setPublicVouchers] = useState<PublicPlatformVoucher[]>([]);
  const [voucherPaused, setVoucherPaused] = useState(false);
  const [voucherHovered, setVoucherHovered] = useState(false);
  const [voucherFocused, setVoucherFocused] = useState(false);

  useEffect(() => {
    if (pathname !== "/" || isSellerArea) return;
    let active = true;
    void voucherApi.getPublicPlatformVouchers().then(vouchers => {
      if (active) setPublicVouchers(current => vouchers.length || current.length ? vouchers : current);
    }).catch(() => {
      if (active) setPublicVouchers(current => current.length ? [] : current);
    });
    return () => { active = false; };
  }, [pathname, isSellerArea]);

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

  const renderVoucher = (voucher: PublicPlatformVoucher, duplicate = false) => {
    const discount = voucher.discountType === "PERCENT"
      ? `Giảm ${Number(voucher.discountValue)}%${voucher.maxDiscount ? ` tối đa ${moneyAdapter.formatVND(voucher.maxDiscount)}` : ""}`
      : `Giảm ${moneyAdapter.formatVND(voucher.discountValue)}`;
    return <span className="site-header__announcement-voucher" key={voucher.voucherId}>
      <span className="site-header__announcement-scope">Ưu đãi toàn sàn</span>
      <strong>{discount}</strong>
      <span>Mã <b>{voucher.code}</b></span>
      <span>Đơn từ {moneyAdapter.formatVND(voucher.minOrderValue)}</span>
      {duplicate ? <span className="site-header__announcement-link">Xem voucher</span> : <Link href="/#uu-dai" className="site-header__announcement-link">Xem voucher</Link>}
    </span>;
  };

  // Header dành riêng cho Kênh Người Bán (Seller Center)
  if (isSellerArea) {
    return (
      <header className="site-header site-header--seller">
        <div className="site-header__inner flex items-center justify-between !flex-nowrap gap-2 sm:gap-4 w-full">
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {onToggleSellerMenu && (
              <button
                type="button"
                onClick={onToggleSellerMenu}
                className="md:hidden flex items-center justify-center p-2 rounded-lg text-[var(--foreground)] hover:bg-[var(--card-muted)] transition-colors min-h-[38px] min-w-[38px]"
                aria-label="Mở menu người bán"
              >
                <Icon name="menu" className="w-5 h-5" />
              </button>
            )}
            <Link className="brand-lockup flex items-center gap-1.5 sm:gap-2 shrink-0" href="/seller" aria-label="Dino Kênh người bán">
              <span className="font-bold text-lg sm:text-xl tracking-tight">Dino</span>
              <span className="px-1.5 sm:px-2 py-0.5 text-[11px] sm:text-xs font-semibold rounded-md bg-[var(--primary-surface)] text-[var(--primary-active)] border border-[var(--primary-border)] whitespace-nowrap">
                Kênh người bán
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 ml-auto">
            <Link
              href="/"
              className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 text-sm font-medium text-[var(--subtext)] hover:text-[var(--foreground)] hover:bg-[var(--card-muted)] rounded-lg transition-colors min-h-[38px]"
              aria-label="Quay lại mua sắm"
              title="Quay lại mua sắm"
            >
              <Icon name="home" className="w-4 h-4" />
              <span className="hidden md:inline">Quay lại mua sắm</span>
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
            {publicVouchers.length ? <div
              className={`site-header__announcement-content${voucherPaused || voucherHovered || voucherFocused ? " site-header__announcement-content--paused" : ""}`}
              onMouseEnter={() => setVoucherHovered(true)}
              onMouseLeave={() => setVoucherHovered(false)}
              onFocusCapture={() => setVoucherFocused(true)}
              onBlurCapture={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setVoucherFocused(false);
              }}
            >
              <div className="site-header__announcement-viewport">
                <div className={`site-header__announcement-track${publicVouchers.length > 1 ? " site-header__announcement-track--moving" : ""}`}>
                  <div className="site-header__announcement-group" aria-live="off">{publicVouchers.map(voucher => renderVoucher(voucher))}</div>
                  <div className="site-header__announcement-group" aria-hidden="true">{publicVouchers.map(voucher => renderVoucher(voucher, true))}</div>
                </div>
              </div>
              {publicVouchers.length > 1 && <div className="site-header__announcement-controls">
                <button type="button" aria-label={voucherPaused ? "Tiếp tục chạy ưu đãi" : "Tạm dừng chạy ưu đãi"} aria-pressed={voucherPaused} onClick={() => setVoucherPaused(value => !value)}>{voucherPaused ? "▶" : "Ⅱ"}</button>
              </div>}
            </div> : <span>Khám phá món hay từ các gian hàng đang hoạt động</span>}
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

