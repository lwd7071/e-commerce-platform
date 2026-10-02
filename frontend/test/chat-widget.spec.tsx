// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ChatWidget, type ChatProductContext } from '@/components/chat/chat-widget';
import { repositories } from '@/lib/repositories/repository-factory';
import type { WireChatConversation, WireChatMessage } from '@/lib/api/chat.api';

const mockProductContext: ChatProductContext = {
  productId: 'prod-123',
  shopId: 'shop-456',
  shopName: 'Dino Official Store',
  productName: 'Áo Thun Cotton Unisex',
  price: 250000,
  imageUrl: 'https://example.com/image.jpg',
  totalStock: 30,
};

const mockConv: WireChatConversation = {
  conversation_id: 'conv-001',
  buyer_id: 'buyer-001',
  shop_id: 'shop-456',
  current_product_id: 'prod-123',
  mode: 'BOT_ASSISTANT',
  bot_permissions: {
    allow_stock: true,
    allow_price: true,
    allow_variants: true,
    allow_description: true,
  },
  last_message_at: '2026-10-02T10:00:00Z',
  created_at: '2026-10-02T10:00:00Z',
  updated_at: '2026-10-02T10:00:00Z',
  shop_name: 'Dino Official Store',
  product_name: 'Áo Thun Cotton Unisex',
};

const mockUserMsg: WireChatMessage = {
  message_id: 'msg-u1',
  conversation_id: 'conv-001',
  sender_role: 'BUYER',
  message_type: 'TEXT',
  content: 'Sản phẩm này còn hàng không shop?',
  metadata: {},
  is_read: true,
  created_at: '2026-10-02T10:01:00Z',
};

const mockBotMsg: WireChatMessage = {
  message_id: 'msg-b1',
  conversation_id: 'conv-001',
  sender_role: 'BOT',
  message_type: 'TEXT',
  content: 'Dạ sản phẩm hiện còn 30 cái trong kho qua các phân loại ạ!',
  metadata: { is_automated: true, suggest_handoff: false },
  is_read: true,
  created_at: '2026-10-02T10:01:01Z',
};

describe('ChatWidget Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders pinned product card and quick inquiry chips when opened', async () => {
    vi.spyOn(repositories, 'chat').mockReturnValue({
      createOrGetConversation: vi.fn().mockResolvedValue(mockConv),
      getConversations: vi.fn().mockResolvedValue([mockConv]),
      getConversation: vi.fn().mockResolvedValue(mockConv),
      getMessages: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn(),
      requestHandoff: vi.fn(),
      updatePermissions: vi.fn(),
    });

    render(<ChatWidget isOpen={true} onClose={vi.fn()} productContext={mockProductContext} />);

    expect(await screen.findByText('Áo Thun Cotton Unisex')).toBeTruthy();
    expect(screen.getByText('Dino Official Store')).toBeTruthy();
    expect(screen.getByText(/250\.000/)).toBeTruthy();
    expect(screen.getByText(/Kho: 30 cái/)).toBeTruthy();
    expect(screen.getByText('Trợ lý AI của Shop sẵn sàng hỗ trợ!')).toBeTruthy();
    expect(screen.getByText('💬 Sản phẩm này còn hàng không shop?')).toBeTruthy();
  });

  it('sends inquiry and displays bot response with automated tag', async () => {
    const sendMessageMock = vi.fn().mockResolvedValue({
      userMessage: mockUserMsg,
      botResponse: mockBotMsg,
    });

    vi.spyOn(repositories, 'chat').mockReturnValue({
      createOrGetConversation: vi.fn().mockResolvedValue(mockConv),
      getConversations: vi.fn().mockResolvedValue([mockConv]),
      getConversation: vi.fn().mockResolvedValue(mockConv),
      getMessages: vi.fn().mockResolvedValue([]),
      sendMessage: sendMessageMock,
      requestHandoff: vi.fn(),
      updatePermissions: vi.fn(),
    });

    const user = userEvent.setup();
    render(<ChatWidget isOpen={true} onClose={vi.fn()} productContext={mockProductContext} />);

    const chip = await screen.findByText('💬 Sản phẩm này còn hàng không shop?');
    await user.click(chip);

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith('conv-001', {
        content: 'Sản phẩm này còn hàng không shop?',
        product_id: 'prod-123',
      });
    });

    expect(await screen.findByText('Sản phẩm này còn hàng không shop?')).toBeTruthy();
    expect(await screen.findByText('Dạ sản phẩm hiện còn 30 cái trong kho qua các phân loại ạ!')).toBeTruthy();
    expect(screen.getByText(/Trả lời tự động từ Bot/)).toBeTruthy();
  });

  it('handles human handoff request and switches mode', async () => {
    const handoffMock = vi.fn().mockResolvedValue({
      conversation: { ...mockConv, mode: 'LIVE_AGENT' as const },
      systemMessage: {
        message_id: 'sys-1',
        conversation_id: 'conv-001',
        sender_role: 'BOT' as const,
        message_type: 'HANDOFF_REQUEST' as const,
        content: 'Đã gửi yêu cầu kết nối với Người Bán.',
        metadata: { is_automated: true },
        is_read: false,
        created_at: new Date().toISOString(),
      },
    });

    vi.spyOn(repositories, 'chat').mockReturnValue({
      createOrGetConversation: vi.fn().mockResolvedValue(mockConv),
      getConversations: vi.fn().mockResolvedValue([mockConv]),
      getConversation: vi.fn().mockResolvedValue(mockConv),
      getMessages: vi.fn().mockResolvedValue([mockUserMsg, mockBotMsg]),
      sendMessage: vi.fn(),
      requestHandoff: handoffMock,
      updatePermissions: vi.fn(),
    });

    const user = userEvent.setup();
    render(<ChatWidget isOpen={true} onClose={vi.fn()} productContext={mockProductContext} />);

    const handoffBtn = await screen.findByTitle('Gặp người bán trực tiếp');
    await user.click(handoffBtn);

    await waitFor(() => {
      expect(handoffMock).toHaveBeenCalledWith('conv-001');
    });

    expect(await screen.findByText(/Đã gửi yêu cầu kết nối với Người Bán/)).toBeTruthy();
    expect(screen.getByText('Đang chat với Người Bán')).toBeTruthy();
  });
});
