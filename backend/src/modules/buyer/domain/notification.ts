import type { Notification } from './types.ts';

/**
 * [RB-LTT07] Notification.IsRead = TRUE -> ReadAt IS NOT NULL
 * Đảm bảo idempotent: nếu đã đọc thì không cập nhật lại readAt
 */
export function markNotificationAsRead(notification: Notification, nowStr?: string): Notification {
  if (notification.isRead && notification.readAt !== null) {
    return notification;
  }

  const readAt = nowStr ?? new Date().toISOString();
  return {
    ...notification,
    isRead: true,
    readAt,
  };
}
