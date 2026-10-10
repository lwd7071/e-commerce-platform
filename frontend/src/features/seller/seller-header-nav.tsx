"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SellerTabItem {
  href: string;
  label: string;
}

export const SELLER_NAV_TABS: SellerTabItem[] = [
  { href: "/seller", label: "Tổng quan" },
  { href: "/seller/orders", label: "Đơn bán" },
  { href: "/seller/products", label: "Sản phẩm" },
  { href: "/seller/wallet", label: "Ví người bán" },
  { href: "/seller/chat", label: "Tin nhắn" },
  { href: "/seller/vouchers", label: "Mã giảm giá" },
  { href: "/seller/reports", label: "Báo cáo" },
  { href: "/seller/shop", label: "Hồ sơ Shop" },
];

export function SellerHeaderNav() {
  const pathname = usePathname();

  const isTabActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/seller") {
      return pathname === "/seller";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label="Điều hướng kênh người bán"
      className="border-b border-[var(--border)] bg-[var(--card)]/50 backdrop-blur-xs sticky top-0 z-10 -mx-4 px-4 sm:mx-0 sm:px-0 mb-6"
    >
      <div className="flex gap-2 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth py-1">
        {SELLER_NAV_TABS.map((tab) => {
          const active = isTabActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center min-h-[44px] px-3 sm:px-2 py-2.5 text-sm font-semibold transition-colors border-2 rounded-lg whitespace-nowrap ${
                active
                  ? "border-transparent text-[var(--primary-active)] font-bold"
                  : "border-transparent text-[var(--subtext)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
