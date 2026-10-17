import type { ShopTierEvaluationService } from './shop-tier-evaluation.service.ts';

export function startShopTierWorker(service: ShopTierEvaluationService, intervalMs = 86_400_000) {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1_000 || intervalMs > 2_147_483_647) {
    throw new Error('SHOP_TIER_INTERVAL_MS must be an integer between 1000 and 2147483647');
  }
  let running: Promise<void> | undefined;
  let stopped = false;
  const tick = () => {
    if (running || stopped) return;
    running = (async () => {
      try { await service.evaluateScheduled(); }
      catch { console.error('[Shop tiers] Scheduled evaluation failed; retry on the next interval.'); }
    })().finally(() => { running = undefined; });
  };
  const timer = setInterval(() => { void tick(); }, intervalMs);
  timer.unref();
  void tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await running;
  };
}
