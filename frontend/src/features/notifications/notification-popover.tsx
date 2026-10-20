"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { AppError } from "@/lib/api/app-error";
import type { NotificationRepository } from "./notification-repository";
import {
  countUnreadNotifications,
  markNotificationRead,
  type NotificationRow,
} from "./notification-state";

const PREVIEW_LIMIT = 5;

type Props = {
  production: boolean;
  liveAvailable: boolean;
  repository: NotificationRepository;
};

export function NotificationPopover({ production, liveAvailable, repository }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const unreadCount = countUnreadNotifications(rows);

  useEffect(() => {
    if (production && !liveAvailable) return;
    let active = true;
    setActionMessage(null);
    setLoadState("loading");
    repository.list().then((data) => {
      if (active) {
        setRows(data);
        setLoadState("ready");
      }
    }).catch((error: unknown) => {
      if (active) {
        setActionMessage(error instanceof Error ? error.message : "Đã có lỗi khi tải thông báo.");
        setLoadState("error");
      }
    });
    return () => { active = false; };
  }, [liveAvailable, loadAttempt, production, repository]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function markRead(id: string) {
    const previous = rows.find((row) => row.id === id);
    if (!previous || previous.isRead) return;
    setRows((current) => markNotificationRead(current, id));
    setActionMessage(null);
    try {
      await repository.markRead(id);
    } catch (error) {
      setRows((current) => current.map((row) => row.id === id ? previous : row));
      const message = error instanceof Error ? error.message : "Chưa thể cập nhật thông báo.";
      const requestId = error instanceof AppError ? error.requestId : undefined;
      setActionMessage(requestId ? `${message} (Mã yêu cầu: ${requestId})` : message);
    }
  }

  return (
    <div className="relative max-[767px]:static" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-[var(--subtext)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}
        aria-expanded={isOpen}
        aria-controls="notification-popover-panel"
      >
        <Icon name="bell" className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[var(--danger)] px-1 text-center text-[10px] font-bold leading-4 text-white" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          id="notification-popover-panel"
          role="dialog"
          aria-label="Thông báo mới nhất"
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)] max-[767px]:right-4"
        >
          <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Thông báo</h2>
            {unreadCount > 0 && <span className="text-xs text-[var(--subtext)]">{unreadCount} chưa đọc</span>}
          </header>

          {production && !liveAvailable ? (
            <p className="px-4 py-5 text-sm text-[var(--subtext)]" role="status">Thông báo chưa khả dụng.</p>
          ) : loadState === "loading" || loadState === "idle" ? (
            <p className="px-4 py-5 text-sm text-[var(--subtext)]" role="status">Đang tải thông báo…</p>
          ) : loadState === "error" ? (
            <div className="space-y-3 px-4 py-4" role="alert">
              <p className="text-sm text-[var(--subtext)]">{actionMessage ?? "Chưa tải được thông báo."}</p>
              <button type="button" className="text-sm font-semibold text-[var(--primary-active)]" onClick={() => { setActionMessage(null); setLoadAttempt((attempt) => attempt + 1); }}>
                Thử lại
              </button>
            </div>
          ) : rows.length === 0 ? (
            <p className="px-4 py-5 text-sm text-[var(--subtext)]">Bạn đã xem hết thông báo.</p>
          ) : (
            <>
              <ul className="max-h-80 divide-y divide-[var(--border)] overflow-y-auto" aria-live="polite">
                {rows.slice(0, PREVIEW_LIMIT).map((row) => (
                  <li key={row.id} className={`flex items-start gap-3 px-4 py-3${row.isRead ? "" : " bg-[var(--primary-surface)]/50"}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full${row.isRead ? " bg-transparent" : " bg-[var(--primary-active)]"}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--foreground)]">{row.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--subtext)]">{row.body}</p>
                      <time className="mt-1 block text-[11px] text-[var(--subtext)]">{row.createdAt}</time>
                    </div>
                    {!row.isRead && (
                      <button type="button" className="shrink-0 rounded-md p-1.5 text-[var(--subtext)] hover:bg-[var(--card-muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]" aria-label={`Đánh dấu ${row.title} đã đọc`} onClick={() => void markRead(row.id)}>
                        <Icon name="check" className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {actionMessage && <p className="px-4 py-2 text-xs text-[var(--danger)]" role="alert">{actionMessage}</p>}
            </>
          )}

          <footer className="border-t border-[var(--border)] px-4 py-3">
            <Link href="/notifications" onClick={() => setIsOpen(false)} className="block text-center text-sm font-semibold text-[var(--primary-active)] hover:underline">
              Xem tất cả
            </Link>
          </footer>
        </section>
      )}
    </div>
  );
}
