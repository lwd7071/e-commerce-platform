"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { ProtectedPage } from "../../components/navigation/protected-page";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/data-states";
import { Icon } from "../../components/ui/icon";
import { demoNotificationRepository, markNotificationsReadBounded, type NotificationRepository } from "./notification-repository";
import {
  countUnreadNotifications,
  filterNotifications,
  markNotificationRead,
  markVisibleNotificationsRead,
  type NotificationFilter,
  type NotificationRow,
} from "./notification-state";

export function NotificationsScreen({ production, repository = demoNotificationRepository }: { production: boolean; repository?: NotificationRepository }) {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const unreadCount = countUnreadNotifications(rows);
  const visibleRows = useMemo(() => filterNotifications(rows, filter), [filter, rows]);

  useEffect(() => {
    if (production) return;
    let active = true;
    repository.list().then((data) => {
      if (active) { setRows(data); setLoadState("ready"); }
    }).catch(() => { if (active) setLoadState("error"); });
    return () => { active = false; };
  }, [production, repository, loadAttempt]);

  const retryLoad = () => {
    setLoadState("loading");
    setLoadAttempt((attempt) => attempt + 1);
  };

  async function markRead(id: string) {
    const wasRead = rows.find((row) => row.id === id)?.isRead ?? true;
    setRows((current) => markNotificationRead(current, id));
    setActionMessage(null);
    try { await repository.markRead(id); }
    catch (error) {
      setRows((current) => current.map((row) => row.id === id ? { ...row, isRead: wasRead } : row));
      setActionMessage(error instanceof Error ? error.message : "Chưa thể cập nhật thông báo.");
    }
  }

  async function markVisibleRead() {
    const targets = filterNotifications(rows, filter).filter((row) => !row.isRead).slice(0, 20);
    const previous = rows;
    setRows((current) => markVisibleNotificationsRead(current, filter));
    setActionMessage(null);
    const result = await markNotificationsReadBounded(targets.map(({ id }) => id), (id) => repository.markRead(id), 4);
    const rollbackIds = new Set([...result.failed, ...result.notAttempted]);
    if (rollbackIds.size) {
      setRows((current) => current.map((row) => rollbackIds.has(row.id)
        ? { ...row, isRead: previous.find((item) => item.id === row.id)?.isRead ?? row.isRead }
        : row));
      setActionMessage(result.stoppedByRateLimit
        ? "Máy chủ đang giới hạn yêu cầu. Các mục chưa cập nhật vẫn được giữ để thử lại."
        : `${rollbackIds.size} thông báo chưa cập nhật; bạn có thể thử lại.`);
    }
  }

  return (
    <>
      <header className="page-heading">
        <div><p className="eyebrow">Cập nhật mới nhất</p><h1 className="page-title">Thông báo</h1><p className="page-description">Theo dõi cập nhật về đơn hàng và tài khoản.</p></div>
        {!production && <span className="dev-data-note"><Icon name="warning" />Dữ liệu demo — chỉ lưu trong màn hình này</span>}
      </header>
      {production ? (
        <section className="error-state surface-card" role="status"><span className="empty-state__icon"><Icon name="info" /></span><h2>Thông báo chưa khả dụng</h2><p>API thông báo hiện chưa được backend cấu hình (runtime trả 501). Không có dữ liệu giả hoặc thao tác ghi nào được thực hiện.</p></section>
      ) : loadState === "loading" ? <section className="surface-card section-card" role="status" aria-live="polite">Đang tải thông báo…</section>
      : loadState === "error" ? <section className="surface-card section-card" role="alert"><h2>Chưa tải được thông báo</h2><Button variant="secondary" onClick={retryLoad}>Thử lại</Button></section>
      : (
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
          {actionMessage && <p className="field-error" role="alert">{actionMessage}</p>}
          {!production && <p className="field-help">Bản mẫu không kết nối API và không có cập nhật realtime.</p>}
        </section>
      )}
    </>
  );
}

export function NotificationsPageContent({ production }: { production: boolean }) {
  const { user } = useAuth();
  return <ProtectedPage allowedRoles={["BUYER"]}><NotificationsScreen production={production && Boolean(user)} /></ProtectedPage>;
}
