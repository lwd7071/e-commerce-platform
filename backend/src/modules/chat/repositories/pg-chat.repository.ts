import type { Pool } from 'pg';
import type {
  ChatConversation,
  ChatMessage,
  ConversationMode,
  MessageType,
  ProductBotPermissions,
  SenderRole,
} from '../domain/types.ts';
import { DEFAULT_BOT_PERMISSIONS } from '../domain/types.ts';

export class PgChatRepository {
  private readonly inMemoryPresence = new Map<string, boolean>();

  constructor(private readonly pool: Pool) {}

  async getShopPresence(shopId: string): Promise<boolean> {
    try {
      const res = await this.pool.query(
        'SELECT is_online FROM shop_chat_presence WHERE shop_id = $1',
        [shopId]
      );
      if (res.rows.length === 0) return this.inMemoryPresence.get(shopId) ?? true;
      return Boolean(res.rows[0].is_online);
    } catch {
      return this.inMemoryPresence.get(shopId) ?? true;
    }
  }

  async setShopPresence(shopId: string, isOnline: boolean): Promise<boolean> {
    this.inMemoryPresence.set(shopId, isOnline);
    try {
      await this.pool.query(
        `INSERT INTO shop_chat_presence (shop_id, is_online, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (shop_id) DO UPDATE SET is_online = $2, updated_at = now()`,
        [shopId, isOnline]
      );
    } catch {
      // In-memory fallback if migration not yet applied
    }
    return isOnline;
  }

  async findConversationById(conversationId: string): Promise<ChatConversation | null> {
    const res = await this.pool.query(
      `SELECT c.conversation_id, c.buyer_id, c.shop_id, c.current_product_id, c.mode,
              c.bot_permissions, c.last_message_at, c.created_at, c.updated_at,
              s.shop_name,
              p.product_name,
              pi.image_url AS product_image,
              up.full_name AS buyer_name
       FROM chat_conversations c
       JOIN shops s ON c.shop_id = s.shop_id
       LEFT JOIN products p ON c.current_product_id = p.product_id
       LEFT JOIN LATERAL (
         SELECT image_url FROM product_images WHERE product_id = c.current_product_id ORDER BY sort_order ASC LIMIT 1
       ) pi ON true
       LEFT JOIN user_profiles up ON c.buyer_id = up.user_id
       WHERE c.conversation_id = $1`,
      [conversationId]
    );

    if (res.rows.length === 0) return null;
    return this.mapConversation(res.rows[0]);
  }

  async findConversationByBuyerAndShop(buyerId: string, shopId: string): Promise<ChatConversation | null> {
    const res = await this.pool.query(
      `SELECT c.conversation_id, c.buyer_id, c.shop_id, c.current_product_id, c.mode,
              c.bot_permissions, c.last_message_at, c.created_at, c.updated_at,
              s.shop_name,
              p.product_name,
              pi.image_url AS product_image,
              up.full_name AS buyer_name
       FROM chat_conversations c
       JOIN shops s ON c.shop_id = s.shop_id
       LEFT JOIN products p ON c.current_product_id = p.product_id
       LEFT JOIN LATERAL (
         SELECT image_url FROM product_images WHERE product_id = c.current_product_id ORDER BY sort_order ASC LIMIT 1
       ) pi ON true
       LEFT JOIN user_profiles up ON c.buyer_id = up.user_id
       WHERE c.buyer_id = $1 AND c.shop_id = $2`,
      [buyerId, shopId]
    );

    if (res.rows.length === 0) return null;
    return this.mapConversation(res.rows[0]);
  }

  async createConversation(data: {
    conversationId: string;
    buyerId: string;
    shopId: string;
    currentProductId?: string | null;
    mode?: ConversationMode;
    botPermissions?: ProductBotPermissions;
  }): Promise<ChatConversation> {
    const permissions = data.botPermissions ?? DEFAULT_BOT_PERMISSIONS;
    const mode = data.mode ?? 'BOT_ASSISTANT';

    await this.pool.query(
      `INSERT INTO chat_conversations (
         conversation_id, buyer_id, shop_id, current_product_id, mode, bot_permissions, last_message_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, now(), now(), now())`,
      [
        data.conversationId,
        data.buyerId,
        data.shopId,
        data.currentProductId ?? null,
        mode,
        JSON.stringify(permissions),
      ]
    );

    const created = await this.findConversationById(data.conversationId);
    if (!created) {
      throw new Error(`Failed to create conversation ${data.conversationId}`);
    }
    return created;
  }

  async updateConversationProduct(conversationId: string, productId: string | null): Promise<void> {
    await this.pool.query(
      `UPDATE chat_conversations
       SET current_product_id = $2, updated_at = now()
       WHERE conversation_id = $1`,
      [conversationId, productId]
    );
  }

  async updateConversationMode(conversationId: string, mode: ConversationMode): Promise<void> {
    await this.pool.query(
      `UPDATE chat_conversations
       SET mode = $2, updated_at = now()
       WHERE conversation_id = $1`,
      [conversationId, mode]
    );
  }

  async updateConversationPermissions(
    conversationId: string,
    permissions: ProductBotPermissions
  ): Promise<void> {
    await this.pool.query(
      `UPDATE chat_conversations
       SET bot_permissions = $2, updated_at = now()
       WHERE conversation_id = $1`,
      [conversationId, JSON.stringify(permissions)]
    );
  }

  async updateConversationLastMessage(conversationId: string): Promise<void> {
    await this.pool.query(
      `UPDATE chat_conversations
       SET last_message_at = now(), updated_at = now()
       WHERE conversation_id = $1`,
      [conversationId]
    );
  }

  async listConversationsForUser(userId: string, role: 'BUYER' | 'SELLER'): Promise<ChatConversation[]> {
    let sql: string;
    let params: unknown[];

    if (role === 'BUYER') {
      sql = `
        SELECT c.conversation_id, c.buyer_id, c.shop_id, c.current_product_id, c.mode,
               c.bot_permissions, c.last_message_at, c.created_at, c.updated_at,
               s.shop_name,
               p.product_name,
               pi.image_url AS product_image,
               up.full_name AS buyer_name,
               (SELECT COUNT(*)::int FROM chat_messages m WHERE m.conversation_id = c.conversation_id AND m.is_read = false AND m.sender_role <> 'BUYER') AS unread_count,
               (SELECT m.content FROM chat_messages m WHERE m.conversation_id = c.conversation_id ORDER BY m.created_at DESC LIMIT 1) AS last_message
        FROM chat_conversations c
        JOIN shops s ON c.shop_id = s.shop_id
        LEFT JOIN products p ON c.current_product_id = p.product_id
        LEFT JOIN LATERAL (
          SELECT image_url FROM product_images WHERE product_id = c.current_product_id ORDER BY sort_order ASC LIMIT 1
        ) pi ON true
        LEFT JOIN user_profiles up ON c.buyer_id = up.user_id
        WHERE c.buyer_id = $1
        ORDER BY c.last_message_at DESC
      `;
      params = [userId];
    } else {
      sql = `
        SELECT c.conversation_id, c.buyer_id, c.shop_id, c.current_product_id, c.mode,
               c.bot_permissions, c.last_message_at, c.created_at, c.updated_at,
               s.shop_name,
               p.product_name,
               pi.image_url AS product_image,
               up.full_name AS buyer_name,
               (SELECT COUNT(*)::int FROM chat_messages m WHERE m.conversation_id = c.conversation_id AND m.is_read = false AND m.sender_role = 'BUYER') AS unread_count,
               (SELECT m.content FROM chat_messages m WHERE m.conversation_id = c.conversation_id ORDER BY m.created_at DESC LIMIT 1) AS last_message
        FROM chat_conversations c
        JOIN shops s ON c.shop_id = s.shop_id
        LEFT JOIN products p ON c.current_product_id = p.product_id
        LEFT JOIN LATERAL (
          SELECT image_url FROM product_images WHERE product_id = c.current_product_id ORDER BY sort_order ASC LIMIT 1
        ) pi ON true
        LEFT JOIN user_profiles up ON c.buyer_id = up.user_id
        WHERE s.owner_id = $1
        ORDER BY c.last_message_at DESC
      `;
      params = [userId];
    }

    const res = await this.pool.query(sql, params);
    return res.rows.map((row) => this.mapConversation(row));
  }

  async createMessage(data: {
    messageId: string;
    conversationId: string;
    clientMessageId?: string | null;
    senderId?: string | null;
    senderRole: SenderRole;
    messageType: MessageType;
    content: string;
    metadata?: Record<string, unknown>;
    isRead?: boolean;
  }): Promise<ChatMessage> {
    const res = await this.pool.query(
      `INSERT INTO chat_messages (
         message_id, conversation_id, client_message_id, sender_id, sender_role, message_type, content, metadata, is_read, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       RETURNING message_id, conversation_id, client_message_id, sender_id, sender_role, message_type, content, metadata, is_read, created_at`,
      [
        data.messageId,
        data.conversationId,
        data.clientMessageId ?? null,
        data.senderId ?? null,
        data.senderRole,
        data.messageType,
        data.content,
        JSON.stringify(data.metadata ?? {}),
        data.isRead ?? false,
      ]
    );

    await this.updateConversationLastMessage(data.conversationId);
    return this.mapMessage(res.rows[0]);
  }

  async findMessageByClientMessageId(
    conversationId: string,
    clientMessageId: string
  ): Promise<ChatMessage | null> {
    const res = await this.pool.query(
      `SELECT message_id, conversation_id, client_message_id, sender_id, sender_role, message_type, content, metadata, is_read, created_at
       FROM chat_messages
       WHERE conversation_id = $1 AND client_message_id = $2`,
      [conversationId, clientMessageId]
    );

    if (res.rows.length === 0) return null;
    return this.mapMessage(res.rows[0]);
  }

  async listMessages(
    conversationId: string,
    limit = 50,
    beforeCursor?: string
  ): Promise<ChatMessage[]> {
    let sql = `
      SELECT message_id, conversation_id, client_message_id, sender_id, sender_role, message_type, content, metadata, is_read, created_at
      FROM chat_messages
      WHERE conversation_id = $1
    `;
    const params: unknown[] = [conversationId];

    if (beforeCursor) {
      sql += ' AND created_at < $2';
      params.push(beforeCursor);
    }

    sql += ` ORDER BY created_at ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await this.pool.query(sql, params);
    return res.rows.map((row) => this.mapMessage(row));
  }

  async markMessagesAsRead(conversationId: string, readerRole: 'BUYER' | 'SELLER'): Promise<void> {
    // If buyer reads, mark non-buyer messages as read.
    // If seller reads, mark buyer messages as read.
    const condition = readerRole === 'BUYER' ? "sender_role <> 'BUYER'" : "sender_role = 'BUYER'";
    await this.pool.query(
      `UPDATE chat_messages
       SET is_read = true
       WHERE conversation_id = $1 AND is_read = false AND ${condition}`,
      [conversationId]
    );
  }

  async getShopOwnerId(shopId: string): Promise<string | null> {
    const res = await this.pool.query('SELECT owner_id FROM shops WHERE shop_id = $1', [shopId]);
    return res.rows[0]?.owner_id ?? null;
  }

  private mapConversation(row: Record<string, unknown>): ChatConversation {
    return {
      conversation_id: String(row.conversation_id),
      buyer_id: String(row.buyer_id),
      shop_id: String(row.shop_id),
      current_product_id: row.current_product_id ? String(row.current_product_id) : null,
      mode: (row.mode as ConversationMode) || 'BOT_ASSISTANT',
      bot_permissions:
        typeof row.bot_permissions === 'string'
          ? JSON.parse(row.bot_permissions)
          : (row.bot_permissions as ProductBotPermissions) || DEFAULT_BOT_PERMISSIONS,
      last_message_at: row.last_message_at instanceof Date ? row.last_message_at.toISOString() : String(row.last_message_at),
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      shop_name: row.shop_name ? String(row.shop_name) : undefined,
      buyer_name: row.buyer_name ? String(row.buyer_name) : undefined,
      product_name: row.product_name ? String(row.product_name) : undefined,
      product_image: row.product_image ? String(row.product_image) : null,
      unread_count: typeof row.unread_count === 'number' ? row.unread_count : 0,
      last_message: row.last_message ? String(row.last_message) : undefined,
      is_shop_online:
        row.is_shop_online !== undefined && row.is_shop_online !== null
          ? Boolean(row.is_shop_online)
          : (this.inMemoryPresence.get(String(row.shop_id)) ?? true),
    };
  }

  private mapMessage(row: Record<string, unknown>): ChatMessage {
    return {
      message_id: String(row.message_id),
      conversation_id: String(row.conversation_id),
      client_message_id: row.client_message_id ? String(row.client_message_id) : null,
      sender_id: row.sender_id ? String(row.sender_id) : null,
      sender_role: row.sender_role as SenderRole,
      message_type: row.message_type as MessageType,
      content: String(row.content),
      metadata:
        typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : (row.metadata as Record<string, unknown>) || {},
      is_read: Boolean(row.is_read),
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }
}
