// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SellerChatInboxScreen } from '@/features/seller/seller-chat-inbox-screen';
import { repositories } from '@/lib/repositories/repository-factory';
import type { WireChatConversation, WireChatMessage } from '@/lib/api/chat.api';

vi.mock('@/components/ui/toast', () => ({
  useToast: () => vi.fn(),
}));

const mockConversations: WireChatConversation[] = [
  {
    conversation_id: 'conv-1',
    buyer_id: 'buyer-1',
    shop_id: 'shop-1',
    current_product_id: 'prod-1',
    mode: 'LIVE_AGENT',
    bot_permissions: { allow_stock: true, allow_price: true, allow_variants: true, allow_description: true },
    last_message_at: '2026-10-02T10:00:00Z',
    created_at: '2026-10-02T10:00:00Z',
    updated_at: '2026-10-02T10:00:00Z',
    buyer_name: 'Nguyễn Văn A',
    product_name: 'Giày Thể Thao Nam',
    last_message: 'Shop ơi có giao gấp hôm nay được không?',
    unread_count: 2,
  },
  {
    conversation_id: 'conv-2',
    buyer_id: 'buyer-2',
    shop_id: 'shop-1',
    current_product_id: 'prod-2',
    mode: 'BOT_ASSISTANT',
    bot_permissions: { allow_stock: true, allow_price: true, allow_variants: true, allow_description: true },
    last_message_at: '2026-10-02T09:30:00Z',
    created_at: '2026-10-02T09:30:00Z',
    updated_at: '2026-10-02T09:30:00Z',
    buyer_name: 'Trần Thị B',
    product_name: 'Túi Xách Da Cao Cấp',
    last_message: 'Dạ sản phẩm hiện còn 15 cái trong kho ạ.',
    unread_count: 0,
  },
];

const mockMessages: WireChatMessage[] = [
  {
    message_id: 'm1',
    conversation_id: 'conv-1',
    sender_role: 'BUYER',
    message_type: 'TEXT',
    content: 'Shop ơi có giao gấp hôm nay được không?',
    metadata: {},
    is_read: false,
    created_at: '2026-10-02T10:00:00Z',
  },
];

describe('SellerChatInboxScreen Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders conversations list and marks live agent conversations with alert badge', async () => {
    vi.spyOn(repositories, 'chat').mockReturnValue({
      createOrGetConversation: vi.fn(),
      getConversations: vi.fn().mockResolvedValue(mockConversations),
      getConversation: vi.fn(),
      getMessages: vi.fn().mockResolvedValue(mockMessages),
      sendMessage: vi.fn(),
      requestHandoff: vi.fn(),
      updatePermissions: vi.fn(),
    });

    render(<SellerChatInboxScreen />);

    expect(await screen.findByText('Tin Nhắn Khách Hàng (Live Chat & AI Bot)')).toBeTruthy();
    expect(screen.getAllByText('Nguyễn Văn A').length).toBeGreaterThan(0);
    expect(screen.getByText('Trần Thị B')).toBeTruthy();
    expect(screen.getByText('Cần Shop trả lời')).toBeTruthy();
    expect(screen.getByText('Bot đang trực')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // unread count
  });

  it('allows seller to type and send a reply message', async () => {
    const sendMock = vi.fn().mockResolvedValue({
      userMessage: {
        message_id: 'm-seller',
        conversation_id: 'conv-1',
        sender_role: 'SELLER' as const,
        message_type: 'TEXT' as const,
        content: 'Dạ shop có thể gửi hỏa tốc qua GrabExpress ngay nhé!',
        metadata: {},
        is_read: true,
        created_at: new Date().toISOString(),
      },
    });

    vi.spyOn(repositories, 'chat').mockReturnValue({
      createOrGetConversation: vi.fn(),
      getConversations: vi.fn().mockResolvedValue(mockConversations),
      getConversation: vi.fn(),
      getMessages: vi.fn().mockResolvedValue(mockMessages),
      sendMessage: sendMock,
      requestHandoff: vi.fn(),
      updatePermissions: vi.fn(),
    });

    const user = userEvent.setup();
    render(<SellerChatInboxScreen />);

    const input = await screen.findByPlaceholderText('Nhập tin nhắn phản hồi cho khách hàng...');
    await user.type(input, 'Dạ shop có thể gửi hỏa tốc qua GrabExpress ngay nhé!');

    const sendBtn = screen.getByText('Gửi phản hồi');
    await user.click(sendBtn);

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith('conv-1', {
        content: 'Dạ shop có thể gửi hỏa tốc qua GrabExpress ngay nhé!',
      });
    });

    expect(await screen.findByText('Dạ shop có thể gửi hỏa tốc qua GrabExpress ngay nhé!')).toBeTruthy();
  });

  it('allows configuring bot permissions for product information', async () => {
    const updatePermsMock = vi.fn().mockResolvedValue({
      ...mockConversations[0],
      bot_permissions: {
        allow_stock: false,
        allow_price: true,
        allow_variants: true,
        allow_description: true,
      },
    });

    vi.spyOn(repositories, 'chat').mockReturnValue({
      createOrGetConversation: vi.fn(),
      getConversations: vi.fn().mockResolvedValue(mockConversations),
      getConversation: vi.fn(),
      getMessages: vi.fn().mockResolvedValue(mockMessages),
      sendMessage: vi.fn(),
      requestHandoff: vi.fn(),
      updatePermissions: updatePermsMock,
    });

    const user = userEvent.setup();
    render(<SellerChatInboxScreen />);

    const configBtn = await screen.findByText('⚙️ Quyền của Bot');
    await user.click(configBtn);

    expect(await screen.findByText('Cấu hình Quyền Dữ liệu cho Chatbox AI')).toBeTruthy();

    const saveBtn = screen.getByText('Lưu cấu hình');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(updatePermsMock).toHaveBeenCalled();
    });
  });

  it('allows toggling shop online and offline status with notification banner', async () => {
    vi.spyOn(repositories, 'chat').mockReturnValue({
      createOrGetConversation: vi.fn(),
      getConversations: vi.fn().mockResolvedValue(mockConversations),
      getConversation: vi.fn(),
      getMessages: vi.fn().mockResolvedValue(mockMessages),
      sendMessage: vi.fn(),
      requestHandoff: vi.fn(),
      updatePermissions: vi.fn(),
    });

    const user = userEvent.setup();
    render(<SellerChatInboxScreen />);

    const onlineToggle = await screen.findByText('Shop Đang Trực Tuyến');
    expect(onlineToggle).toBeTruthy();

    await user.click(onlineToggle);

    expect(await screen.findByText('Shop Tạm Vắng (Offline)')).toBeTruthy();
    expect(screen.getByText(/Shop đang vắng mặt \(Offline\)/)).toBeTruthy();
  });
});
