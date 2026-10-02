import { Router, type Request, type Response } from 'express';
import type { FlashSaleService } from '../services/flash-sale.service.ts';
import type { PgFlashSaleRepository } from '../repositories/pg-flash-sale.repository.ts';
import { getRedisClient } from '../infrastructure/redis.client.ts';

export function createFlashSaleRouter(service: FlashSaleService, repo: PgFlashSaleRepository): Router {
  const router = Router();
  const redis = getRedisClient();

  // 1. Lấy danh sách khung giờ Flash Sale
  router.get('/slots', async (_req: Request, res: Response) => {
    try {
      const sessions = await repo.listActiveSessions();
      res.json({ data: sessions });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 2. Lấy danh sách sản phẩm trong khung giờ kèm tồn kho tức thì từ Redis
  router.get('/slots/:slotId/items', async (req: Request, res: Response) => {
    try {
      const { slotId } = req.params;
      const items = await repo.listItemsBySlotId(slotId);

      // Đọc song song tồn kho từ Redis
      const itemsWithStock = await Promise.all(
        items.map(async (item) => {
          const redisStock = await redis.get(`flash_sale:stock:${slotId}:${item.item_id}`);
          return {
            ...item,
            available_stock: redisStock !== null ? Number(redisStock) : item.allocated_stock,
          };
        })
      );

      res.json({ data: itemsWithStock });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 3. Admin / System kích hoạt Warm-up tồn kho lên Redis
  router.post('/slots/:slotId/warm-up', async (req: Request, res: Response) => {
    try {
      const { slotId } = req.params;
      const result = await service.warmUpSlot(slotId);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 4. Mua hàng Flash Sale tốc độ cao (Fast-path Checkout)
  router.post('/items/:itemId/purchase', async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const idempKey = (req.header('Idempotency-Key') || req.body.idempotency_key || '').trim();

      if (!idempKey || idempKey.length < 8) {
        return res.status(400).json({
          error: 'MISSING_IDEMPOTENCY_KEY',
          message: 'Yêu cầu đặt mua Flash Sale bắt buộc có Idempotency-Key hợp lệ.',
        });
      }

      const item = await repo.findItemById(itemId);
      if (!item) {
        return res.status(404).json({ error: 'ITEM_NOT_FOUND', message: 'Sản phẩm Flash Sale không tồn tại.' });
      }

      // ponytail: Lấy user_id từ auth request context hoặc fallback body/anonymous
      const authUser = (req as unknown as { user?: { user_id?: string } }).user;
      const userId = authUser?.user_id || req.body.user_id || '00000000-0000-0000-0000-000000000001';

      const result = await service.purchase({
        idempotency_key: idempKey,
        user_id: userId,
        slot_id: item.slot_id,
        item_id: item.item_id,
        voucher_code: req.body.voucher_code,
        recipient_name: req.body.recipient_name || 'Khách Mua Flash Sale',
        recipient_phone: req.body.recipient_phone || '0901234567',
        province: req.body.province || 'Hồ Chí Minh',
        district: req.body.district || 'Quận 1',
        ward: req.body.ward || 'Bến Nghé',
        delivery_address: req.body.delivery_address || 'Số 1 Lê Duẩn',
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (err: unknown) {
      console.error('[FlashSale Route Error]', err);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: (err as Error).message });
    }
  });

  // 5. Đối soát số liệu Redis và Database (Reconciliation)
  router.get('/slots/:slotId/reconcile', async (req: Request, res: Response) => {
    try {
      const { slotId } = req.params;
      const report = await service.reconcileSlot(slotId);
      res.json({ data: report });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 6. Endpoint trigger Watchdog thủ công hoặc từ Cron
  router.post('/watchdog/sweep', async (_req: Request, res: Response) => {
    try {
      const result = await service.runWatchdogSweep();
      res.json({ data: result });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
