import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { createApp, createRuntimeApp } from '../../src/platform/http/app.ts';
import { StubTokenVerifier } from '../../src/platform/http/middlewares/auth.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { ReviewService } from '../../src/modules/buyer/services/review.service.ts';
import { NotificationService } from '../../src/modules/buyer/services/notification.service.ts';
import { InMemoryTransactionEventPort } from '../../src/modules/buyer/ports/buyer-event.port.ts';
import type { IReviewRepository, INotificationRepository } from '../../src/modules/buyer/domain/repositories.ts';
import type { IOrderQueryPort } from '../../src/modules/buyer/ports/order-query.port.ts';
import type { Review, Notification } from '../../src/modules/buyer/domain/types.ts';
import type { TransactionDomainEvent } from '../../src/modules/order/contracts/order-events.contract.ts';

const BUYER_ID = '11111111-1111-4111-8111-111111111111';

const buyerAuth: RequestHandler = (req, _res, next) => {
  req.context = createRequestContext({
    request_id: req.requestId ?? 'req_test',
    user_id: BUYER_ID,
    role: 'BUYER',
  });
  next();
};

class MockReviewRepo implements IReviewRepository {
  public reviews: Review[] = [];

  async findById(id: string): Promise<Review | null> {
    return this.reviews.find(r => r.reviewId === id) ?? null;
  }

  async findByOrderItemId(id: string): Promise<Review | null> {
    return this.reviews.find(r => r.orderItemId === id) ?? null;
  }

  async findByProductId(id: string): Promise<Review[]> {
    return this.reviews.filter(r => r.productId === id);
  }

  async create(review: Review): Promise<Review> {
    this.reviews.push(review);
    return review;
  }
}

class MockNotificationRepo implements INotificationRepository {
  public notifications: Notification[] = [];

  async findById(id: string): Promise<Notification | null> {
    return this.notifications.find(n => n.notificationId === id) ?? null;
  }

  async findByRecipientId(recipientId: string, isRead?: boolean): Promise<Notification[]> {
    return this.notifications.filter(n => n.recipientId === recipientId && (isRead === undefined || n.isRead === isRead));
  }

  async create(notification: Notification): Promise<Notification> {
    this.notifications.push(notification);
    return notification;
  }

  async createForEvent(notification: Notification): Promise<Notification | null> {
    this.notifications.push(notification);
    return notification;
  }

  async markAsRead(id: string, readAt: string): Promise<Notification> {
    const notif = this.notifications.find(n => n.notificationId === id);
    if (!notif) throw new Error('Not found');
    notif.isRead = true;
    notif.readAt = readAt;
    return notif;
  }
}

class MockOrderQueryPort implements IOrderQueryPort {
  async getOrderItemForReview() {
    return null;
  }
  async getOrderSummary() {
    return null;
  }
}

describe('Review and Notification Runtime Wiring (C-201, C-202, C-203, C-301, C-302)', () => {
  it('GET /api/v1/notifications: returns 200 and notifications array (eliminates 501)', async () => {
    const notifRepo = new MockNotificationRepo();
    notifRepo.notifications.push({
      notificationId: 'notif-test-1',
      recipientId: BUYER_ID,
      type: 'SYSTEM',
      title: 'Chào mừng bạn',
      content: 'Chào mừng bạn đến với Dino',
      isRead: false,
      createdAt: new Date().toISOString(),
      readAt: null,
    });

    const notifService = new NotificationService(notifRepo);
    const app = createApp({
      auth: buyerAuth,
      buyerServices: { notificationService: notifService },
    });

    const res = await request(app).get('/api/v1/notifications').expect(200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].notificationId, 'notif-test-1');
  });

  it('PATCH /api/v1/notifications/:id/read: marks notification as read (eliminates 501)', async () => {
    const notifRepo = new MockNotificationRepo();
    notifRepo.notifications.push({
      notificationId: 'notif-test-2',
      recipientId: BUYER_ID,
      type: 'ORDER',
      title: 'Đơn hàng mới',
      content: 'Đơn hàng đang chuẩn bị',
      isRead: false,
      createdAt: new Date().toISOString(),
      readAt: null,
    });

    const notifService = new NotificationService(notifRepo);
    const app = createApp({
      auth: buyerAuth,
      buyerServices: { notificationService: notifService },
    });

    const res = await request(app).patch('/api/v1/notifications/notif-test-2/read').expect(200);
    assert.strictEqual(res.body.data.isRead, true);
    assert.ok(res.body.data.readAt);
  });

  it('EventBus contract: mock publishing an order event delivers notification to buyer', async () => {
    const eventPort = new InMemoryTransactionEventPort();
    const notifRepo = new MockNotificationRepo();
    const notifService = new NotificationService(notifRepo, eventPort, new MockOrderQueryPort());

    const app = createApp({
      auth: buyerAuth,
      buyerServices: { notificationService: notifService },
    });

    // Mock publish an event from Order/Transaction core
    const domainEvent: TransactionDomainEvent = {
      eventId: 'evt-order-completed-1',
      type: 'ORDER_STATUS_CHANGED',
      orderId: 'ord-123',
      buyerId: BUYER_ID,
      shopId: '00000000-0000-4000-8000-000000000001',
      oldStatus: 'SHIPPING',
      newStatus: 'COMPLETED',
      occurredAt: new Date().toISOString(),
    };

    await eventPort.publish(domainEvent);

    const res = await request(app).get('/api/v1/notifications').expect(200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].type, 'ORDER');
    assert.ok(res.body.data[0].title.includes('hoàn tất'));
  });

  it('POST /api/v1/order-items/:id/review: handles domain check and returns 422 instead of 501', async () => {
    const reviewRepo = new MockReviewRepo();
    const reviewService = new ReviewService(reviewRepo, new MockOrderQueryPort());

    const app = createApp({
      auth: buyerAuth,
      buyerServices: { reviewService },
    });

    const res = await request(app)
      .post('/api/v1/order-items/oi-not-eligible/review')
      .send({
        product_id: 'prod-1',
        rating: 5,
        content: 'Tuyệt vời',
      })
      .expect(422);

    assert.strictEqual(res.body.error.code, 'REVIEW_NOT_ELIGIBLE');
  });

  it('GET /api/v1/products/:product_id/reviews: returns public reviews and rating summary', async () => {
    const reviewRepo = new MockReviewRepo();
    reviewRepo.reviews.push({
      reviewId: 'rev-1',
      buyerId: BUYER_ID,
      productId: 'prod-test-1',
      orderItemId: 'oi-1',
      rating: 4,
      content: 'Chất lượng vải tốt',
      status: 'VISIBLE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    reviewRepo.reviews.push({
      reviewId: 'rev-2',
      buyerId: BUYER_ID,
      productId: 'prod-test-1',
      orderItemId: 'oi-2',
      rating: 5,
      content: 'Giao hàng nhanh',
      status: 'VISIBLE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const reviewService = new ReviewService(reviewRepo, new MockOrderQueryPort());
    const app = createApp({
      buyerServices: { reviewService },
    });

    const res = await request(app)
      .get('/api/v1/products/prod-test-1/reviews')
      .expect(200);

    assert.strictEqual(res.body.data.length, 2);
    assert.strictEqual(res.body.rating_summary.count, 2);
    assert.strictEqual(res.body.rating_summary.average, '4.5');
  });

  it('createRuntimeApp wires singleton eventPort and returns valid runtime', async () => {
    const mockPool = {
      query: async () => ({ rows: [], rowCount: 0 }),
    } as unknown as Pool;

    const testEnv: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: 'postgresql://postgres.proj123:secret@localhost:5432/postgres',
      DIRECT_URL: 'postgresql://postgres.proj123:secret@localhost:5432/postgres',
      SUPABASE_URL: 'https://proj123.supabase.co',
      SUPABASE_JWKS_URL: 'https://proj123.supabase.co/auth/v1/.well-known/jwks.json',
      SUPABASE_JWT_SECRET: 'test-secret',
    };

    const runtime = createRuntimeApp(testEnv, {
      pool: mockPool,
      tokenVerifier: new StubTokenVerifier(),
    });

    assert.ok(runtime.app);
    assert.ok(runtime.eventPort);
    assert.strictEqual(typeof runtime.close, 'function');
  });
});
