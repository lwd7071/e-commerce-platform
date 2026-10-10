import { expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import type { LoyaltyService } from '../../src/modules/loyalty/services/loyalty.service.ts';

it.each(['BUYER', 'SELLER', 'ADMIN', 'ANONYMOUS'] as const)('loyalty routes enforce role %s and use auth context', async role => {
  const redeem = vi.fn().mockResolvedValue({ voucher_id: 'v', code: 'test', end_at: '2026-11-11' });
  const listRewards = vi.fn().mockResolvedValue([]);
  const recordConfirmedRefund = vi.fn().mockResolvedValue({ points_delta: -1, inserted: true });
  const service = { redeem, listRewards, recordConfirmedRefund } as unknown as LoyaltyService;
  const app = createApp({ rateLimiter: false, buyerServices: { loyaltyService: service }, auth: (req, _res, next) => {
    if (role !== 'ANONYMOUS') req.context = { user_id: 'auth-user', role, request_id: 'test' };
    next();
  } });
  await request(app).post('/api/v1/buyer/loyalty/redeem').send({ idempotency_key: 'key', user_id: 'impersonated-user' })
    .expect(role === 'BUYER' ? 201 : role === 'ANONYMOUS' ? 401 : 403);
  await request(app).get('/api/v1/buyer/loyalty/rewards').expect(role === 'BUYER' ? 200 : role === 'ANONYMOUS' ? 401 : 403);
  if (role === 'BUYER') expect(redeem).toHaveBeenCalledWith('auth-user', 'key');
  else expect(redeem).not.toHaveBeenCalled();
  await request(app).post('/api/v1/admin/orders/11111111-1111-4111-8111-111111111111/loyalty-refunds')
    .send({ eligible_amount: '1.00', reference: 'refund-test', reason: 'test evidence' })
    .expect(role === 'ADMIN' ? 200 : role === 'ANONYMOUS' ? 401 : 403);
  if (role === 'ADMIN') expect(recordConfirmedRefund).toHaveBeenCalledWith('auth-user', '11111111-1111-4111-8111-111111111111', expect.any(Object));
  else expect(recordConfirmedRefund).not.toHaveBeenCalled();
});
