import { randomUUID } from 'node:crypto';
import type { INotificationRepository } from '../domain/repositories';
import type { ITransactionEventPort, TransactionDomainEvent } from '../ports/buyer-event.port';
import type { IOrderQueryPort } from '../ports/order-query.port';
import type { IEventIdempotencyStore } from '../ports/event-idempotency.port';
import { InMemoryEventIdempotencyStore } from '../ports/event-idempotency.port';
import type { Notification, NotificationType, UUID } from '../domain/types';
import { ResourceNotFoundError } from '../domain/errors';
import { markNotificationAsRead } from '../domain/notification';

/**
 * Service quản lý thông báo cho người mua (Notification).
 * Áp dụng:
 * - [RB-LTT07]: Notification.IsRead = TRUE -> ReadAt IS NOT NULL.
 * - [auth-rbac-rls.md §3]: Trả về 404 RESOURCE_NOT_FOUND khi caller không sở hữu notification.
 * - IEventIdempotencyStore: Chống trùng lặp nguyên tử (atomic claim/release) và chịu lỗi (fault-tolerant retry)
 *   khi replay domain event xuyên nhiều instances (ticket DEP-P4-P2-01).
 * - Tích hợp TransactionDomainEvent từ Người 5: Tự động phân loại và phát sinh thông báo khi:
 *   + ORDER_STATUS_CHANGED chuyển sang COMPLETED (lấy buyerId trực tiếp từ event).
 *   + PAYMENT_STATUS_CHANGED chuyển sang SUCCESS (tra cứu buyerId qua IOrderQueryPort.getOrderSummary).
 *   + SHIPMENT_STATUS_CHANGED chuyển sang DELIVERED (tra cứu buyerId qua IOrderQueryPort.getOrderSummary).
 * - Null-safe: Nếu order không tìm thấy trong getOrderSummary, bỏ qua an toàn và không throw crash event loop.
 */
export class NotificationService {
  private readonly idempotencyStore: IEventIdempotencyStore;

  constructor(
    private readonly notificationRepo: INotificationRepository,
    eventPort?: ITransactionEventPort,
    private readonly orderQueryPort?: IOrderQueryPort,
    idempotencyStore?: IEventIdempotencyStore
  ) {
    this.idempotencyStore = idempotencyStore ?? new InMemoryEventIdempotencyStore();
    if (eventPort) {
      eventPort.subscribe(async (event: TransactionDomainEvent) => {
        await this.handleDomainEvent(event);
      });
    }
  }

  async getNotifications(recipientId: UUID, isRead?: boolean): Promise<Notification[]> {
    return this.notificationRepo.findByRecipientId(recipientId, isRead);
  }

  async getNotificationById(recipientId: UUID, notificationId: UUID): Promise<Notification> {
    const notif = await this.notificationRepo.findById(notificationId);
    if (!notif || notif.recipientId !== recipientId) {
      throw new ResourceNotFoundError('Notification not found', { notificationId });
    }
    return notif;
  }

  async markAsRead(recipientId: UUID, notificationId: UUID): Promise<Notification> {
    const notif = await this.notificationRepo.findById(notificationId);
    if (!notif || notif.recipientId !== recipientId) {
      throw new ResourceNotFoundError('Notification not found', { notificationId });
    }

    // Đảm bảo tính idempotent: nếu đã đọc thì không cập nhật lại readAt
    if (notif.isRead && notif.readAt !== null) {
      return notif;
    }

    const now = new Date().toISOString();
    const updated = markNotificationAsRead(notif, now);
    return this.notificationRepo.markAsRead(notificationId, updated.readAt ?? now);
  }

  async handleDomainEvent(event: TransactionDomainEvent): Promise<void> {
    // 1. Atomic claim trước mọi logic để chống duplicate giữa các workers/instances
    const claimed = await this.idempotencyStore.tryClaim(event.eventId);
    if (!claimed) {
      return;
    }

    try {
      let recipientId: UUID | null = null;
      let type: NotificationType = 'ORDER';
      let title = '';
      let content = '';

      if (event.type === 'ORDER_STATUS_CHANGED') {
        if (event.newStatus === 'COMPLETED') {
          recipientId = event.buyerId;
          type = 'ORDER';
          title = 'Đơn hàng hoàn tất';
          content = `Đơn hàng #${event.orderId} của bạn đã hoàn tất thành công.`;
        } else {
          return; // Bỏ qua các status khác một cách an toàn
        }
      } else if (event.type === 'PAYMENT_STATUS_CHANGED') {
        if (event.status === 'SUCCESS') {
          const orderSummary = await this.orderQueryPort?.getOrderSummary(event.orderId);
          if (!orderSummary) {
            // Null-safe: nếu order không tồn tại, bỏ qua an toàn, không throw crash event loop
            return;
          }
          recipientId = orderSummary.buyerId;
          type = 'PAYMENT';
          title = 'Thanh toán thành công';
          content = `Đơn hàng #${event.orderId} đã được thanh toán thành công với số tiền ${event.amount}đ.`;
        } else {
          return; // Bỏ qua PENDING / FAILED
        }
      } else if (event.type === 'SHIPMENT_STATUS_CHANGED') {
        if (event.status === 'DELIVERED') {
          const orderSummary = await this.orderQueryPort?.getOrderSummary(event.orderId);
          if (!orderSummary) {
            // Null-safe: nếu order không tồn tại, bỏ qua an toàn, không throw crash event loop
            return;
          }
          recipientId = orderSummary.buyerId;
          type = 'SHIPPING';
          title = 'Đã giao hàng thành công';
          content = `Đơn hàng #${event.orderId} đã được giao thành công.`;
        } else {
          return; // Bỏ qua PENDING / SHIPPING / HANDED_OVER / FAILED
        }
      } else {
        // ORDER_CREATED hoặc loại event khác
        return;
      }

      if (!recipientId) {
        return;
      }

      const now = new Date().toISOString();
      const notification: Notification = {
        notificationId: randomUUID(),
        recipientId,
        type,
        title,
        content,
        isRead: false,
        createdAt: now,
        readAt: null,
      };

      if (this.notificationRepo.createForEvent) {
        await this.notificationRepo.createForEvent(notification, event.eventId);
      } else {
        await this.notificationRepo.create(notification);
      }
    } catch (err) {
      // Khi DB thất bại tạm thời hoặc có lỗi, giải phóng claim để lần replay/retry tiếp theo xử lý lại
      await this.idempotencyStore.release(event.eventId);
      throw err;
    }
  }
}
