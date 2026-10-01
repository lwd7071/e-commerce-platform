import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryOrderRepository } from '../../../../src/modules/order/repositories/in-memory-order.repository.ts';
import { OrderLifecycleService } from '../../../../src/modules/order/services/order-lifecycle.service.ts';
import { OrderDomainError } from '../../../../src/modules/order/domain/errors.ts';
import type { OrderRecord } from '../../../../src/modules/order/domain/repositories.ts';
import { ModerationService } from '../../../../src/modules/moderation/services/moderation.service.ts';
import type { ITargetLookupRepository, IAuditPort, ITransactionManager, UserStatus, ModerationRecord } from '../../../../src/modules/moderation/domain/moderation.types.ts';
import { AdminTargetProtectedError, ReasonRequiredError } from '../../../../src/platform/errors/app-error.ts';

class InMemoryModerationRepository implements ITargetLookupRepository {
  public users = new Map<string, { id: string; role: 'BUYER' | 'SELLER' | 'ADMIN'; status: UserStatus }>();
  public shops = new Map<string, { id: string; status: 'PENDING' | 'ACTIVE' | 'LOCKED' }>();
  public records: ModerationRecord[] = [];

  async userExists(userId: string): Promise<boolean> {
    return this.users.has(userId);
  }
  async getUserStatus(userId: string): Promise<UserStatus | null> {
    return this.users.get(userId)?.status ?? null;
  }
  async getUserRole(userId: string): Promise<'BUYER' | 'SELLER' | 'ADMIN' | null> {
    return this.users.get(userId)?.role ?? null;
  }
  async updateUserStatus(_trx: unknown, userId: string, status: UserStatus): Promise<{ user_id: string; status: UserStatus; updated_at: string }> {
    const u = this.users.get(userId);
    if (!u) throw new Error('Not found');
    u.status = status;
    return { user_id: u.id, status: u.status, updated_at: new Date().toISOString() };
  }
  async shopExists(shopId: string): Promise<boolean> {
    return this.shops.has(shopId);
  }
  async getShopStatus(shopId: string): Promise<'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | null> {
    return this.shops.get(shopId)?.status ?? null;
  }
  async updateShopStatus(_trx: unknown, shopId: string, status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED') {
    const s = this.shops.get(shopId);
    if (!s) throw new Error('Not found');
    s.status = status as 'PENDING' | 'ACTIVE' | 'LOCKED';
    return { shop_id: s.id, status: s.status, updated_at: new Date().toISOString() };
  }
  async productExists(): Promise<boolean> { return true; }
  async reviewExists(): Promise<boolean> { return true; }
  async insertModerationRecord(_trx: unknown, record: ModerationRecord): Promise<void> {
    this.records.push(record);
  }
}

describe('/diagnose Person 5 - Admin Business Rules & Order Intervention', () => {
  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const buyerId = '22222222-2222-4222-8222-222222222222';
  const shopId = '33333333-3333-4333-8333-333333333333';
  const orderId = '44444444-4444-4444-8444-444444444444';

  const adminActor = { kind: 'ADMIN' as const, userId: adminUserId };

  function createSampleOrder(status: OrderRecord['status']): OrderRecord {
    return {
      orderId,
      buyerId,
      shopId,
      subtotal: '200000.00',
      discountAmount: '0.00',
      shippingFee: '30000.00',
      totalAmount: '230000.00',
      status,
      recipientName: 'Nguyen Van B',
      recipientPhone: '0987654321',
      province: 'TP. Ho Chi Minh',
      district: 'Quan 1',
      ward: 'Ben Nghe',
      deliveryAddress: '456 Le Duan',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  it('TC-ADM-CMD-01: Admin can thiệp hủy đơn hàng bắt buộc phải có reason (QD11, QD17, QD20)', async () => {
    const orderRepo = new InMemoryOrderRepository();
    const lifecycle = new OrderLifecycleService({ orderRepo });
    const order = createSampleOrder('PENDING_CONFIRMATION');
    await orderRepo.createOrder(order, [], {
      historyId: 'h-1',
      orderId,
      oldStatus: null,
      newStatus: 'PENDING_CONFIRMATION',
      changedBy: buyerId,
      changedAt: new Date().toISOString(),
    });

    // 1. Thử hủy không truyền reason hoặc reason chỉ chứa khoảng trắng -> Bị từ chối
    await assert.rejects(
      async () => lifecycle.cancelOrder(orderId, adminActor, '   '),
      (err: unknown) => err instanceof OrderDomainError && err.code === 'REASON_REQUIRED'
    );

    // 2. Hủy với lý do hợp lệ -> Thành công
    await lifecycle.cancelOrder(orderId, adminActor, 'Phát hiện gian lận thanh toán, hủy theo yêu cầu an ninh');

    // 3. Kiểm tra history và cancel_reason đã lưu
    const saved = await orderRepo.findById(orderId);
    assert.strictEqual(saved?.status, 'CANCELLED');
    assert.strictEqual(saved?.cancelReason, 'Phát hiện gian lận thanh toán, hủy theo yêu cầu an ninh');
  });

  it('TC-ADM-CMD-02: Admin can thiệp chuyển trạng thái bắt buộc phải có reason và tuân thủ state machine', async () => {
    const orderRepo = new InMemoryOrderRepository();
    const lifecycle = new OrderLifecycleService({ orderRepo });
    const order = createSampleOrder('PENDING_CONFIRMATION');
    await orderRepo.createOrder(order, [], {
      historyId: 'h-2',
      orderId,
      oldStatus: null,
      newStatus: 'PENDING_CONFIRMATION',
      changedBy: buyerId,
      changedAt: new Date().toISOString(),
    });

    // 1. Admin transition không có reason -> Bị từ chối REASON_REQUIRED
    await assert.rejects(
      async () => lifecycle.transitionOrder(orderId, adminActor, { to: 'CONFIRMED' }),
      (err: unknown) => err instanceof OrderDomainError && err.code === 'REASON_REQUIRED'
    );

    // 2. Admin transition nhảy cóc từ PENDING_CONFIRMATION sang COMPLETED -> Bị từ chối ORDER_INVALID_TRANSITION
    await assert.rejects(
      async () => lifecycle.transitionOrder(orderId, adminActor, {
        to: 'COMPLETED',
        reason: 'Admin force complete',
        shipmentStatus: 'DELIVERED',
      }),
      (err: unknown) => err instanceof OrderDomainError && err.code === 'ORDER_INVALID_TRANSITION'
    );

    // 3. Admin chuyển sang CONFIRMED có reason -> Thành công
    const confirmRes = await lifecycle.transitionOrder(orderId, adminActor, {
      to: 'CONFIRMED',
      reason: 'Admin can thiệp xác nhận theo yêu cầu người bán',
    });
    assert.strictEqual(confirmRes.status, 'CONFIRMED');
  });

  it('TC-ADM-CMD-03: Admin chuyển đơn SHIPPING sang COMPLETED phải có shipmentStatus DELIVERED (QD11)', async () => {
    const orderRepo = new InMemoryOrderRepository();
    const lifecycle = new OrderLifecycleService({ orderRepo });
    const order = createSampleOrder('SHIPPING');
    await orderRepo.createOrder(order, [], {
      historyId: 'h-3',
      orderId,
      oldStatus: 'PREPARING',
      newStatus: 'SHIPPING',
      changedBy: adminUserId,
      changedAt: new Date().toISOString(),
    });

    // Thiếu shipmentStatus: 'DELIVERED' -> Bị từ chối
    await assert.rejects(
      async () => lifecycle.transitionOrder(orderId, adminActor, {
        to: 'COMPLETED',
        reason: 'Admin xác nhận giao hàng thành công',
      }),
      (err: unknown) => err instanceof OrderDomainError && err.code === 'ORDER_INVALID_TRANSITION'
    );

    // Có shipmentStatus: 'DELIVERED' và reason -> Thành công
    const res = await lifecycle.transitionOrder(orderId, adminActor, {
      to: 'COMPLETED',
      reason: 'Admin xác nhận giao hàng thành công theo biên bản bàn giao đơn vị vận chuyển',
      shipmentStatus: 'DELIVERED',
    });
    assert.strictEqual(res.status, 'COMPLETED');
  });

  it('TC-ADM-MOD-04: Admin không thể moderate/khóa tài khoản của Admin khác (RBAC Guard)', async () => {
    const targetAdminId = '99999999-9999-4999-8999-999999999999';
    const repo = new InMemoryModerationRepository();
    repo.users.set(targetAdminId, { id: targetAdminId, role: 'ADMIN', status: 'ACTIVE' });

    const fakeAudit: IAuditPort = { async logAdminAction() {} };
    const fakeTx: ITransactionManager = { async withTransaction(fn) { return fn({}); } };
    const moderation = new ModerationService(repo, fakeAudit, fakeTx);

    await assert.rejects(
      async () => moderation.lockUser(adminUserId, targetAdminId, 'Thử khóa tài khoản admin'),
      (err: unknown) => err instanceof AdminTargetProtectedError
    );
  });
});
