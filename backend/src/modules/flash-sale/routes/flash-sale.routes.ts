import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import type { FlashSaleService } from '../services/flash-sale.service.ts';
import type { PgFlashSaleRepository } from '../repositories/pg-flash-sale.repository.ts';
import { getRedisClient } from '../infrastructure/redis.client.ts';
import { requireRole } from '../../../platform/http/middlewares/rbac.ts';
import { UnauthorizedError } from '../../../platform/errors/app-error.ts';

export function createFlashSaleRouter(
  service: FlashSaleService,
  repo: PgFlashSaleRepository,
  auth?: RequestHandler,
  redisClient?: any
): Router {
  const router = Router();
  const redis = redisClient || getRedisClient();
  const authMiddleware = auth ?? ((_req: Request, _res: Response, next: NextFunction) => next());

  // 1. Lấy danh sách khung giờ Flash Sale (Công khai)
  router.get('/slots', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const sessions = await repo.listActiveSessions();
      res.json({ data: sessions });
    } catch (err: unknown) {
      next(err);
    }
  });

  // 2. Lấy danh sách sản phẩm trong khung giờ kèm tồn kho tức thì từ Redis (Công khai)
  router.get('/slots/:slotId/items', async (req: Request, res: Response, next: NextFunction) => {
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
      next(err);
    }
  });

  // 3. Admin / System kích hoạt Warm-up tồn kho lên Redis (Role: ADMIN)
  router.post(
    '/slots/:slotId/warm-up',
    authMiddleware,
    requireRole('ADMIN'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { slotId } = req.params;
        const result = await service.warmUpSlot(slotId);
        if (!result.success) {
          return res.status(400).json(result);
        }
        res.json(result);
      } catch (err: unknown) {
        next(err);
      }
    }
  );

  // 4. Mua hàng Flash Sale tốc độ cao (Fast-path Checkout) - Yêu cầu xác thực JWT context
  router.post('/items/:itemId/purchase', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
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

      // Nguồn định danh duy nhất: req.context.user_id từ JWT đã xác minh
      const userId = req.context?.user_id;
      if (!userId) {
        throw new UnauthorizedError('AUTH_REQUIRED', 'Yêu cầu đăng nhập để mua Flash Sale.');
      }

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
      next(err);
    }
  });

  // 5a. Xem báo cáo đối soát số liệu Redis và Database (Role: ADMIN)
  router.get(
    '/slots/:slotId/reconcile',
    authMiddleware,
    requireRole('ADMIN'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { slotId } = req.params;
        const report = await service.reconcileSlot(slotId);
        res.json({ data: report });
      } catch (err: unknown) {
        next(err);
      }
    }
  );

  // 5b. Kích hoạt đối soát & tự cân bằng số liệu (Role: ADMIN, với per-slot lock)
  router.post(
    '/slots/:slotId/reconcile',
    authMiddleware,
    requireRole('ADMIN'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { slotId } = req.params;
        const { autoBalance } = req.body || {};
        const operatorUserId = req.context?.user_id;

        const lockKey = `flash_sale:reconcile_lock:${slotId}`;
        const acquired = await redis.set(lockKey, '1', 'EX', 30, 'NX');
        if (!acquired) {
          return res.status(409).json({
            code: 'RECONCILIATION_IN_PROGRESS',
            message: 'Đang có tiến trình đối soát trên khung giờ này.',
          });
        }

        try {
          const report = await service.reconcileSlot(slotId, {
            autoBalance: Boolean(autoBalance),
            operatorUserId,
          });
          res.json({ data: report });
        } finally {
          await redis.del(lockKey);
        }
      } catch (err: unknown) {
        next(err);
      }
    }
  );

  // 6. Endpoint trigger Watchdog thủ công (Role: ADMIN)
  router.post(
    '/watchdog/sweep',
    authMiddleware,
    requireRole('ADMIN'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.runWatchdogSweep();
        res.json({ data: result });
      } catch (err: unknown) {
        next(err);
      }
    }
  );

  return router;
}
