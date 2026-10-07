import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GroqChatClient } from '../../../src/modules/chat/infrastructure/groq-chat.client.ts';
import type { GroundedProductContext, ProductBotPermissions } from '../../../src/modules/chat/domain/types.ts';

describe('GroqChatClient Unit Tests (GroqCloud LPU Inference)', () => {
  const defaultPermissions: ProductBotPermissions = {
    allow_stock: true,
    allow_price: true,
    allow_variants: true,
    allow_description: true,
  };

  const sampleProduct: GroundedProductContext = {
    product_id: 'prod-001',
    product_name: 'Áo Thun Nam Cao Cấp Dino',
    shop_id: 'shop-001',
    shop_name: 'Dino Official',
    description: 'Chất liệu 100% cotton thoáng mát, thấm hút mồ hôi tốt.',
    min_price: 150000,
    max_price: 200000,
    variants: [
      { variant_id: 'v-1', variant_name: 'Size', variant_value: 'M', price: 150000, stock_quantity: 10 },
      { variant_id: 'v-2', variant_name: 'Size', variant_value: 'L', price: 200000, stock_quantity: 0 },
    ],
  };

  it('trả về null khi chưa cấu hình API key (chưa có GROQ_API_KEY)', async () => {
    const client = new GroqChatClient({ apiKey: undefined });
    assert.equal(client.isConfigured(), false);

    const result = await client.generateResponse('Sản phẩm còn size M không?', sampleProduct, defaultPermissions);
    assert.equal(result, null);
  });

  it('gọi mock fetch thành công và trả về câu trả lời từ Groq LPU', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url, init) => {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.model, 'llama-3.3-70b-versatile');
        assert.ok(body.messages[0].content.includes('Áo Thun Nam Cao Cấp Dino'));

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: 'Dạ sản phẩm Áo Thun Nam Cao Cấp Dino size M hiện còn 10 cái với giá 150.000đ ạ!',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const client = new GroqChatClient({ apiKey: 'gsk_test_key_12345' });
      assert.equal(client.isConfigured(), true);

      const result = await client.generateResponse('Còn size M không shop?', sampleProduct, defaultPermissions);
      assert.ok(result);
      assert.equal(result?.isAutomated, true);
      assert.ok(result?.content.includes('150.000đ'));
      assert.ok(result?.attributesUsed.includes('groq_llm'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('tự động bắt lỗi và trả về null khi Groq API trả về mã lỗi HTTP 500 hoặc 429', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        return new Response('Internal Server Error', { status: 500 });
      };

      const client = new GroqChatClient({ apiKey: 'gsk_test_key' });
      const result = await client.generateResponse('Giá bao nhiêu?', sampleProduct, defaultPermissions);
      assert.equal(result, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('nhận diện cờ gợi ý hand-off khi khách hỏi về giảm giá hoặc gặp người bán', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: 'Dạ các yêu cầu ưu đãi bạn vui lòng bấm "Chat với Người Bán" để shop hỗ trợ nhé!',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const client = new GroqChatClient({ apiKey: 'gsk_test_key' });
      const result = await client.generateResponse('Shop có giảm giá thêm không?', sampleProduct, defaultPermissions);
      assert.ok(result);
      assert.equal(result?.suggestHandoff, true);
      assert.equal(result?.canHandoff, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
