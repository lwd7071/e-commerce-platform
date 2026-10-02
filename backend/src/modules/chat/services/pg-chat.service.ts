import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import {
  ForbiddenError,
  NotFoundError,
  ValidationFailedError,
} from '../../../platform/errors/app-error.ts';
import { BotGroundedEngine } from '../domain/bot-grounded-engine.ts';
import type {
  ChatConversation,
  ChatMessage,
  GroundedProductContext,
  MessageType,
  ProductBotPermissions,
} from '../domain/types.ts';
import { PgChatRepository } from '../repositories/pg-chat.repository.ts';

export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  senderRole: 'BUYER' | 'SELLER';
  content: string;
  clientMessageId?: string | null;
  messageType?: MessageType;
  metadata?: Record<string, unknown>;
  productId?: string | null;
}

export interface SendMessageResult {
  userMessage: ChatMessage;
  botResponse?: ChatMessage;
}

export class PgChatService {
  private readonly repo: PgChatRepository;
  private readonly botEngine: BotGroundedEngine;

  constructor(private readonly pool: Pool) {
    this.repo = new PgChatRepository(pool);
    this.botEngine = new BotGroundedEngine();
  }

  async getOrCreateConversation(
    buyerId: string,
    shopId: string,
    currentProductId?: string | null
  ): Promise<ChatConversation> {
    if (!buyerId || !shopId) {
      throw new ValidationFailedError('buyer_id and shop_id are required');
    }

    // Verify shop exists
    const shopOwnerId = await this.repo.getShopOwnerId(shopId);
    if (!shopOwnerId) {
      throw new NotFoundError(`Shop ${shopId} not found`);
    }

    const existing = await this.repo.findConversationByBuyerAndShop(buyerId, shopId);
    if (existing) {
      if (currentProductId && currentProductId !== existing.current_product_id) {
        await this.repo.updateConversationProduct(existing.conversation_id, currentProductId);
        existing.current_product_id = currentProductId;
      }
      return existing;
    }

    const conversationId = randomUUID();
    return this.repo.createConversation({
      conversationId,
      buyerId,
      shopId,
      currentProductId: currentProductId ?? null,
      mode: 'BOT_ASSISTANT',
    });
  }

  async getConversation(
    conversationId: string,
    userId: string,
    role: 'BUYER' | 'SELLER' | 'ADMIN'
  ): Promise<ChatConversation> {
    const conversation = await this.repo.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError(`Conversation ${conversationId} not found`);
    }

    await this.assertConversationAccess(conversation, userId, role);
    return conversation;
  }

  async listConversations(
    userId: string,
    role: 'BUYER' | 'SELLER'
  ): Promise<ChatConversation[]> {
    return this.repo.listConversationsForUser(userId, role);
  }

  async listMessages(
    conversationId: string,
    userId: string,
    role: 'BUYER' | 'SELLER' | 'ADMIN',
    limit = 50,
    beforeCursor?: string
  ): Promise<ChatMessage[]> {
    const conversation = await this.repo.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError(`Conversation ${conversationId} not found`);
    }

    await this.assertConversationAccess(conversation, userId, role);

    if (role === 'BUYER' || role === 'SELLER') {
      await this.repo.markMessagesAsRead(conversationId, role);
    }

    return this.repo.listMessages(conversationId, limit, beforeCursor);
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { conversationId, senderId, senderRole, content, clientMessageId } = input;

    if (!content || content.trim().length === 0) {
      throw new ValidationFailedError('Message content cannot be empty');
    }

    const conversation = await this.repo.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError(`Conversation ${conversationId} not found`);
    }

    await this.assertConversationAccess(conversation, senderId, senderRole);

    // Chống gửi trùng lặp nếu có clientMessageId
    if (clientMessageId) {
      const existing = await this.repo.findMessageByClientMessageId(conversationId, clientMessageId);
      if (existing) {
        return { userMessage: existing };
      }
    }

    // Nếu có gửi kèm productId, cập nhật ngữ cảnh sản phẩm hiện tại
    if (input.productId && input.productId !== conversation.current_product_id) {
      await this.repo.updateConversationProduct(conversationId, input.productId);
      conversation.current_product_id = input.productId;
    }

    const userMessage = await this.repo.createMessage({
      messageId: randomUUID(),
      conversationId,
      clientMessageId,
      senderId,
      senderRole,
      messageType: input.messageType ?? 'TEXT',
      content: content.trim(),
      metadata: input.metadata ?? {},
    });

    // Nếu người gửi là Seller: chuyển chế độ hội thoại sang LIVE_AGENT vì đã có người thật tham gia
    if (senderRole === 'SELLER') {
      if (conversation.mode === 'BOT_ASSISTANT') {
        await this.repo.updateConversationMode(conversationId, 'LIVE_AGENT');
      }
      return { userMessage };
    }

    // Nếu người gửi là Buyer và cuộc hội thoại đang ở chế độ BOT_ASSISTANT
    if (conversation.mode === 'BOT_ASSISTANT') {
      const productContext = await this.resolveProductContext(conversation.current_product_id);
      const botEval = this.botEngine.evaluate(
        content,
        productContext,
        conversation.bot_permissions
      );

      const botMessage = await this.repo.createMessage({
        messageId: randomUUID(),
        conversationId,
        senderId: null,
        senderRole: 'BOT',
        messageType: 'TEXT',
        content: botEval.content,
        metadata: {
          is_automated: true,
          can_handoff: botEval.canHandoff,
          suggest_handoff: botEval.suggestHandoff,
          attributes_used: botEval.attributesUsed,
          product_id: productContext?.product_id ?? null,
        },
      });

      return { userMessage, botResponse: botMessage };
    }

    // Nếu đang ở LIVE_AGENT, tin nhắn của Buyer chỉ lưu lại chờ Seller phản hồi
    return { userMessage };
  }

  async requestHumanHandoff(
    conversationId: string,
    buyerId: string
  ): Promise<{ conversation: ChatConversation; systemMessage: ChatMessage }> {
    const conversation = await this.repo.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError(`Conversation ${conversationId} not found`);
    }

    if (conversation.buyer_id !== buyerId) {
      throw new ForbiddenError('FORBIDDEN', 'Only the buyer can request handoff');
    }

    await this.repo.updateConversationMode(conversationId, 'LIVE_AGENT');
    conversation.mode = 'LIVE_AGENT';

    const systemMessage = await this.repo.createMessage({
      messageId: randomUUID(),
      conversationId,
      senderId: null,
      senderRole: 'BOT',
      messageType: 'HANDOFF_REQUEST',
      content:
        'Yêu cầu kết nối với Người Bán đã được gửi đến Shop. Người bán sẽ phản hồi tin nhắn của bạn sớm nhất!',
      metadata: { is_automated: true, handoff_requested_at: new Date().toISOString() },
    });

    return { conversation, systemMessage };
  }

  async updateBotPermissions(
    conversationId: string,
    sellerId: string,
    permissions: ProductBotPermissions
  ): Promise<ChatConversation> {
    const conversation = await this.repo.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError(`Conversation ${conversationId} not found`);
    }

    const shopOwnerId = await this.repo.getShopOwnerId(conversation.shop_id);
    if (shopOwnerId !== sellerId) {
      throw new ForbiddenError('FORBIDDEN', 'Only the shop owner can configure bot permissions');
    }

    await this.repo.updateConversationPermissions(conversationId, permissions);
    conversation.bot_permissions = permissions;
    return conversation;
  }

  private async assertConversationAccess(
    conversation: ChatConversation,
    userId: string,
    role: string
  ): Promise<void> {
    if (role === 'ADMIN') return;

    if (role === 'BUYER') {
      if (conversation.buyer_id !== userId) {
        throw new ForbiddenError('FORBIDDEN', 'Access to conversation forbidden');
      }
      return;
    }

    if (role === 'SELLER') {
      const shopOwnerId = await this.repo.getShopOwnerId(conversation.shop_id);
      if (shopOwnerId !== userId) {
        throw new ForbiddenError('FORBIDDEN', 'Access to conversation forbidden');
      }
      return;
    }

    throw new ForbiddenError('FORBIDDEN', 'Access to conversation forbidden');
  }

  private async resolveProductContext(
    productId: string | null
  ): Promise<GroundedProductContext | null> {
    if (!productId) return null;

    const res = await this.pool.query(
      `SELECT p.product_id, p.shop_id, p.product_name, p.description,
              s.shop_name,
              pi.image_url
       FROM products p
       JOIN shops s ON p.shop_id = s.shop_id
       LEFT JOIN LATERAL (
         SELECT image_url FROM product_images WHERE product_id = p.product_id ORDER BY sort_order ASC LIMIT 1
       ) pi ON true
       WHERE p.product_id = $1 AND p.status = 'ACTIVE'`,
      [productId]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    const variantsRes = await this.pool.query(
      `SELECT variant_id, variant_name, variant_value, price, stock_quantity, sku
       FROM product_variants
       WHERE product_id = $1 AND status = 'ACTIVE'`,
      [productId]
    );

    return {
      product_id: String(row.product_id),
      shop_id: String(row.shop_id),
      shop_name: row.shop_name ? String(row.shop_name) : undefined,
      product_name: String(row.product_name),
      description: row.description ? String(row.description) : '',
      image_url: row.image_url ? String(row.image_url) : null,
      variants: variantsRes.rows.map((v) => ({
        variant_id: String(v.variant_id),
        variant_name: String(v.variant_name || ''),
        variant_value: String(v.variant_value || ''),
        price: Number(v.price),
        stock_quantity: Number(v.stock_quantity),
        sku: v.sku ? String(v.sku) : undefined,
      })),
    };
  }
}
