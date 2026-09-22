import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationService } from '../../../../src/modules/buyer/services/notification.service';
import { ResourceNotFoundError } from '../../../../src/modules/buyer/domain/errors';
import type { INotificationRepository } from '../../../../src/modules/buyer/domain/repositories';
import type { IBuyerEventPort, BuyerDomainEvent } from '../../../../src/modules/buyer/ports/buyer-event.port';
import type { Notification, UUID } from '../../../../src/modules/buyer/domain/types';
import { mockBuyerId } from '../fixtures';

class MockNotificationRepository implements INotificationRepository {
  public notifications: Map<UUID, Notification> = new Map();

  async findById(notificationId: UUID): Promise<Notification | null> {
    return this.notifications.get(notificationId) ?? null;
  }

  async findByRecipientId(recipientId: UUID, isRead?: boolean): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(n => {
      if (n.recipientId !== recipientId) return false;
      if (isRead !== undefined && n.isRead !== isRead) return false;
      return true;
    });
  }

  async create(notification: Notification): Promise<Notification> {
    this.notifications.set(notification.notificationId, notification);
    return notification;
  }

  async markAsRead(notificationId: UUID, readAt?: string): Promise<Notification> {
    const existing = this.notifications.get(notificationId);
    if (!existing) throw new Error('Notification not found');
    const updated: Notification = {
      ...existing,
      isRead: true,
      readAt: readAt ?? new Date().toISOString(),
    };
    this.notifications.set(notificationId, updated);
    return updated;
  }
}

class MockBuyerEventPort implements IBuyerEventPort {
  private handlers: ((event: BuyerDomainEvent) => Promise<void>)[] = [];

  subscribe(handler: (event: BuyerDomainEvent) => Promise<void>): void {
    this.handlers.push(handler);
  }

  async publish(event: BuyerDomainEvent): Promise<void> {
    for (const h of this.handlers) {
      await h(event);
    }
  }
}

describe('NotificationService Tests (TDD - Ownership, Idempotency & Events)', () => {
  let notificationRepo: MockNotificationRepository;
  let eventPort: MockBuyerEventPort;
  let notificationService: NotificationService;

  const otherBuyerId = '88888888-8888-4888-8888-888888888888';
  const notifId1 = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    notificationRepo = new MockNotificationRepository();
    eventPort = new MockBuyerEventPort();
    notificationService = new NotificationService(notificationRepo, eventPort);
  });

  describe('getNotifications & getNotificationById', () => {
    it('lấy danh sách thông báo của người nhận và lọc theo isRead', async () => {
      await notificationRepo.create({
        notificationId: notifId1,
        recipientId: mockBuyerId,
        type: 'ORDER',
        title: 'Đơn hàng mới',
        content: 'Nội dung',
        isRead: false,
        createdAt: new Date().toISOString(),
        readAt: null,
      });

      await notificationRepo.create({
        notificationId: '22222222-2222-4222-8222-222222222222',
        recipientId: mockBuyerId,
        type: 'PAYMENT',
        title: 'Thanh toán thành công',
        content: 'Nội dung',
        isRead: true,
        createdAt: new Date().toISOString(),
        readAt: new Date().toISOString(),
      });

      const unread = await notificationService.getNotifications(mockBuyerId, false);
      assert.equal(unread.length, 1);
      assert.equal(unread[0].isRead, false);

      const all = await notificationService.getNotifications(mockBuyerId);
      assert.equal(all.length, 2);
    });

    it('[auth-rbac-rls.md §3] ném 404 RESOURCE_NOT_FOUND khi getNotificationById không thuộc caller', async () => {
      await notificationRepo.create({
        notificationId: notifId1,
        recipientId: otherBuyerId, // Thuộc về user khác
        type: 'ORDER',
        title: 'Bí mật',
        content: 'Nội dung',
        isRead: false,
        createdAt: new Date().toISOString(),
        readAt: null,
      });

      await assert.rejects(
        async () => notificationService.getNotificationById(mockBuyerId, notifId1),
        (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
      );
    });
  });

  describe('markAsRead', () => {
    it('[RB-LTT07] đánh dấu đã đọc thành công: isRead=true và readAt!=null', async () => {
      await notificationRepo.create({
        notificationId: notifId1,
        recipientId: mockBuyerId,
        type: 'ORDER',
        title: 'Thông báo',
        content: 'Nội dung',
        isRead: false,
        createdAt: new Date().toISOString(),
        readAt: null,
      });

      const updated = await notificationService.markAsRead(mockBuyerId, notifId1);
      assert.equal(updated.isRead, true);
      assert.ok(updated.readAt !== null);
    });

    it('[auth-rbac-rls.md §3] ném 404 RESOURCE_NOT_FOUND khi markAsRead thông báo của người khác', async () => {
      await notificationRepo.create({
        notificationId: notifId1,
        recipientId: otherBuyerId,
        type: 'ORDER',
        title: 'Thông báo',
        content: 'Nội dung',
        isRead: false,
        createdAt: new Date().toISOString(),
        readAt: null,
      });

      await assert.rejects(
        async () => notificationService.markAsRead(mockBuyerId, notifId1),
        (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
      );
    });

    it('idempotent: gọi lại trên thông báo đã đọc không làm thay đổi readAt gốc', async () => {
      const originalReadAt = '2026-09-15T10:00:00.000Z';
      await notificationRepo.create({
        notificationId: notifId1,
        recipientId: mockBuyerId,
        type: 'ORDER',
        title: 'Thông báo',
        content: 'Nội dung',
        isRead: true,
        createdAt: '2026-09-15T09:00:00.000Z',
        readAt: originalReadAt,
      });

      const result = await notificationService.markAsRead(mockBuyerId, notifId1);
      assert.equal(result.isRead, true);
      assert.equal(result.readAt, originalReadAt);
    });
  });

  describe('Domain Event Handling & In-Memory Deduplication', () => {
    it('nhận event PAYMENT_SUCCESS từ eventPort và tạo Notification tương ứng', async () => {
      const event: BuyerDomainEvent = {
        eventId: 'eeee1111-1111-4111-8111-111111111111',
        type: 'PAYMENT_SUCCESS',
        recipientId: mockBuyerId,
        orderId: 'oooo1111-1111-4111-8111-111111111111',
        title: 'Thanh toán thành công',
        content: 'Đơn hàng của bạn đã thanh toán thành công.',
        occurredAt: new Date().toISOString(),
      };

      await eventPort.publish(event);

      const list = await notificationService.getNotifications(mockBuyerId);
      assert.equal(list.length, 1);
      assert.equal(list[0].type, 'PAYMENT');
      assert.equal(list[0].title, 'Thanh toán thành công');
      assert.equal(list[0].isRead, false);
    });

    it('nhận event SHIPMENT_DELIVERED tạo Notification type SHIPPING', async () => {
      const event: BuyerDomainEvent = {
        eventId: 'eeee2222-2222-4222-8222-222222222222',
        type: 'SHIPMENT_DELIVERED',
        recipientId: mockBuyerId,
        orderId: 'oooo1111-1111-4111-8111-111111111111',
        title: 'Đã giao hàng thành công',
        content: 'Kiện hàng đã được giao.',
        occurredAt: new Date().toISOString(),
      };

      await eventPort.publish(event);

      const list = await notificationService.getNotifications(mockBuyerId);
      assert.equal(list.length, 1);
      assert.equal(list[0].type, 'SHIPPING');
    });

    it('nhận event ORDER_COMPLETED tạo Notification type ORDER', async () => {
      const event: BuyerDomainEvent = {
        eventId: 'eeee3333-3333-4333-8333-333333333333',
        type: 'ORDER_COMPLETED',
        recipientId: mockBuyerId,
        orderId: 'oooo1111-1111-4111-8111-111111111111',
        title: 'Đơn hàng hoàn tất',
        content: 'Cảm ơn bạn đã mua hàng.',
        occurredAt: new Date().toISOString(),
      };

      await eventPort.publish(event);

      const list = await notificationService.getNotifications(mockBuyerId);
      assert.equal(list.length, 1);
      assert.equal(list[0].type, 'ORDER');
    });

    it('idempotency / replay test: nhận lại event trùng lặp eventId -> bỏ qua, không tạo duplicate', async () => {
      const event: BuyerDomainEvent = {
        eventId: 'eeee4444-4444-4444-8444-444444444444',
        type: 'ORDER_COMPLETED',
        recipientId: mockBuyerId,
        orderId: 'oooo1111-1111-4111-8111-111111111111',
        title: 'Đơn hàng hoàn tất',
        content: 'Cảm ơn bạn đã mua hàng.',
        occurredAt: new Date().toISOString(),
      };

      // Gửi lần 1
      await eventPort.publish(event);
      // Gửi lần 2 (replay)
      await eventPort.publish(event);

      const list = await notificationService.getNotifications(mockBuyerId);
      assert.equal(list.length, 1);
    });
  });
});
