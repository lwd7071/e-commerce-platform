export type NotificationFilter = "all" | "unread";

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
};

export function countUnreadNotifications(rows: NotificationRow[]): number {
  return rows.filter((row) => !row.isRead).length;
}

export function filterNotifications(
  rows: NotificationRow[],
  filter: NotificationFilter,
): NotificationRow[] {
  return filter === "unread" ? rows.filter((row) => !row.isRead) : rows;
}

export function markNotificationRead(rows: NotificationRow[], id: string): NotificationRow[] {
  return rows.map((row) => row.id === id && !row.isRead ? { ...row, isRead: true } : row);
}

export function markVisibleNotificationsRead(
  rows: NotificationRow[],
  filter: NotificationFilter,
): NotificationRow[] {
  const ids = new Set(
    filterNotifications(rows, filter).filter((row) => !row.isRead).slice(0, 20).map((row) => row.id),
  );
  return rows.map((row) => ids.has(row.id) ? { ...row, isRead: true } : row);
}
