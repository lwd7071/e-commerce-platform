import { randomUUID } from 'node:crypto';
import type { INotificationRepository } from '../domain/repositories';
import type { IBuyerEventPort, BuyerDomainEvent } from '../ports/buyer-event.port';
import type { Notification, NotificationType, UUID } from '../domain/types';
import { ResourceNotFoundError } from '../domain/errors';
import { markNotificationAsRead } from '../domain/notification';

/**
 * Service quản lý thông báo cho người mua (Notification).
 * Áp dụng:
 * - [RB-LTT07]: Notification.IsRead = TRUE -> ReadAt IS NOT NULL.
 * - [auth-rbac-rls.md §3]: Trả về 404 RESOURCE_NOT_FOUND khi caller không sở hữu notification.
 * - In-memory event deduplication: Tránh trùng lặp khi replay domain event (ticket DEP-P4-P2-01).
 * - Dual-path notification architecture: Nhận các event vòng đời (PAYMENT_SUCCESS, SHIPMENT_DELIVERED, ORDER_COMPLETED).
 */
export class NotificationService {
  private readonly processedEventIds: Set<string> = new Set();

  constructor(
    private readonly notificationRepo: INotificationRepository,
    eventPort?: IBuyerEventPort
  ) {
    if (eventPort) {
      eventPort.subscribe(async (event: BuyerDomainEvent) => {
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

  async handleDomainEvent(event: BuyerDomainEvent): Promise<void> {
    // In-memory deduplication (ticket DEP-P4-P2-01 gửi Người 2 để bổ sung cột event_id UNIQUE trong DB)
    if (this.processedEventIds.has(event.eventId)) {
      return;
    }

    let type: NotificationType = 'ORDER';
    if (event.type === 'PAYMENT_SUCCESS') {
      type = 'PAYMENT';
    } else if (event.type === 'SHIPMENT_DELIVERED') {
      type = 'SHIPPING';
    } else if (event.type === 'ORDER_COMPLETED') {
      type = 'ORDER';
    }

    const now = new Date().toISOString();
    const notification: Notification = {
      notificationId: randomUUID(),
      recipientId: event.recipientId,
      type,
      title: event.title,
      content: event.content,
      isRead: false,
      createdAt: now,
      readAt: null,
    };

    await this.notificationRepo.create(notification);
    this.processedEventIds.add(event.eventId);
  }
}
