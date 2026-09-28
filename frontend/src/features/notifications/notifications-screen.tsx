"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { ProtectedPage } from "../../components/navigation/protected-page";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/data-states";
import { Icon } from "../../components/ui/icon";

type Notice = { id: string; title: string; body: string; createdAt: string; isRead: boolean };
const demoRows: Notice[] = [
  { id: "demo-order-1", title: "Đơn hàng đang được chuẩn bị", body: "Cửa hàng đã xác nhận đơn hàng của bạn.", createdAt: "Ví dụ: hôm nay", isRead: false },
  { id: "demo-promo-1", title: "Ưu đãi dành cho bạn", body: "Đây là dữ liệu giao diện mẫu, không phải ưu đãi đang hoạt động.", createdAt: "Ví dụ: hôm qua", isRead: true },
];

export function NotificationsScreen({ production }: { production: boolean }) {
  const [rows, setRows] = useState(demoRows);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unreadCount = rows.filter((row) => !row.isRead).length;
  const visibleRows = useMemo(() => rows.filter((row) => filter === "all" || !row.isRead), [filter, rows]);

  function markRead(id: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, isRead: true } : row));
  }

  function markVisibleRead() {
    // Deliberately bounded to 20 IDs; current demo writes only local state. Replace with per-item API calls until GAP-10 adds bulk.
    const ids = visibleRows.filter((row) => !row.isRead).slice(0, 20).map((row) => row.id);
    setRows((current) => current.map((row) => ids.includes(row.id) ? { ...row, isRead: true } : row));
  }

  return (
    <>
      <header className="page-heading">
        <div><p className="eyebrow">Cập nhật mới nhất</p><h1 className="page-title">Thông báo</h1><p className="page-description">Theo dõi cập nhật về đơn hàng và tài khoản.</p></div>
        {!production && <span className="dev-data-note"><Icon name="warning" />Dữ liệu demo — chỉ lưu trong màn hình này</span>}
      </header>
      {production ? (
        <section className="error-state surface-card" role="status"><span className="empty-state__icon"><Icon name="info" /></span><h2>Thông báo chưa khả dụng</h2><p>API thông báo hiện chưa được backend cấu hình (runtime trả 501). Không có dữ liệu giả hoặc thao tác ghi nào được thực hiện.</p></section>
      ) : (
        <section className="surface-card section-card" aria-label="Danh sách thông báo">
          <div className="notification-toolbar">
            <div className="filter-tabs" role="group" aria-label="Lọc thông báo">
              <button className="filter-tab" type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Tất cả ({rows.length})</button>
              <button className="filter-tab" type="button" aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>Chưa đọc ({unreadCount})</button>
            </div>
            <Button variant="secondary" disabled={unreadCount === 0} onClick={markVisibleRead}>Đánh dấu tối đa 20 đã đọc</Button>
          </div>
          {visibleRows.length === 0 ? <EmptyState title="Bạn đã xem hết thông báo" description="Thông báo mới sẽ xuất hiện tại đây khi dịch vụ được bật." icon="bell" /> : (
            <ul className="notification-list" aria-live="polite">
              {visibleRows.map((row) => <li className={`notification-item${row.isRead ? "" : " notification-item--unread"}`} key={row.id}>
                <span className="notification-icon"><Icon name="bell" /></span>
                <div><h2 className="notification-item__title">{row.title}</h2><p className="notification-item__body">{row.body}</p><time className="notification-item__meta">{row.createdAt}</time></div>
                {!row.isRead ? <Button className="notification-item__action" variant="ghost" onClick={() => markRead(row.id)}>Đánh dấu đã đọc</Button> : <span className="notification-item__meta">Đã đọc</span>}
              </li>)}
            </ul>
          )}
          <p className="field-help">Bản mẫu không kết nối API và không có cập nhật realtime. Khi nối API, thao tác lỗi phải rollback trạng thái lạc quan.</p>
        </section>
      )}
    </>
  );
}

export function NotificationsPageContent({ production }: { production: boolean }) {
  const { user } = useAuth();
  return <ProtectedPage><NotificationsScreen production={production && Boolean(user)} /></ProtectedPage>;
}
