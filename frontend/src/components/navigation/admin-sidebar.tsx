"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";

const sections: Array<{ title: string; links: Array<{ href: string; label: string; icon: IconName }> }> = [
  { title: "Tổng quan", links: [{ href: "/admin", label: "Bảng điều khiển", icon: "home" }] },
  { title: "Vận hành", links: [
    { href: "/admin/shops", label: "Gian hàng & Mall", icon: "grid" },
    { href: "/admin/categories", label: "Danh mục", icon: "grid" },
    { href: "/admin/orders", label: "Đơn hàng & ký quỹ", icon: "bag" },
    { href: "/admin/finance", label: "Tài chính & Ví sàn", icon: "bag" },
  ] },
  { title: "Kiểm duyệt & tăng trưởng", links: [
    { href: "/admin/reviews", label: "Đánh giá", icon: "star" },
    { href: "/admin/vouchers", label: "Voucher", icon: "grid" },
    { href: "/admin/campaigns", label: "Chiến dịch", icon: "bell" },
  ] },
  { title: "Theo dõi", links: [
    { href: "/admin/reports", label: "Báo cáo", icon: "info" },
    { href: "/admin/audit-logs", label: "Nhật ký quản trị", icon: "info" },
  ] },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="admin-sidebar seller-sidebar w-64 shrink-0 bg-[var(--card)] border-r border-[var(--border)] p-4 flex flex-col gap-5 min-h-[calc(100vh-var(--header-height,76px))]" aria-label="Thanh điều hướng quản trị">
      <div className="px-2 pt-1 pb-2 border-b border-[var(--border)]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--subtext)]">Quản trị Dino</h2>
      </div>
      <nav className="flex flex-col gap-4" aria-label="Phân hệ quản trị">
        {sections.map(section => <section key={section.title} className="flex flex-col gap-1">
          <h3 className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--subtext)]">{section.title}</h3>
          {section.links.map(link => {
            const active = link.href === "/admin" ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors min-h-[40px] ${active ? "font-semibold text-[var(--primary-active)] bg-[var(--primary-surface)]" : "text-[var(--foreground)] hover:bg-[var(--card-muted)]"}`}>
              <Icon name={link.icon} className={`w-4 h-4 ${active ? "text-[var(--primary-active)]" : "text-[var(--subtext)]"}`} /><span>{link.label}</span>
            </Link>;
          })}
        </section>)}
      </nav>
    </aside>
  );
}
