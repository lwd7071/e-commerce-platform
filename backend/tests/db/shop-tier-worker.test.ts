import { afterEach, expect, it, vi } from 'vitest';
import { startShopTierWorker } from '../../src/modules/shop/services/shop-tier-worker.ts';
import { ShopTierEvaluationService } from '../../src/modules/shop/services/shop-tier-evaluation.service.ts';
import type { Pool } from 'pg';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('shutdown waits for the current sweep before returning', async () => {
  let finish!: () => void;
  const evaluateScheduled = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const stop = startShopTierWorker({ evaluateScheduled } as unknown as ShopTierEvaluationService);
  let done = false;
  const shutdown = stop().then(() => { done = true; });
  await Promise.resolve();
  expect(done).toBe(false);
  finish();
  await shutdown;
  expect(done).toBe(true);
});

it('rejects invalid custom criteria without querying the database', async () => {
  const query = vi.fn();
  const service = new ShopTierEvaluationService({ query } as unknown as Pool);
  for (const criteria of [{ minCompletedOrders: -1 }, { minAverageRating: 6 }, { minAverageRating: NaN }, { minVisibleReviews: 1.5 }]) {
    await expect(service.evaluateAllActiveShops(criteria)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  }
  expect(query).not.toHaveBeenCalled();
});

it('runs at startup and periodically without overlapping; stops cleanly', async () => {
  vi.useFakeTimers();
  let finish!: () => void;
  const evaluateScheduled = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; })).mockResolvedValue(null);
  const stop = startShopTierWorker({ evaluateScheduled } as unknown as ShopTierEvaluationService, 1_000);
  expect(evaluateScheduled).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(3_000);
  expect(evaluateScheduled).toHaveBeenCalledTimes(1);
  finish();
  await vi.advanceTimersByTimeAsync(1_000);
  expect(evaluateScheduled).toHaveBeenCalledTimes(2);
  await stop();
  await vi.advanceTimersByTimeAsync(5_000);
  expect(evaluateScheduled).toHaveBeenCalledTimes(2);
});

it('retries after a failed tick without leaking the error', async () => {
  vi.useFakeTimers();
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const evaluateScheduled = vi.fn().mockRejectedValueOnce(new Error('private database details')).mockResolvedValue(null);
  const stop = startShopTierWorker({ evaluateScheduled } as unknown as ShopTierEvaluationService, 1_000);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(evaluateScheduled).toHaveBeenCalledTimes(2);
  expect(log).toHaveBeenCalledWith('[Shop tiers] Scheduled evaluation failed; retry on the next interval.');
  await stop();
});

it.each([0, -1, NaN, 1.5, 2_147_483_648])('rejects invalid interval %s', value => {
  expect(() => startShopTierWorker({} as ShopTierEvaluationService, value)).toThrow('SHOP_TIER_INTERVAL_MS');
});
