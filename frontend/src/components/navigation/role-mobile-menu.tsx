"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavigationItems, getSellerSidebarGroups, type AppRole } from "./navigation-items";
import { Icon } from "../ui/icon";

type Props = { role: Exclude<AppRole, null | "BUYER">; open: boolean; onClose: () => void };

function isActive(pathname: string, href: string) {
  return href === "/seller" || href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function RoleMobileMenu({ role, open, onClose }: Props) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const controls = [...panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [open, onClose]);

  useEffect(() => { onClose(); }, [pathname, onClose]);
  if (!open) return null;

  return (
    <div className="role-menu-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={panelRef} className="role-menu-panel" role="dialog" aria-modal="true" aria-label={role === "SELLER" ? "Menu người bán" : "Menu quản trị"}>
        <div className="role-menu-panel__header">
          <strong>{role === "SELLER" ? "Kênh người bán" : "Quản trị Dino"}</strong>
          <button type="button" className="icon-button" aria-label="Đóng menu" onClick={onClose}><Icon name="close" /></button>
        </div>
        <nav className="role-menu-panel__nav" aria-label={role === "SELLER" ? "Điều hướng người bán" : "Điều hướng quản trị"}>
          {role === "SELLER" ? getSellerSidebarGroups().map(group => (
            <section className="role-menu-panel__group" key={group.title}>
              {group.href ? (
                <Link href={group.href} aria-current={isActive(pathname, group.href) ? "page" : undefined}>
                  <Icon name={group.icon} className="h-5 w-5" /><span>{group.title}</span>
                </Link>
              ) : <>
                <h2><Icon name={group.icon} className="h-4 w-4" />{group.title}</h2>
                {group.children?.map(child => <Link key={child.href} href={child.href} aria-current={isActive(pathname, child.href) ? "page" : undefined}>{child.label}</Link>)}
              </>}
            </section>
          )) : adminNavigationItems.map(item => (
            <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>{item.label}</Link>
          ))}
        </nav>
      </aside>
    </div>
  );
}
