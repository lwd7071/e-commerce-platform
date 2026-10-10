"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "../ui/icon";
import type { AppRole } from "./navigation-items";

type UserLike = {
  email?: string | null;
  role?: AppRole;
  fullName?: string | null;
};

type Props = {
  user: UserLike | null;
  onLogout: () => void | Promise<void>;
};

export function UserDropdown({ user, onLogout }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!user) {
    return (
      <Link className="button button--secondary min-h-[40px] px-4" href="/login">
        Đăng nhập
      </Link>
    );
  }

  const role = user.role;
  const displayName = user.fullName || user.email?.split("@")[0] || "Tài khoản";

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] hover:border-[var(--subtext)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition-all min-h-[40px] cursor-pointer"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Menu người dùng"
      >
        <span className="w-7 h-7 rounded-full bg-[var(--primary-surface)] text-[var(--primary-active)] flex items-center justify-center font-bold text-xs uppercase">
          {displayName.charAt(0)}
        </span>
        <span className="text-sm font-medium text-[var(--foreground)] max-w-[120px] truncate hidden sm:inline">
          {displayName}
        </span>
        <Icon name="chevron-right" className={`w-3.5 h-3.5 text-[var(--subtext)] transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-56 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-[var(--shadow-card)] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header user info */}
          <div className="px-3.5 py-2.5 border-b border-[var(--border)]">
            <p className="text-xs font-semibold text-[var(--subtext)] uppercase tracking-wider">
              {role === "SELLER" ? "Người bán" : role === "ADMIN" ? "Quản trị viên" : "Khách hàng"}
            </p>
            <p className="text-sm font-medium text-[var(--foreground)] truncate mt-0.5">
              {user.email || displayName}
            </p>
          </div>

          {/* Links */}
          <div className="py-1">
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--card-muted)] transition-colors min-h-[40px]"
            >
              <Icon name="user" className="w-4 h-4 text-[var(--subtext)]" />
              <span>Tài khoản</span>
            </Link>

            {role === "BUYER" && (
              <Link
                href="/orders"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--card-muted)] transition-colors min-h-[40px]"
              >
                <Icon name="bag" className="w-4 h-4 text-[var(--subtext)]" />
                <span>Đơn mua</span>
              </Link>
            )}

            {role === "SELLER" && (
              <Link
                href="/seller"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--card-muted)] transition-colors min-h-[40px]"
              >
                <Icon name="grid" className="w-4 h-4 text-[var(--subtext)]" />
                <span>Kênh người bán</span>
              </Link>
            )}

            {role === "ADMIN" && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--card-muted)] transition-colors min-h-[40px]"
              >
                <Icon name="grid" className="w-4 h-4 text-[var(--subtext)]" />
                <span>Trang quản trị</span>
              </Link>
            )}
          </div>

          {/* Divider & Logout */}
          <div className="border-t border-[var(--border)] pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-surface)] transition-colors min-h-[40px] text-left cursor-pointer"
            >
              <Icon name="logout" className="w-4 h-4 text-[var(--danger)]" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
