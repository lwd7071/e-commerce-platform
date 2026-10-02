import { apiClient } from './client';

export type ConversationMode = 'BOT_ASSISTANT' | 'LIVE_AGENT';
export type SenderRole = 'BUYER' | 'SELLER' | 'BOT';
export type MessageType = 'TEXT' | 'PRODUCT_CARD' | 'HANDOFF_REQUEST' | 'SYSTEM';

export interface ProductBotPermissions {
  allow_stock: boolean;
  allow_price: boolean;
  allow_variants: boolean;
  allow_description: boolean;
}

export interface WireChatConversation {
  conversation_id: string;
  buyer_id: string;
  shop_id: string;
  current_product_id: string | null;
  mode: ConversationMode;
  bot_permissions: ProductBotPermissions;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  shop_name?: string;
  buyer_name?: string;
  product_name?: string;
  product_image?: string | null;
  unread_count?: number;
  last_message?: string;
}

export interface WireChatMessage {
  message_id: string;
  conversation_id: string;
  client_message_id?: string | null;
  sender_id?: string | null;
  sender_role: SenderRole;
  message_type: MessageType;
  content: string;
  metadata: {
    is_automated?: boolean;
    can_handoff?: boolean;
    suggest_handoff?: boolean;
    attributes_used?: string[];
    product_id?: string | null;
    [key: string]: unknown;
  };
  is_read: boolean;
  created_at: string;
}

export interface SendMessagePayload {
  content: string;
  client_message_id?: string;
  message_type?: MessageType;
  metadata?: Record<string, unknown>;
  product_id?: string;
}

export interface SendMessageResponse {
  userMessage: WireChatMessage;
  botResponse?: WireChatMessage;
}

export interface HandoffResponse {
  conversation: WireChatConversation;
  systemMessage: WireChatMessage;
}

export const chatApi = {
  createOrGetConversation: (shopId: string, productId?: string) =>
    apiClient.post<WireChatConversation>('/chat/conversations', {
      shop_id: shopId,
      product_id: productId,
    }),

  getConversations: () =>
    apiClient.get<WireChatConversation[]>('/chat/conversations'),

  getConversation: (conversationId: string) =>
    apiClient.get<WireChatConversation>(`/chat/conversations/${conversationId}`),

  getMessages: (conversationId: string, limit = 50, beforeCursor?: string) =>
    apiClient.get<WireChatMessage[]>(`/chat/conversations/${conversationId}/messages`, {
      params: { limit, before_cursor: beforeCursor },
    }),

  sendMessage: (conversationId: string, payload: SendMessagePayload) =>
    apiClient.post<SendMessageResponse>(`/chat/conversations/${conversationId}/messages`, payload),

  requestHandoff: (conversationId: string) =>
    apiClient.post<HandoffResponse>(`/chat/conversations/${conversationId}/handoff`),

  updatePermissions: (conversationId: string, permissions: Partial<ProductBotPermissions>) =>
    apiClient.patch<WireChatConversation>(`/chat/conversations/${conversationId}/permissions`, permissions),
};
