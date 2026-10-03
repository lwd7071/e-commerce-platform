import { AppError } from "../../lib/api/app-error";
import { buyerApi } from "../../lib/api/buyer.api";
import type { NotificationRow } from "./notification-state";

export interface NotificationRepository {
  list(): Promise<NotificationRow[]>;
  markRead(id: string): Promise<void>;
}

export type BulkMarkReadResult = {
  succeeded: string[];
  failed: string[];
  notAttempted: string[];
  stoppedByRateLimit: boolean;
  requestIds: string[];
};

export async function markNotificationsReadBounded(
  ids: string[],
  markRead: (id: string) => Promise<void>,
  concurrency = 4,
): Promise<BulkMarkReadResult> {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new Error("Notification write concurrency must be between 1 and 4");
  }
  const queue = [...new Set(ids)].slice(0, 20);
  const result: BulkMarkReadResult = { succeeded: [], failed: [], notAttempted: [], stoppedByRateLimit: false, requestIds: [] };
  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length && !result.stoppedByRateLimit) {
      const id = queue[cursor++];
      try {
        await markRead(id);
        result.succeeded.push(id);
      } catch (error) {
        result.failed.push(id);
        if (error instanceof AppError && error.requestId) result.requestIds.push(error.requestId);
        const rateLimited = error instanceof AppError
          ? error.status === 429 || error.code === "RATE_LIMIT_EXCEEDED"
          : typeof error === "object" && error !== null && "status" in error && error.status === 429;
        if (rateLimited) result.stoppedByRateLimit = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  result.notAttempted = result.stoppedByRateLimit ? queue.slice(cursor) : [];
  return result;
}

export const demoNotificationRepository: NotificationRepository = {
  async list() {
    return [
      { id: "demo-order-1", title: "Đơn hàng đang được chuẩn bị", body: "Cửa hàng đã xác nhận đơn hàng của bạn.", createdAt: "Ví dụ: hôm nay", isRead: false },
      { id: "demo-promo-1", title: "Ưu đãi dành cho bạn", body: "Đây là dữ liệu giao diện mẫu, không phải ưu đãi đang hoạt động.", createdAt: "Ví dụ: hôm qua", isRead: true },
    ];
  },
  async markRead() {
    // Demo boundary intentionally has no durable side effects.
  },
};

export const apiNotificationRepository: NotificationRepository = {
  async list() {
    const notifications = await buyerApi.getNotifications();
    return notifications.map((notification) => ({
      id: notification.notificationId,
      title: notification.title,
      body: notification.content,
      createdAt: new Date(notification.createdAt).toLocaleString("vi-VN"),
      isRead: notification.isRead,
    }));
  },
  async markRead(id) {
    await buyerApi.markNotificationRead(id);
  },
};
