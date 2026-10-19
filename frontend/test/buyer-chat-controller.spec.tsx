// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuyerChatController, useBuyerChat } from '@/components/chat/buyer-chat-controller';
import { repositories } from '@/lib/repositories/repository-factory';
import type { WireChatConversation, WireChatMessage } from '@/lib/api/chat.api';

const conversation: WireChatConversation = {
  conversation_id: 'conv-001',
  buyer_id: 'buyer-001',
  shop_id: 'shop-001',
  current_product_id: 'product-001',
  mode: 'BOT_ASSISTANT',
  bot_permissions: { allow_stock: true, allow_price: true, allow_variants: true, allow_description: true },
  last_message_at: '2026-10-19T10:00:00Z',
  created_at: '2026-10-19T09:00:00Z',
  updated_at: '2026-10-19T10:00:00Z',
  shop_name: 'Dino Store',
  product_name: 'Áo cotton',
  last_message: 'Còn size M không shop?',
  unread_count: 2,
};

const message: WireChatMessage = {
  message_id: 'message-001',
  conversation_id: 'conv-001',
  sender_role: 'BUYER',
  message_type: 'TEXT',
  content: 'Còn size M không shop?',
  metadata: {},
  is_read: true,
  created_at: '2026-10-19T10:00:00Z',
};

function OpenInboxButton() {
  const chat = useBuyerChat();
  return <button onClick={(event) => chat.openInbox(event.currentTarget)}>Mở hộp thư test</button>;
}

function OpenProductChatButton() {
  const chat = useBuyerChat();
  return <button onClick={(event) => chat.openProduct({ productId: 'product-001', shopId: 'shop-001', productName: 'Áo cotton' }, event.currentTarget)}>Chat với Shop</button>;
}

describe('BuyerChatController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('shows existing shop conversations and opens the selected history without creating a conversation', async () => {
    const getConversations = vi.fn().mockResolvedValue([conversation]);
    const getMessages = vi.fn().mockResolvedValue([message]);
    const createOrGetConversation = vi.fn();
    vi.spyOn(repositories, 'chat').mockReturnValue({
      createOrGetConversation,
      getConversations,
      getConversation: vi.fn(),
      getMessages,
      sendMessage: vi.fn(),
      requestHandoff: vi.fn(),
      updatePermissions: vi.fn(),
    });

    const user = userEvent.setup();
    render(<BuyerChatController enabled><OpenInboxButton /></BuyerChatController>);
    expect(screen.getByRole('button', { name: 'Mở hộp thư chat' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Mở hộp thư test' }));

    expect(await screen.findByText('Dino Store')).toBeTruthy();
    expect(screen.getByText('Áo cotton')).toBeTruthy();
    expect(screen.getByText('Còn size M không shop?')).toBeTruthy();
    expect(screen.getByLabelText('2 tin nhắn chưa đọc')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Dino Store/ }));
    expect(await screen.findByText('Quay lại hộp thư')).toBeTruthy();
    expect(await screen.findByText('Bạn')).toBeTruthy();
    expect(getMessages).toHaveBeenCalledWith('conv-001');
    expect(createOrGetConversation).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Quay lại hộp thư' }));
    expect(await screen.findByText('Dino Store')).toBeTruthy();
  });

  it('shows an actionable error when the conversation list fails and retries on request', async () => {
    const getConversations = vi.fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([]);
    vi.spyOn(repositories, 'chat').mockReturnValue({
      createOrGetConversation: vi.fn(),
      getConversations,
      getConversation: vi.fn(),
      getMessages: vi.fn(),
      sendMessage: vi.fn(),
      requestHandoff: vi.fn(),
      updatePermissions: vi.fn(),
    });

    const user = userEvent.setup();
    render(<BuyerChatController enabled><OpenInboxButton /></BuyerChatController>);
    await user.click(screen.getByRole('button', { name: 'Mở hộp thư test' }));
    expect(await screen.findByRole('alert')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Bạn chưa có cuộc trò chuyện nào.')).toBeTruthy();
    await waitFor(() => expect(getConversations).toHaveBeenCalledTimes(3));
  });

  it('opens the product conversation with the selected product context', async () => {
    const createOrGetConversation = vi.fn().mockResolvedValue(conversation);
    const getMessages = vi.fn().mockResolvedValue([message]);
    vi.spyOn(repositories, 'chat').mockReturnValue({
      createOrGetConversation,
      getConversations: vi.fn().mockResolvedValue([]),
      getConversation: vi.fn(),
      getMessages,
      sendMessage: vi.fn(),
      requestHandoff: vi.fn(),
      updatePermissions: vi.fn(),
    });

    const user = userEvent.setup();
    render(<BuyerChatController enabled><OpenProductChatButton /></BuyerChatController>);
    await user.click(screen.getByRole('button', { name: 'Chat với Shop' }));

    expect(await screen.findByText('Áo cotton')).toBeTruthy();
    await waitFor(() => expect(createOrGetConversation).toHaveBeenCalledWith('shop-001', 'product-001'));
    expect(getMessages).toHaveBeenCalledWith('conv-001');
    expect(screen.queryByRole('dialog', { name: 'Hộp thư chat' })).toBeNull();
  });

  it('closes with Escape and restores focus to the control that opened the chat', async () => {
    vi.spyOn(repositories, 'chat').mockReturnValue({
      createOrGetConversation: vi.fn(),
      getConversations: vi.fn().mockResolvedValue([]),
      getConversation: vi.fn(),
      getMessages: vi.fn(),
      sendMessage: vi.fn(),
      requestHandoff: vi.fn(),
      updatePermissions: vi.fn(),
    });

    const user = userEvent.setup();
    render(<BuyerChatController enabled><OpenInboxButton /></BuyerChatController>);
    const opener = screen.getByRole('button', { name: 'Mở hộp thư test' });
    await user.click(opener);
    expect(await screen.findByRole('dialog', { name: 'Hộp thư chat' })).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Hộp thư chat' })).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
