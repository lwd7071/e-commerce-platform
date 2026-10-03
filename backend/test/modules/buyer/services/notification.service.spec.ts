import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationService } from '../../../../src/modules/buyer/services/notification.service';
import { ResourceNotFoundError } from '../../../../src/modules/buyer/domain/errors';
import type { INotificationRepository } from '../../../../src/modules/buyer/domain/repositories';
import type { ITransactionEventPort, TransactionDomainEvent } from '../../../../src/modules/buyer/ports/buyer-event.port';
import type { IOrderQueryPort, OrderSummaryDTO, ReviewOrderItemDTO } from '../../../../src/modules/buyer/ports/order-query.port';
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

class MockTransactionEventPort implements ITransactionEventPort {
  private handlers: ((event: TransactionDomainEvent) => Promise<void>)[] = [];

  subscribe(handler: (event: TransactionDomainEvent) => Promise<void>): void {
    this.handlers.push(handler);
  }

  async publish(event: TransactionDomainEvent): Promise<void> {
    for (const h of this.handlers) {
      await h(event);
    }
  }
}

class MockOrderQueryPortForNotif implements IOrderQueryPort {
  private summaries: Map<UUID, OrderSummaryDTO> = new Map();

  setSummary(orderId: UUID, summary: OrderSummaryDTO): void {
    this.summaries.set(orderId, summary);
  }

  async getOrderItemForReview(_: UUID, __: UUID): Promise<ReviewOrderItemDTO | null> {
    return null;
  }

  async getOrderSummary(orderId: UUID): Promise<OrderSummaryDTO | null> {
    return this.summaries.get(orderId) ?? null;
  }
}

describe('NotificationService Tests (TDD - Ownership, Idempotency & TransactionDomainEvent)', () => {
  let notificationRepo: MockNotificationRepository;
  let eventPort: MockTransactionEventPort;
  let orderQueryPort: MockOrderQueryPortForNotif;
  let notificationService: NotificationService;

  const otherBuyerId = '88888888-8888-4888-8888-888888888888';
  const notifId1 = '11111111-1111-4111-8111-111111111111';
  const testOrderId = 'oooo1111-1111-4111-8111-111111111111';
  const testShopId = 'ssss1111-1111-4111-8111-111111111111';

  beforeEach(() => {
    notificationRepo = new MockNotificationRepository();
    eventPort = new MockTransactionEventPort();
    orderQueryPort = new MockOrderQueryPortForNotif();
    notificationService = new NotificationService(notificationRepo, eventPort, orderQueryPort);

    // Mock order summary cho testOrderId
    orderQueryPort.setSummary(testOrderId, {
      orderId: testOrderId,
      buyerId: mockBuyerId,
      shopId: testShopId,
      status: 'CONFIRMED',
      subtotal: '200000.00',
      discountAmount: '0.00',
      shippingFee: '30000.00',
      totalAmount: '230000.00',
      createdAt: new Date().toISOString(),
    });
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

  describe('Domain Event Handling & In-Memory Deduplication (TransactionDomainEvent)', () => {
    it('[ORDER_STATUS_CHANGED -> COMPLETED] tạo Notification loại ORDER cho buyerId trong event', async () => {
      const event: TransactionDomainEvent = {
        eventId: 'eeee1111-1111-4111-8111-111111111111',
        type: 'ORDER_STATUS_CHANGED',
        orderId: testOrderId,
        buyerId: mockBuyerId,
        shopId: testShopId,
        oldStatus: 'SHIPPING',
        newStatus: 'COMPLETED',
        occurredAt: new Date().toISOString(),
      };

      await eventPort.publish(event);

      const list = await notificationService.getNotifications(mockBuyerId);
      assert.equal(list.length, 1);
      assert.equal(list[0].type, 'ORDER');
      assert.equal(list[0].title, 'Đơn hàng hoàn tất');
      assert.equal(list[0].isRead, false);
    });

    it('[ORDER_STATUS_CHANGED -> CONFIRMED] bỏ qua an toàn, không tạo notification', async () => {
      const event: TransactionDomainEvent = {
        eventId: 'eeee1111-2222-4111-8111-111111111111',
        type: 'ORDER_STATUS_CHANGED',
        orderId: testOrderId,
        buyerId: mockBuyerId,
        shopId: testShopId,
        oldStatus: 'PENDING_CONFIRMATION',
        newStatus: 'CONFIRMED',
        occurredAt: new Date().toISOString(),
      };

      await eventPort.publish(event);

      const list = await notificationService.getNotifications(mockBuyerId);
      assert.equal(list.length, 0);
    });

    it('[PAYMENT_STATUS_CHANGED -> SUCCESS] gọi getOrderSummary, tạo Notification loại PAYMENT cho buyerId', async () => {
      const event: TransactionDomainEvent = {
        eventId: 'eeee2222-1111-4111-8111-111111111111',
        type: 'PAYMENT_STATUS_CHANGED',
        paymentId: 'pppp1111-1111-4111-8111-111111111111',
        orderId: testOrderId,
        status: 'SUCCESS',
        amount: '230000.00',
        occurredAt: new Date().toISOString(),
      };

      await eventPort.publish(event);

      const list = await notificationService.getNotifications(mockBuyerId);
      assert.equal(list.length, 1);
      assert.equal(list[0].type, 'PAYMENT');
      assert.equal(list[0].title, 'Thanh toán thành công');
      assert.equal(list[0].isRead, false);
    });

    it('[PAYMENT_STATUS_CHANGED -> SUCCESS, order không tồn tại] bỏ qua an toàn, không throw', async () => {
      const event: TransactionDomainEvent = {
        eventId: 'eeee2222-9999-4111-8111-111111111111',
        type: 'PAYMENT_STATUS_CHANGED',
        paymentId: 'pppp9999-9999-4999-8999-999999999999',
        orderId: 'oooo9999-9999-4999-8999-999999999999', // Order không có summary
        status: 'SUCCESS',
        amount: '100000.00',
        occurredAt: new Date().toISOString(),
      };

      await eventPort.publish(event);

      const list = await notificationService.getNotifications(mockBuyerId);
      assert.equal(list.length, 0);
    });

    it('[PAYMENT_STATUS_CHANGED -> FAILED] bỏ qua an toàn, không tạo notification', async () => {
      const event: TransactionDomainEvent = {
        eventId: 'eeee2222-3333-4111-8111-111111111111',
        type: 'PAYMENT_STATUS_CHANGED',
        paymentId: 'pppp1111-1111-4111-8111-111111111111',
        orderId: testOrderId,
        status: 'FAILED',
        amount: '230000.00',
        occurredAt: new Date().toISOString(),
      };

      await eventPort.publish(event);

      const list = await notificationService.getNotifications(mockBuyerId);
      assert.equal(list.length, 0);
    });

    it('[SHIPMENT_STATUS_CHANGED -> DELIVERED] gọi getOrderSummary, tạo Notification loại SHIPPING cho buyerId', async () => {
      const event: TransactionDomainEvent = {
        eventId: 'eeee3333-1111-4111-8111-111111111111',
        type: 'SHIPMENT_STATUS_CHANGED',
        shipmentId: 'ssss1111-1111-4111-8111-111111111111',
        orderId: testOrderId,
        status: 'DELIVERED',
        occurredAt: new Date().toISOString(),
      };

      await eventPort.publish(event);

      const list = await notificationService.getNotifications(mockBuyerId);
      assert.equal(list.length, 1);
      assert.equal(list[0].type, 'SHIPPING');
      assert.equal(list[0].title, 'Đã giao hàng thành công');
      assert.equal(list[0].isRead, false);
    });

    it('[SHIPMENT_STATUS_CHANGED -> DELIVERED, order không tồn tại] bỏ qua an toàn, không throw', async () => {
      const event: TransactionDomainEvent = {
        eventId: 'eeee3333-9999-4111-8111-111111111111',
        type: 'SHIPMENT_STATUS_CHANGED',
        shipmentId: 'ssss9999-9999-4999-8999-999999999999',
        orderId: 'oooo9999-9999-4999-8999-999999999999', // Order không có summary
        status: 'DELIVERED',
        occurredAt: new Date().toISOString(),
      };

      await eventPort.publish(event);

      const list = await notificationService.getNotifications(mockBuyerId);
      assert.equal(list.length, 0);
    });

    it('[SHIPMENT_STATUS_CHANGED -> SHIPPING] bỏ qua an toàn, không tạo notification', async () => {
      const event: TransactionDomainEvent = {
        eventId: 'eeee3333-2222-4111-8111-111111111111',
        type: 'SHIPMENT_STATUS_CHANGED',
        shipmentId: 'ssss1111-1111-4111-8111-111111111111',
        orderId: testOrderId,
        status: 'SHIPPING',
        occurredAt: new Date().toISOString(),
      };

      await eventPort.publish(event);

      const list = await notificationService.getNotifications(mockBuyerId);
      assert.equal(list.length, 0);
    });

    it('[Idempotency Replay] cùng eventId gửi 2 lần -> chỉ tạo 1 notification duy nhất', async () => {
      const event: TransactionDomainEvent = {
        eventId: 'eeee4444-4444-4444-8444-444444444444',
        type: 'ORDER_STATUS_CHANGED',
        orderId: testOrderId,
        buyerId: mockBuyerId,
        shopId: testShopId,
        oldStatus: 'SHIPPING',
        newStatus: 'COMPLETED',
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

  describe('Notification Event Idempotency & Concurrency Hardening (T3 Phase 2)', () => {
    it('Tự động wire PostgresEventIdempotencyStore khi repository có db property', async () => {
      let queryCalled = false;
      const mockDb = {
        async query<T = Record<string, unknown>>(_sql: string, _params?: unknown[]) {
          queryCalled = true;
          return { rows: [] as T[], rowCount: 0 };
        },
      };

      const repoWithDb: INotificationRepository & { db: typeof mockDb } = {
        db: mockDb,
        async findById() { return null; },
        async findByRecipientId() { return []; },
        async create(n: Notification) { return n; },
        async createForEvent(n: Notification) { return n; },
        async markAsRead(_id: UUID) { throw new Error('Not implemented'); },
      };

      const service = new NotificationService(repoWithDb);
      const event: TransactionDomainEvent = {
        eventId: 'evt-auto-wire-1',
        type: 'ORDER_STATUS_CHANGED',
        orderId: '00000000-0000-0000-0000-000000000001',
        buyerId: mockBuyerId,
        shopId: '00000000-0000-0000-0000-000000000002',
        oldStatus: 'SHIPPING',
        newStatus: 'COMPLETED',
        occurredAt: new Date().toISOString(),
      };

      await service.handleDomainEvent(event);
      assert.equal(queryCalled, true, 'Store phải tự động query qua mockDb của repository');
    });

    it('Đồng thời thực sự (Concurrent Race Test với Promise.all): chỉ 1 service insert thành công, service thua nhận null và không trigger side-effect', async () => {
      // Mock Atomic Repository mô phỏng hành vi PostgreSQL ON CONFLICT (event_id) DO NOTHING
      const committedEvents = new Set<string>();
      const createdNotifications: Notification[] = [];
      let sideEffectCallCount = 0;

      const onNotificationCreatedSideEffect = () => {
        sideEffectCallCount++;
      };

      class MockAtomicDbNotificationRepository implements INotificationRepository {
        async findById() { return null; }
        async findByRecipientId() { return createdNotifications; }
        async create(n: Notification) { return n; }
        async markAsRead(_id: UUID, _readAt?: string): Promise<Notification> { throw new Error('Not implemented'); }

        async createForEvent(notification: Notification, eventId: string): Promise<Notification | null> {
          // Atomic simulate: nếu đã có eventId thì conflict -> return null
          if (committedEvents.has(eventId)) {
            return null;
          }
          committedEvents.add(eventId);
          createdNotifications.push(notification);
          onNotificationCreatedSideEffect();
          return notification;
        }
      }

      const repo1 = new MockAtomicDbNotificationRepository();
      const repo2 = new MockAtomicDbNotificationRepository();

      // 2 service độc lập, mỗi service có store riêng
      const service1 = new NotificationService(repo1);
      const service2 = new NotificationService(repo2);

      const event: TransactionDomainEvent = {
        eventId: 'evt-concurrent-race-1',
        type: 'ORDER_STATUS_CHANGED',
        orderId: '00000000-0000-0000-0000-000000000001',
        buyerId: mockBuyerId,
        shopId: '00000000-0000-0000-0000-000000000002',
        oldStatus: 'SHIPPING',
        newStatus: 'COMPLETED',
        occurredAt: new Date().toISOString(),
      };

      // Chạy đồng thời cả 2 service
      await Promise.all([
        service1.handleDomainEvent(event),
        service2.handleDomainEvent(event),
      ]);

      // Assertions
      assert.equal(createdNotifications.length, 1, 'Chỉ được lưu duy nhất 1 notification');
      assert.equal(committedEvents.size, 1);
      assert.equal(sideEffectCallCount, 1, 'Side-effect chỉ được kích hoạt đúng 1 lần cho winner');
    });
  });
});
