import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { buildSuccessEnvelope } from '../envelope.ts';
import { requireRole } from '../middlewares/rbac.ts';
import { UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import type { RequestContext } from '../../context/request-context.ts';
import type { PgChatService } from '../../../modules/chat/services/pg-chat.service.ts';
import type { MessageType, ProductBotPermissions } from '../../../modules/chat/domain/types.ts';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function asyncRoute(fn: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

function guards(auth: RequestHandler | undefined, ...roles: ('BUYER' | 'SELLER' | 'ADMIN')[]): RequestHandler[] {
  return auth ? [auth, requireRole(...roles)] : [requireRole(...roles)];
}

function context(req: Request): RequestContext {
  if (!req.context) {
    throw new UnauthorizedError('AUTH_REQUIRED', 'Authentication required.');
  }
  return req.context;
}

export function createChatRouter(
  chatService: PgChatService | undefined,
  authMiddleware: RequestHandler | undefined
): Router {
  const router = Router();

  const ensureService = (): PgChatService => {
    if (!chatService) {
      throw new ValidationFailedError('Chat service is not configured');
    }
    return chatService;
  };

  // POST /chat/conversations - Tạo hoặc lấy hội thoại giữa Buyer và Shop
  router.post(
    '/chat/conversations',
    ...guards(authMiddleware, 'BUYER', 'SELLER', 'ADMIN'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const service = ensureService();
      const body = req.body as { shop_id?: string; product_id?: string };

      if (!body.shop_id) {
        throw new ValidationFailedError('shop_id is required');
      }

      const conversation = await service.getOrCreateConversation(
        ctx.user_id,
        body.shop_id,
        body.product_id
      );

      res.status(200).json(buildSuccessEnvelope(conversation, req.requestId ?? 'req-chat'));
    })
  );

  // GET /chat/conversations - Danh sách hội thoại của người dùng
  router.get(
    '/chat/conversations',
    ...guards(authMiddleware, 'BUYER', 'SELLER'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const service = ensureService();
      const role = ctx.role as 'BUYER' | 'SELLER';

      const conversations = await service.listConversations(ctx.user_id, role);
      res.status(200).json(buildSuccessEnvelope(conversations, req.requestId ?? 'req-chat'));
    })
  );

  // GET /chat/conversations/:id - Chi tiết cuộc hội thoại
  router.get(
    '/chat/conversations/:id',
    ...guards(authMiddleware, 'BUYER', 'SELLER', 'ADMIN'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const service = ensureService();

      const conversation = await service.getConversation(
        req.params.id,
        ctx.user_id,
        ctx.role as 'BUYER' | 'SELLER' | 'ADMIN'
      );

      res.status(200).json(buildSuccessEnvelope(conversation, req.requestId ?? 'req-chat'));
    })
  );

  // GET /chat/conversations/:id/messages - Danh sách tin nhắn trong hội thoại
  router.get(
    '/chat/conversations/:id/messages',
    ...guards(authMiddleware, 'BUYER', 'SELLER', 'ADMIN'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const service = ensureService();
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const beforeCursor = req.query.before_cursor ? String(req.query.before_cursor) : undefined;

      const messages = await service.listMessages(
        req.params.id,
        ctx.user_id,
        ctx.role as 'BUYER' | 'SELLER' | 'ADMIN',
        limit,
        beforeCursor
      );

      res.status(200).json(buildSuccessEnvelope(messages, req.requestId ?? 'req-chat'));
    })
  );

  // POST /chat/conversations/:id/messages - Gửi tin nhắn mới
  router.post(
    '/chat/conversations/:id/messages',
    ...guards(authMiddleware, 'BUYER', 'SELLER'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const service = ensureService();
      const body = req.body as {
        content?: string;
        client_message_id?: string;
        message_type?: MessageType;
        metadata?: Record<string, unknown>;
        product_id?: string;
      };

      if (!body.content || typeof body.content !== 'string') {
        throw new ValidationFailedError('content is required');
      }

      const result = await service.sendMessage({
        conversationId: req.params.id,
        senderId: ctx.user_id,
        senderRole: ctx.role as 'BUYER' | 'SELLER',
        content: body.content,
        clientMessageId: body.client_message_id,
        messageType: body.message_type,
        metadata: body.metadata,
        productId: body.product_id,
      });

      res.status(201).json(buildSuccessEnvelope(result, req.requestId ?? 'req-chat'));
    })
  );

  // POST /chat/conversations/:id/handoff - Chuyển giao sang hỗ trợ người thật (Live Seller)
  router.post(
    '/chat/conversations/:id/handoff',
    ...guards(authMiddleware, 'BUYER'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const service = ensureService();

      const result = await service.requestHumanHandoff(req.params.id, ctx.user_id);
      res.status(200).json(buildSuccessEnvelope(result, req.requestId ?? 'req-chat'));
    })
  );

  // PATCH /chat/conversations/:id/permissions - Cập nhật quyền của bot cho hội thoại
  router.patch(
    '/chat/conversations/:id/permissions',
    ...guards(authMiddleware, 'SELLER'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const service = ensureService();
      const body = req.body as Partial<ProductBotPermissions>;

      const permissions: ProductBotPermissions = {
        allow_stock: body.allow_stock !== false,
        allow_price: body.allow_price !== false,
        allow_variants: body.allow_variants !== false,
        allow_description: body.allow_description !== false,
      };

      const updated = await service.updateBotPermissions(req.params.id, ctx.user_id, permissions);
      res.status(200).json(buildSuccessEnvelope(updated, req.requestId ?? 'req-chat'));
    })
  );

  return router;
}
