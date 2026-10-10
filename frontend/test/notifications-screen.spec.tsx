// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NotificationsScreen } from "@/features/notifications/notifications-screen";
import type { NotificationRepository } from "@/features/notifications/notification-repository";
import type { NotificationRow } from "@/features/notifications/notification-state";
import { AppError } from "@/lib/api/app-error";

function rows(count: number): NotificationRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `notice-${index + 1}`,
    title: `Thông báo ${index + 1}`,
    body: "Nội dung thông báo",
    createdAt: "Ví dụ: hôm nay",
    isRead: false,
  }));
}

function repository(data: NotificationRow[]): NotificationRepository {
  return { list: vi.fn(async () => data), markRead: vi.fn(async () => undefined) };
}

describe("NotificationsScreen", () => {
  it("does not load or show demo repository data in production", async () => {
    const repo = repository(rows(1));
    render(<NotificationsScreen production repository={repo} />);

    expect(screen.getByRole("heading", { name: "Thông báo chưa khả dụng" })).not.toBeNull();
    await waitFor(() => expect(repo.list).not.toHaveBeenCalled());
    expect(screen.queryByText("Thông báo 1")).toBeNull();
  });

  it("loads and persists notifications in production when the live repository is injected", async () => {
    const user = userEvent.setup();
    const repo = repository(rows(1));
    render(<NotificationsScreen production repository={repo} liveAvailable />);

    expect(await screen.findByText("Thông báo 1")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));
    await waitFor(() => expect(repo.markRead).toHaveBeenCalledWith("notice-1"));
    expect(screen.queryByText("Thông báo chưa khả dụng")).toBeNull();
  });

  it("shows a load error and retries the repository", async () => {
    const user = userEvent.setup();
    const item = rows(1)[0];
    const repo: NotificationRepository = {
      list: vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce([item]),
      markRead: vi.fn(async () => undefined),
    };
    render(<NotificationsScreen production={false} repository={repo} />);

    await user.click(await screen.findByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Thông báo 1")).not.toBeNull();
    expect(repo.list).toHaveBeenCalledTimes(2);
  });

  it("shows the backend request ID when live notification loading fails", async () => {
    const repo: NotificationRepository = {
      list: vi.fn(async () => { throw new AppError({ status: 503, code: "SERVICE_UNAVAILABLE", message: "Unavailable", requestId: "req-notify-1" }); }),
      markRead: vi.fn(async () => undefined),
    };
    render(<NotificationsScreen production repository={repo} liveAvailable />);
    expect(await screen.findByText("Mã yêu cầu: req-notify-1")).not.toBeNull();
  });

  it("shows loading, filters unread rows, and renders the empty state", async () => {
    const user = userEvent.setup();
    const items = rows(2);
    items[0].isRead = true;
    let resolveList!: (data: NotificationRow[]) => void;
    const repo: NotificationRepository = {
      list: vi.fn(() => new Promise<NotificationRow[]>((resolve) => { resolveList = resolve; })),
      markRead: vi.fn(async () => undefined),
    };
    const view = render(<NotificationsScreen production={false} repository={repo} />);
    expect(screen.getByText("Đang tải thông báo…")).not.toBeNull();

    resolveList(items);
    expect(await screen.findByText("Thông báo 2")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Chưa đọc (1)" }));
    expect(screen.getByText("Thông báo 2")).not.toBeNull();
    expect(screen.queryByText("Thông báo 1")).toBeNull();

    view.unmount();
    render(<NotificationsScreen production={false} repository={repository([])} />);
    expect(await screen.findByText("Bạn đã xem hết thông báo")).not.toBeNull();
  });

  it("optimistically marks one item read and restores it after a failed request", async () => {
    const user = userEvent.setup();
    const item = rows(1)[0];
    let rejectRequest!: (error: Error) => void;
    const repo: NotificationRepository = {
      list: vi.fn(async () => [item]),
      markRead: vi.fn(() => new Promise<void>((_resolve, reject) => { rejectRequest = reject; })),
    };
    render(<NotificationsScreen production={false} repository={repo} />);

    await user.click(await screen.findByRole("button", { name: "Đánh dấu đã đọc" }));
    expect(screen.getByText("Đã đọc")).not.toBeNull();
    rejectRequest(new Error("Network down"));

    expect(await screen.findByRole("button", { name: "Đánh dấu đã đọc" })).not.toBeNull();
    expect(await screen.findByRole("alert")).not.toBeNull();
  });

  it("includes the request ID when mark-read fails", async () => {
    const user = userEvent.setup();
    const item = rows(1)[0];
    const repo: NotificationRepository = {
      list: vi.fn(async () => [item]),
      markRead: vi.fn(async () => { throw new AppError({ status: 503, code: "SERVICE_UNAVAILABLE", message: "Unavailable", requestId: "req-mark-2" }); }),
    };
    render(<NotificationsScreen production repository={repo} liveAvailable />);
    await user.click(await screen.findByRole("button", { name: "Đánh dấu đã đọc" }));
    expect(await screen.findByText(/Mã yêu cầu: req-mark-2/)).not.toBeNull();
  });

  it("keeps successful bulk writes, restores failed and unattempted rows after 429", async () => {
    const user = userEvent.setup();
    const items = rows(6);
    let resolveFirst!: () => void;
    const repo: NotificationRepository = {
      list: vi.fn(async () => items),
      markRead: vi.fn((id: string) => {
        if (id === "notice-1") return new Promise<void>((resolve) => { resolveFirst = resolve; });
        if (id === "notice-2") return Promise.reject(Object.assign(new Error("Rate limited"), { status: 429 }));
        if (id === "notice-3") return Promise.reject(new Error("Temporary failure"));
        return Promise.resolve();
      }),
    };
    render(<NotificationsScreen production={false} repository={repo} />);

    await user.click(await screen.findByRole("button", { name: "Đánh dấu tối đa 20 đã đọc" }));
    await waitFor(() => expect(repo.markRead).toHaveBeenCalledTimes(4));
    resolveFirst();

    expect(await screen.findByRole("alert")).not.toBeNull();
    expect(screen.getAllByText("Đã đọc")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Đánh dấu đã đọc" })).toHaveLength(4);
    expect(repo.markRead).toHaveBeenCalledTimes(4);
    expect(screen.getByRole("button", { name: "Đánh dấu tối đa 20 đã đọc" }).getAttribute("disabled")).toBeNull();
  });
});
