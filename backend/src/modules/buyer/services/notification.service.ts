import { randomUUID } from 'node:crypto';
import type { INotificationRepository } from '../domain/repositories';
import type { ITransactionEventPort, TransactionDomainEvent } from '../ports/buyer-event.port';
import type { IOrderQueryPort } from '../ports/order-query.port';
import type { Notification, NotificationType, UUID } from '../domain/types';
import { ResourceNotFoundError } from '../domain/errors';
import { markNotificationAsRead } from '../domain/notification';

/**
 * Service quản lý thông báo cho người mua (Notification).
 * Áp dụng:
 * - [RB-LTT07]: Notification.IsRead = TRUE -> ReadAt IS NOT NULL.
 * - [auth-rbac-rls.md §3]: Trả về 404 RESOURCE_NOT_FOUND khi caller không sở hữu notification.
 * - In-memory event deduplication: Tránh trùng lặp khi replay domain event (ticket DEP-P4-P2-01).
 * - Tích hợp TransactionDomainEvent từ Người 5: Tự động phân loại và phát sinh thông báo khi:
 *   + ORDER_STATUS_CHANGED chuyển sang COMPLETED (lấy buyerId trực tiếp từ event).
 *   + PAYMENT_STATUS_CHANGED chuyển sang SUCCESS (tra cứu buyerId qua IOrderQueryPort.getOrderSummary).
 *   + SHIPMENT_STATUS_CHANGED chuyển sang DELIVERED (tra cứu buyerId qua IOrderQueryPort.getOrderSummary).
 * - Null-safe: Nếu order không tìm thấy trong getOrderSummary, bỏ qua an toàn và ghi eventId để chống crash event loop.
 */
export class NotificationService {
  private readonly processedEventIds: Set<string> = new Set();

  constructor(
    private readonly notificationRepo: INotificationRepository,
    eventPort?: ITransactionEventPort,
    private readonly orderQueryPort?: IOrderQueryPort
  ) {
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
    // 1. In-memory deduplication check TRƯỚC mọi logic
    if (this.processedEventIds.has(event.eventId)) {
      return;
    }
    // Ghi nhận eventId ngay để đảm bảo idempotent và tránh duplicate nếu replay
    this.processedEventIds.add(event.eventId);

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
        return; // Bỏ qua các status khác
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

    await this.notificationRepo.create(notification);
  }
}
