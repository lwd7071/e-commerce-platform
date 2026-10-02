import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { BotGroundedEngine } from '../../src/modules/chat/domain/bot-grounded-engine.ts';
import type {
  ChatConversation,
  ChatMessage,
  GroundedProductContext,
  ProductBotPermissions,
} from '../../src/modules/chat/domain/types.ts';
import { DEFAULT_BOT_PERMISSIONS } from '../../src/modules/chat/domain/types.ts';
import type { PgChatService, SendMessageInput } from '../../src/modules/chat/services/pg-chat.service.ts';

const buyerId = '11111111-1111-1111-1111-111111111111';
const sellerId = '33333333-3333-3333-3333-333333333333';
const shopId = '44444444-4444-4444-4444-444444444444';
const conversationId = '55555555-5555-5555-5555-555555555555';
const productId = '66666666-6666-6666-6666-666666666666';

const sampleProduct: GroundedProductContext = {
  product_id: productId,
  shop_id: shopId,
  shop_name: 'Dino Official Store',
  product_name: 'Áo Thun Cotton Cao Cấp Unisex',
  description:
    'Chất liệu 100% Cotton 4 chiều thoáng mát, thấm hút mồ hôi cực tốt.\nXuất xứ: Việt Nam.\nBảo hành đổi trả miễn phí trong 7 ngày nếu có lỗi từ nhà sản xuất.',
  variants: [
    {
      variant_id: 'v1',
      variant_name: 'Size M - Màu Đen',
      variant_value: 'M-Black',
      price: 180000,
      stock_quantity: 15,
      sku: 'AT-M-BLK',
    },
    {
      variant_id: 'v2',
      variant_name: 'Size L - Màu Đen',
      variant_value: 'L-Black',
      price: 190000,
      stock_quantity: 0,
      sku: 'AT-L-BLK',
    },
    {
      variant_id: 'v3',
      variant_name: 'Size XL - Màu Trắng',
      variant_value: 'XL-White',
      price: 200000,
      stock_quantity: 8,
      sku: 'AT-XL-WHT',
    },
  ],
};

describe('BotGroundedEngine Unit Tests', () => {
  const engine = new BotGroundedEngine();

  it('trả lời chính xác số lượng tồn kho khi hỏi về biến thể còn hàng', () => {
    const res = engine.evaluate('Size M màu đen còn bao nhiêu cái vậy shop?', sampleProduct, DEFAULT_BOT_PERMISSIONS);
    assert.equal(res.isAutomated, true);
    assert.equal(res.suggestHandoff, false);
    assert.match(res.content, /còn \*\*15\*\* sản phẩm/);
    assert.match(res.content, /180\.000/);
  });

  it('thông báo hết hàng và gợi ý phân loại khác khi biến thể được hỏi đã hết kho', () => {
    const res = engine.evaluate('Cho mình hỏi Size L màu đen còn hàng không?', sampleProduct, DEFAULT_BOT_PERMISSIONS);
    assert.equal(res.isAutomated, true);
    assert.equal(res.suggestHandoff, true);
    assert.match(res.content, /tạm hết hàng trong kho/);
    assert.match(res.content, /Size M - Màu Đen/);
  });

  it('báo tổng tồn kho và liệt kê từng phân loại khi hỏi chung còn hàng không', () => {
    const res = engine.evaluate('Sản phẩm này còn hàng không shop?', sampleProduct, DEFAULT_BOT_PERMISSIONS);
    assert.equal(res.isAutomated, true);
    assert.match(res.content, /tổng cộng \*\*23\*\* sản phẩm/);
    assert.match(res.content, /Size M - Màu Đen: còn 15 cái/);
  });

  it('từ chối báo tồn kho khi seller tắt quyền allow_stock và mời gặp người bán', () => {
    const permissions: ProductBotPermissions = { ...DEFAULT_BOT_PERMISSIONS, allow_stock: false };
    const res = engine.evaluate('Còn bao nhiêu cái vậy?', sampleProduct, permissions);
    assert.equal(res.isAutomated, true);
    assert.equal(res.suggestHandoff, true);
    assert.match(res.content, /chưa bật tính năng công khai số lượng tồn kho/);
  });

  it('báo khoảng giá chính xác từ min đến max khi hỏi về giá', () => {
    const res = engine.evaluate('Giá bao nhiêu vậy shop?', sampleProduct, DEFAULT_BOT_PERMISSIONS);
    assert.equal(res.isAutomated, true);
    assert.match(res.content, /180\.000/);
    assert.match(res.content, /200\.000/);
  });

  it('trích xuất thông tin chất liệu và xuất xứ từ mô tả', () => {
    const res = engine.evaluate('Chất liệu vải gì vậy shop?', sampleProduct, DEFAULT_BOT_PERMISSIONS);
    assert.equal(res.isAutomated, true);
    assert.match(res.content, /100% Cotton 4 chiều thoáng mát/);
  });

  it('chống bịa đặt (Anti-hallucination): từ chối trả lời thông tin không có trong mô tả và đề xuất gặp Shop', () => {
    const res = engine.evaluate('Áo này có chống được tia cực tím UV 50+ không shop?', sampleProduct, DEFAULT_BOT_PERMISSIONS);
    assert.equal(res.isAutomated, true);
    assert.equal(res.suggestHandoff, true);
    assert.match(res.content, /chưa có dữ liệu|chưa thấy thông tin/);
  });

  it('phát hiện yêu cầu mặc cả, giảm giá hoặc ship gấp -> gợi ý hand-off sang Shop ngay', () => {
    const res = engine.evaluate('Bớt giá cho mình 30k được không shop?', sampleProduct, DEFAULT_BOT_PERMISSIONS);
    assert.equal(res.isAutomated, true);
    assert.equal(res.suggestHandoff, true);
    assert.match(res.content, /cần Shop trực tiếp kiểm tra và quyết định/);
  });

  it('xử lý lời chào ban đầu thân thiện kèm tên sản phẩm', () => {
    const res = engine.evaluate('Chào shop', sampleProduct, DEFAULT_BOT_PERMISSIONS);
    assert.equal(res.isAutomated, true);
    assert.match(res.content, /Áo Thun Cotton Cao Cấp Unisex/);
  });
});

describe('Chat HTTP Endpoints Integration', () => {
  const mockConversation: ChatConversation = {
    conversation_id: conversationId,
    buyer_id: buyerId,
    shop_id: shopId,
    current_product_id: productId,
    mode: 'BOT_ASSISTANT',
    bot_permissions: DEFAULT_BOT_PERMISSIONS,
    last_message_at: '2026-10-02T10:00:00.000Z',
    created_at: '2026-10-02T10:00:00.000Z',
    updated_at: '2026-10-02T10:00:00.000Z',
    shop_name: 'Dino Official Store',
    product_name: 'Áo Thun Cotton Cao Cấp Unisex',
  };

  const mockUserMsg: ChatMessage = {
    message_id: 'msg-1',
    conversation_id: conversationId,
    sender_id: buyerId,
    sender_role: 'BUYER',
    message_type: 'TEXT',
    content: 'Shop còn size M không?',
    metadata: {},
    is_read: true,
    created_at: '2026-10-02T10:01:00.000Z',
  };

  const mockBotMsg: ChatMessage = {
    message_id: 'msg-2',
    conversation_id: conversationId,
    sender_id: null,
    sender_role: 'BOT',
    message_type: 'TEXT',
    content: 'Dạ sản phẩm phân loại Size M hiện còn 15 sản phẩm ạ.',
    metadata: { is_automated: true },
    is_read: true,
    created_at: '2026-10-02T10:01:01.000Z',
  };

  it('POST /chat/conversations tạo hoặc lấy cuộc hội thoại cho Buyer', async () => {
    const app = createApp({
      auth: (req, _res, next) => {
        req.context = createRequestContext({
          request_id: 'req-chat-test',
          user_id: buyerId,
          role: 'BUYER',
        });
        next();
      },
      chatService: {
        getOrCreateConversation: async (bId: string, sId: string, pId?: string | null) => {
          assert.equal(bId, buyerId);
          assert.equal(sId, shopId);
          assert.equal(pId, productId);
          return mockConversation;
        },
      } as unknown as PgChatService,
    });

    const res = await request(app)
      .post('/api/v1/chat/conversations')
      .send({ shop_id: shopId, product_id: productId })
      .expect(200);

    assert.equal(res.body.data.conversation_id, conversationId);
    assert.equal(res.body.data.mode, 'BOT_ASSISTANT');
  });

  it('GET /chat/conversations trả về danh sách hội thoại của người dùng', async () => {
    const app = createApp({
      auth: (req, _res, next) => {
        req.context = createRequestContext({
          request_id: 'req-chat-test',
          user_id: buyerId,
          role: 'BUYER',
        });
        next();
      },
      chatService: {
        listConversations: async (userId: string, role: string) => {
          assert.equal(userId, buyerId);
          assert.equal(role, 'BUYER');
          return [mockConversation];
        },
      } as unknown as PgChatService,
    });

    const res = await request(app).get('/api/v1/chat/conversations').expect(200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].conversation_id, conversationId);
  });

  it('POST /chat/conversations/:id/messages gửi tin nhắn và nhận phản hồi từ Bot', async () => {
    const app = createApp({
      auth: (req, _res, next) => {
        req.context = createRequestContext({
          request_id: 'req-chat-test',
          user_id: buyerId,
          role: 'BUYER',
        });
        next();
      },
      chatService: {
        sendMessage: async (input: SendMessageInput) => {
          assert.equal(input.conversationId, conversationId);
          assert.equal(input.senderId, buyerId);
          assert.equal(input.senderRole, 'BUYER');
          return { userMessage: mockUserMsg, botResponse: mockBotMsg };
        },
      } as unknown as PgChatService,
    });

    const res = await request(app)
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .send({ content: 'Shop còn size M không?' })
      .expect(201);

    assert.equal(res.body.data.userMessage.content, 'Shop còn size M không?');
    assert.equal(res.body.data.botResponse.sender_role, 'BOT');
  });

  it('POST /chat/conversations/:id/handoff chuyển đổi chế độ sang LIVE_AGENT', async () => {
    const app = createApp({
      auth: (req, _res, next) => {
        req.context = createRequestContext({
          request_id: 'req-chat-test',
          user_id: buyerId,
          role: 'BUYER',
        });
        next();
      },
      chatService: {
        requestHumanHandoff: async (cId: string, bId: string) => {
          assert.equal(cId, conversationId);
          assert.equal(bId, buyerId);
          return {
            conversation: { ...mockConversation, mode: 'LIVE_AGENT' },
            systemMessage: {
              message_id: 'sys-1',
              conversation_id: conversationId,
              sender_role: 'BOT',
              message_type: 'HANDOFF_REQUEST',
              content: 'Yêu cầu kết nối người bán đã được gửi.',
              metadata: { is_automated: true },
              is_read: false,
              created_at: new Date().toISOString(),
            },
          };
        },
      } as unknown as PgChatService,
    });

    const res = await request(app)
      .post(`/api/v1/chat/conversations/${conversationId}/handoff`)
      .expect(200);

    assert.equal(res.body.data.conversation.mode, 'LIVE_AGENT');
  });

  it('PATCH /chat/conversations/:id/permissions cho phép Seller cấu hình quyền của Bot', async () => {
    const app = createApp({
      auth: (req, _res, next) => {
        req.context = createRequestContext({
          request_id: 'req-chat-test',
          user_id: sellerId,
          role: 'SELLER',
        });
        next();
      },
      chatService: {
        updateBotPermissions: async (cId: string, sId: string, perms: ProductBotPermissions) => {
          assert.equal(cId, conversationId);
          assert.equal(sId, sellerId);
          assert.equal(perms.allow_stock, false);
          return { ...mockConversation, bot_permissions: perms };
        },
      } as unknown as PgChatService,
    });

    const res = await request(app)
      .patch(`/api/v1/chat/conversations/${conversationId}/permissions`)
      .send({ allow_stock: false })
      .expect(200);

    assert.equal(res.body.data.bot_permissions.allow_stock, false);
  });
});
