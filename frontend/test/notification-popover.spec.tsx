// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NotificationPopover } from "@/features/notifications/notification-popover";
import type { NotificationRepository } from "@/features/notifications/notification-repository";
import type { NotificationRow } from "@/features/notifications/notification-state";

function makeRows(): NotificationRow[] {
  return Array.from({ length: 7 }, (_, index) => ({
    id: `notice-${index + 1}`,
    title: `Thông báo ${index + 1}`,
    body: "Nội dung thông báo",
    createdAt: "Ví dụ: hôm nay",
    isRead: index === 6,
  }));
}

function makeRepository(rows: NotificationRow[]): NotificationRepository {
  return {
    list: vi.fn(async () => rows),
    markRead: vi.fn(async () => undefined),
  };
}

describe("NotificationPopover", () => {
  it("loads the unread count on mount, previews five entries, marks read, and links to all", async () => {
    const user = userEvent.setup();
    const repository = makeRepository(makeRows());
    render(<NotificationPopover production={false} liveAvailable repository={repository} />);

    expect(await screen.findByRole("button", { name: "Thông báo, 6 chưa đọc" })).not.toBeNull();
    expect(repository.list).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /Thông báo/ }));
    expect(await screen.findByRole("dialog", { name: "Thông báo mới nhất" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Thông báo, 6 chưa đọc" })).not.toBeNull();
    expect(screen.getByText("Thông báo 5")).not.toBeNull();
    expect(screen.queryByText("Thông báo 6")).toBeNull();
    expect(screen.getByRole("link", { name: "Xem tất cả" }).getAttribute("href")).toBe("/notifications");

    await user.click(screen.getByRole("button", { name: "Đánh dấu Thông báo 1 đã đọc" }));
    await waitFor(() => expect(repository.markRead).toHaveBeenCalledWith("notice-1"));
    expect(screen.getByRole("button", { name: "Thông báo, 5 chưa đọc" })).not.toBeNull();
  });

  it("closes on Escape and shows the production unavailable state without loading demo data", async () => {
    const user = userEvent.setup();
    const repository = makeRepository(makeRows());
    render(<NotificationPopover production liveAvailable={false} repository={repository} />);

    await user.click(screen.getByRole("button", { name: "Thông báo" }));
    expect(await screen.findByText("Thông báo chưa khả dụng.")).not.toBeNull();
    expect(repository.list).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
