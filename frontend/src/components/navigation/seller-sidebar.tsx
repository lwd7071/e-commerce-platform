"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../ui/icon";
import { getSellerSidebarGroups, type SellerNavGroup } from "./navigation-items";

function isLinkActive(currentPath: string, href: string) {
  if (href === "/seller") {
    return currentPath === "/seller";
  }
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export type SellerSidebarProps = {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
};

export function SellerSidebar({ mobileOpen = false, onCloseMobile }: SellerSidebarProps) {
  const pathname = usePathname();
  const groups: SellerNavGroup[] = getSellerSidebarGroups();

  const renderNavContent = () => (
    <>
      <div className="px-2 pt-1 pb-2 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--subtext)]">
            Kênh Người Bán
          </h2>
        </div>
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-[var(--subtext)] hover:text-[var(--foreground)] hover:bg-[var(--card-muted)] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="Đóng menu người bán"
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-3 overflow-y-auto" aria-label="Menu chức năng gian hàng">
        {groups.map((group) => {
          // Trường hợp 1: Nhóm có con (Ví dụ: Đơn hàng, Marketing, Báo cáo)
          if (group.children && group.children.length > 0) {
            return (
              <div key={group.title} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--subtext)]">
                  <Icon name={group.icon} className="w-3.5 h-3.5 opacity-80" />
                  <span>{group.title}</span>
                </div>
                <div className="flex flex-col gap-0.5 pl-3 border-l-2 border-[var(--border)] ml-3 mt-0.5">
                  {group.children.map((child) => {
                    const active = isLinkActive(pathname, child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onCloseMobile}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors min-h-[38px] ${
                          active
                            ? "font-semibold text-[var(--primary-active)] bg-[var(--primary-surface)]"
                            : "text-[var(--foreground)] hover:bg-[var(--card-muted)] hover:text-[var(--primary-hover)]"
                        }`}
                      >
                        <span>{child.label}</span>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-active)]" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          // Trường hợp 2: Link trực tiếp cấp 1 (Ví dụ: Tổng quan, Sản phẩm, Hồ sơ gian hàng)
          const active = group.href ? isLinkActive(pathname, group.href) : false;
          return (
            <div key={group.title}>
              <Link
                href={group.href || "#"}
                onClick={onCloseMobile}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors min-h-[40px] ${
                  active
                    ? "font-semibold text-[var(--primary-active)] bg-[var(--primary-surface)]"
                    : "text-[var(--foreground)] hover:bg-[var(--card-muted)] hover:text-[var(--primary-hover)]"
                }`}
              >
                <Icon name={group.icon} className={`w-4 h-4 ${active ? "text-[var(--primary-active)]" : "text-[var(--subtext)]"}`} />
                <span>{group.title}</span>
              </Link>
            </div>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className="seller-sidebar hidden md:flex md:w-64 md:shrink-0 bg-[var(--card)] border-r border-[var(--border)] p-4 flex-col gap-5 min-h-[calc(100vh-var(--header-height,76px))]"
        aria-label="Thanh điều hướng người bán"
      >
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer (Trượt vào từ bên trái) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menu người bán trên di động"
        >
          {/* Backdrop mờ */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside
            className="seller-sidebar relative w-72 max-w-[80vw] h-full bg-[var(--card)] shadow-2xl p-4 flex flex-col gap-5 z-10 animate-in slide-in-from-left duration-200"
            aria-label="Menu chức năng người bán trên di động"
          >
            {renderNavContent()}
          </aside>
        </div>
      )}
    </>
  );
}
