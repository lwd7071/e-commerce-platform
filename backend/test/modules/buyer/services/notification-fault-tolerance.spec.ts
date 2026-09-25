import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationService } from '../../../../src/modules/buyer/services/notification.service';
import { InMemoryEventIdempotencyStore } from '../../../../src/modules/buyer/ports/event-idempotency.port';
import type { INotificationRepository } from '../../../../src/modules/buyer/domain/repositories';
import type { TransactionDomainEvent } from '../../../../src/modules/buyer/ports/buyer-event.port';
import type { Notification, UUID } from '../../../../src/modules/buyer/domain/types';
import { mockBuyerId } from '../fixtures';

class MockFaultyNotificationRepository implements INotificationRepository {
  public notifications: Map<UUID, Notification> = new Map();
  public shouldFailOnNextCreate = false;
  public failCount = 0;
  public createCallCount = 0;

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
    this.createCallCount++;
    if (this.shouldFailOnNextCreate) {
      this.failCount++;
      this.shouldFailOnNextCreate = false; // Tự phục hồi sau 1 lần fail (transient fault)
      throw new Error('Database connection timeout / transient error');
    }
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

describe('NotificationService Fault-Tolerance & Idempotency Store (Mốc T3)', () => {
  let repo: MockFaultyNotificationRepository;
  let sharedIdempotencyStore: InMemoryEventIdempotencyStore;
  let service: NotificationService;

  const testOrderId = 'oooo1111-1111-4111-8111-111111111111';
  const testShopId = 'ssss1111-1111-4111-8111-111111111111';

  beforeEach(() => {
    repo = new MockFaultyNotificationRepository();
    sharedIdempotencyStore = new InMemoryEventIdempotencyStore();
    service = new NotificationService(repo, undefined, undefined, sharedIdempotencyStore);
  });

  it('Test 1 (Transient DB failure & retry recovery): DB fail lần đầu -> release claim -> retry thành công -> lưu đúng 1 notification (không bị nuốt)', async () => {
    repo.shouldFailOnNextCreate = true;

    const event: TransactionDomainEvent = {
      eventId: 'retry-event-001',
      type: 'ORDER_STATUS_CHANGED',
      orderId: testOrderId,
      buyerId: mockBuyerId,
      shopId: testShopId,
      oldStatus: 'SHIPPING',
      newStatus: 'COMPLETED',
      occurredAt: new Date().toISOString(),
    };

    // Lần 1: DB bị lỗi tạm thời -> service phải throw error và release claim
    await assert.rejects(
      async () => service.handleDomainEvent(event),
      /Database connection timeout \/ transient error/
    );

    assert.equal(repo.failCount, 1);
    const notifsAfterFail = await service.getNotifications(mockBuyerId);
    assert.equal(notifsAfterFail.length, 0, 'Chưa có notification nào được ghi nhận khi DB fail');

    // Lần 2 (Replay / Retry từ Message Broker sau khi DB hồi phục)
    await service.handleDomainEvent(event);

    const notifsAfterRetry = await service.getNotifications(mockBuyerId);
    assert.equal(notifsAfterRetry.length, 1, 'Notification phải được tạo thành công ở lần retry, không bị dedup nuốt chửng');
    assert.equal(notifsAfterRetry[0].type, 'ORDER');
    assert.equal(notifsAfterRetry[0].title, 'Đơn hàng hoàn tất');
  });

  it('Test 2 (Multi-worker/instance atomic tryClaim): 2 workers dùng chung 1 store -> chỉ 1 worker xử lý, 1 notification', async () => {
    // Worker 1 và Worker 2 cùng chia sẻ sharedIdempotencyStore và cùng ghi vào chung repo
    const worker1 = new NotificationService(repo, undefined, undefined, sharedIdempotencyStore);
    const worker2 = new NotificationService(repo, undefined, undefined, sharedIdempotencyStore);

    const event: TransactionDomainEvent = {
      eventId: 'cross-instance-event-002',
      type: 'ORDER_STATUS_CHANGED',
      orderId: testOrderId,
      buyerId: mockBuyerId,
      shopId: testShopId,
      oldStatus: 'SHIPPING',
      newStatus: 'COMPLETED',
      occurredAt: new Date().toISOString(),
    };

    // Chạy song song cả 2 workers cùng nhận một event
    await Promise.all([
      worker1.handleDomainEvent(event),
      worker2.handleDomainEvent(event),
    ]);

    const notifs = await repo.findByRecipientId(mockBuyerId);
    assert.equal(notifs.length, 1, 'Chỉ duy nhất 1 notification được tạo giữa 2 worker instances');
    assert.equal(repo.createCallCount, 1, 'Repo create chỉ được gọi đúng 1 lần');
  });

  it('Test 3 (Replay x3): Gửi cùng 1 event 3 lần liên tiếp -> đúng 1 notification được tạo', async () => {
    const event: TransactionDomainEvent = {
      eventId: 'replay-x3-event-003',
      type: 'ORDER_STATUS_CHANGED',
      orderId: testOrderId,
      buyerId: mockBuyerId,
      shopId: testShopId,
      oldStatus: 'SHIPPING',
      newStatus: 'COMPLETED',
      occurredAt: new Date().toISOString(),
    };

    await service.handleDomainEvent(event);
    await service.handleDomainEvent(event);
    await service.handleDomainEvent(event);

    const notifs = await service.getNotifications(mockBuyerId);
    assert.equal(notifs.length, 1, 'Chỉ tạo đúng 1 notification sau 3 lần replay');
    assert.equal(repo.createCallCount, 1);
  });
});
