import type { GroundedProductContext, ProductBotPermissions } from '../domain/types.ts';
import type { BotEvaluationResult } from '../domain/bot-grounded-engine.ts';

export interface GroqClientConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export class GroqChatClient {
  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config?: GroqClientConfig) {
    this.apiKey =
      config?.apiKey ??
      process.env.GROQ_API_KEY ??
      process.env.GROK_API_KEY ??
      null;
    this.baseUrl =
      config?.baseUrl ??
      process.env.GROQ_API_BASE_URL ??
      'https://api.groq.com/openai/v1';
    this.model =
      config?.model ??
      process.env.GROQ_MODEL ??
      'openai/gpt-oss-120b';
    this.timeoutMs =
      config?.timeoutMs ?? (Number(process.env.GROQ_TIMEOUT_MS) || 5000);
  }

  /**
   * Kiểm tra xem Groq API đã được cấu hình và sẵn sàng hoạt động hay chưa
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Sinh câu trả lời tự động cho câu hỏi của Buyer bằng GroqCloud API (LPU Inference)
   * Trả về null nếu chưa có API key hoặc nếu request gặp lỗi/timeout (để fallback an toàn sang BotGroundedEngine).
   */
  async generateResponse(
    question: string,
    product: GroundedProductContext | null,
    permissions: ProductBotPermissions
  ): Promise<BotEvaluationResult | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const systemPrompt = this.buildSystemPrompt(product, permissions);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question.trim() },
          ],
          temperature: 0.2,
          max_tokens: 300,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[GroqChatClient] Request failed with status ${response.status}: ${response.statusText}`);
        return null;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const replyContent = data.choices?.[0]?.message?.content?.trim();
      if (!replyContent) {
        return null;
      }

      const normalizedQ = question.toLowerCase();
      const needsHandoff =
        normalizedQ.includes('gap shop') ||
        normalizedQ.includes('nguoi ban') ||
        normalizedQ.includes('mac ca') ||
        normalizedQ.includes('giam gia') ||
        normalizedQ.includes('ship gap') ||
        replyContent.toLowerCase().includes('chat với người bán');

      return {
        content: replyContent,
        canHandoff: true,
        isAutomated: true,
        suggestHandoff: needsHandoff,
        attributesUsed: ['groq_llm', 'product_context'],
      };
    } catch (err) {
      clearTimeout(timeout);
      console.warn('[GroqChatClient] Fallback triggered due to error/timeout calling Groq API:', err);
      return null;
    }
  }

  private buildSystemPrompt(
    product: GroundedProductContext | null,
    permissions: ProductBotPermissions
  ): string {
    if (!product) {
      return `Bạn là Trợ lý AI CSKH sàn thương mại điện tử Dino. 
Hiện tại khách hàng đang mở khung chat nhưng chưa chọn sản phẩm cụ thể.
Hãy chào khách thân thiện bằng tiếng Việt, thông báo bạn là Trợ lý tự động, và hướng dẫn khách bấm "Chat với Shop" từ trang chi tiết của sản phẩm để được hỗ trợ tra cứu giá, tồn kho và chất liệu tốt nhất.
Quy tắc: Ngắn gọn (1-2 câu), lịch sự.`;
    }

    const lines: string[] = [
      `Bạn là Trợ lý AI CSKH đại diện cho gian hàng "${product.shop_name ?? 'Shop'}" trên sàn TMĐT Dino.`,
      `Khách hàng đang xem sản phẩm: "${product.product_name}".`,
      '',
      '--- DỮ LIỆU SẢN PHẨM ĐƯỢC CẤP PHÉP ---',
    ];

    if (permissions.allow_description && product.description) {
      lines.push(`Mô tả / Đặc tính: ${product.description}`);
    } else {
      lines.push('Mô tả: (Chưa được cấp phép chia sẻ chi tiết mô tả)');
    }

    if (permissions.allow_price) {
      lines.push(`Khoảng giá: ${new Intl.NumberFormat('vi-VN').format(product.min_price)}đ - ${new Intl.NumberFormat('vi-VN').format(product.max_price)}đ`);
    } else {
      lines.push('Giá bán: (Seller tắt quyền công khai bảng giá qua bot)');
    }

    if (permissions.allow_variants && product.variants && product.variants.length > 0) {
      lines.push('Các phân loại / biến thể:');
      for (const v of product.variants) {
        const vName = v.variant_name ? `${v.variant_name} - ${v.variant_value}` : v.variant_value;
        const stockStr = permissions.allow_stock ? `(Còn ${v.stock_quantity} cái)` : '(Tồn kho: liên hệ Shop)';
        const priceStr = permissions.allow_price ? `${new Intl.NumberFormat('vi-VN').format(v.price)}đ` : '';
        lines.push(`- ${vName}: ${priceStr} ${stockStr}`.trim());
      }
    }

    lines.push('', '--- NGUYÊN TẮC BẮT BUỘC (GROUNDING & ANTI-HALLUCINATION) ---');
    lines.push('1. CHỐNG BỊA ĐẶT: Tuyệt đối chỉ trả lời dựa vào dữ liệu sản phẩm ở trên. Nếu thông tin không có trong dữ liệu (ví dụ: kích thước chi tiết, màu sắc không liệt kê, quà tặng riêng, chính sách bảo hành chưa ghi rõ), bạn PHẢI từ chối lịch sự và hướng dẫn khách bấm nút "Chat với Người Bán" để gặp chủ Shop.');
    lines.push('2. GIẢM GIÁ / MẶC CẢ / GIAO HỎA TỐC: Bạn không có quyền quyết định giảm giá riêng hay cam kết giao gấp. Hãy mời khách bấm "Chat với Người Bán".');
    lines.push('3. VĂN PHONG: Trả lời hoàn toàn bằng tiếng Việt, xưng "em", gọi khách là "bạn" hoặc "quý khách", thân thiện, ngắn gọn (1-3 câu).');

    return lines.join('\n');
  }
}
