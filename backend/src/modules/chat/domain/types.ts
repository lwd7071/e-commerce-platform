export type ConversationMode = 'BOT_ASSISTANT' | 'LIVE_AGENT';
export type SenderRole = 'BUYER' | 'SELLER' | 'BOT';
export type MessageType = 'TEXT' | 'PRODUCT_CARD' | 'HANDOFF_REQUEST' | 'SYSTEM';

export interface ProductBotPermissions {
  allow_stock: boolean;
  allow_price: boolean;
  allow_variants: boolean;
  allow_description: boolean;
}

export const DEFAULT_BOT_PERMISSIONS: ProductBotPermissions = {
  allow_stock: true,
  allow_price: true,
  allow_variants: true,
  allow_description: true,
};

export interface ChatConversation {
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
  is_shop_online?: boolean;
}

export interface ChatMessage {
  message_id: string;
  conversation_id: string;
  client_message_id?: string | null;
  sender_id?: string | null;
  sender_role: SenderRole;
  message_type: MessageType;
  content: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface GroundedProductVariant {
  variant_id: string;
  variant_name: string;
  variant_value: string;
  price: number;
  stock_quantity: number;
  sku?: string;
}

export interface GroundedProductContext {
  product_id: string;
  shop_id: string;
  shop_name?: string;
  product_name: string;
  description: string;
  min_price?: number;
  max_price?: number;
  variants: GroundedProductVariant[];
  image_url?: string | null;
}
