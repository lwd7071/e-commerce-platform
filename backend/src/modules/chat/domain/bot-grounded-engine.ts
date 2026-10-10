import type { GroundedProductContext, GroundedProductVariant, ProductBotPermissions } from './types.ts';

export interface BotEvaluationResult {
  content: string;
  canHandoff: boolean;
  isAutomated: boolean;
  suggestHandoff: boolean;
  attributesUsed: string[];
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export class BotGroundedEngine {
  /**
   * Sinh câu trả lời tự động cho câu hỏi của Buyer dựa trên ngữ cảnh sản phẩm được cấp phép (Context-grounded).
   * Tuân thủ triệt để:
   * 1. Chỉ tra cứu thông tin sản phẩm trong ngữ cảnh (Scoped).
   * 2. Tôn trọng bộ cờ quyền seller cho phép (allow_stock, allow_price, allow_variants, allow_description).
   * 3. Chống bịa đặt (Anti-hallucination): Nếu không có trong mô tả/dữ liệu thì từ chối và đề xuất hand-off gặp Shop.
   * 4. Không dùng thông tin cá nhân hay lịch sử người dùng.
   */
  evaluate(
    question: string,
    product: GroundedProductContext | null,
    permissions: ProductBotPermissions
  ): BotEvaluationResult {
    const rawQ = question.trim();
    const q = normalize(rawQ);

    // Không có ngữ cảnh sản phẩm
    if (!product) {
      return {
        content:
          'Dạ em là trợ lý tự động của sàn Dino. Hiện tại phiên chat chưa được gắn với sản phẩm cụ thể nào. Bạn vui lòng bấm "Chat với Shop" từ trang chi tiết sản phẩm để em hỗ trợ tra cứu tồn kho, giá bán và chất liệu chính xác nhất ạ!',
        canHandoff: true,
        isAutomated: true,
        suggestHandoff: true,
        attributesUsed: [],
      };
    }

    // Khách chủ động muốn gặp Shop hoặc người thật
    if (
      q.includes('gap shop') ||
      q.includes('gap nguoi ban') ||
      q.includes('nguoi that') ||
      q.includes('nhan vien') ||
      q.includes('tu van vien') ||
      q.includes('gap chu shop')
    ) {
      return {
        content: `Dạ em đã ghi nhận yêu cầu kết nối với Shop **${product.shop_name ?? 'của sản phẩm'}**. Bạn vui lòng bấm nút "Chat với Người Bán" bên dưới để chuyển sang chat trực tiếp với người thật nhé!`,
        canHandoff: true,
        isAutomated: true,
        suggestHandoff: true,
        attributesUsed: ['shop_name'],
      };
    }

    // Các yêu cầu thương lượng, giao gấp, mặc cả, đổi địa chỉ -> Phải do Shop quyết định
    if (
      q.includes('giam gia') ||
      q.includes('bot gia') ||
      q.includes('mac ca') ||
      q.includes('fix gia') ||
      q.includes('giao hoa toc') ||
      q.includes('ship gap') ||
      q.includes('giao trong ngay') ||
      q.includes('tang qua') ||
      q.includes('khuyen mai them') ||
      q.includes('doi dia chi') ||
      q.includes('freeship rieng')
    ) {
      return {
        content:
          'Dạ các yêu cầu về ưu đãi riêng, giao gấp hoặc thương lượng giá cần Shop trực tiếp kiểm tra và quyết định ạ. Em chưa được cấp quyền xử lý mục này. Bạn vui lòng bấm "Chat với Người Bán" để trao đổi trực tiếp với Shop nhé!',
        canHandoff: true,
        isAutomated: true,
        suggestHandoff: true,
        attributesUsed: [],
      };
    }

    // Lời chào mở đầu
    if (
      q === 'xin chao' ||
      q === 'chao ban' ||
      q === 'chao shop' ||
      q === 'hello' ||
      q === 'hi' ||
      q === 'alo' ||
      q === 'shop oi'
    ) {
      return {
        content: `Dạ em chào bạn! Em là trợ lý tự động của Shop hỗ trợ thông tin sản phẩm **${product.product_name}**. Em có thể giải đáp nhanh cho bạn về số lượng tồn kho, giá bán các phân loại hoặc chất liệu sản phẩm. Bạn cần em hỗ trợ gì ạ?`,
        canHandoff: true,
        isAutomated: true,
        suggestHandoff: false,
        attributesUsed: ['product_name'],
      };
    }

    // Tìm xem khách có nhắc đến phân loại cụ thể nào không
    const matchedVariant = this.findMatchingVariant(q, product.variants);

    // 1. Hỏi về Tồn kho / Số lượng
    if (
      q.includes('ton kho') ||
      q.includes('con hang') ||
      q.includes('het hang') ||
      q.includes('bao nhieu cai') ||
      q.includes('so luong') ||
      q.includes('con bao nhieu') ||
      q.includes('co san khong') ||
      q.includes('con khong')
    ) {
      if (!permissions.allow_stock) {
        return {
          content:
            'Dạ Shop hiện chưa bật tính năng công khai số lượng tồn kho tự động cho bot. Bạn vui lòng bấm nút "Chat với Người Bán" để Shop kiểm tra kho và phản hồi bạn ngay nhé!',
          canHandoff: true,
          isAutomated: true,
          suggestHandoff: true,
          attributesUsed: [],
        };
      }

      if (matchedVariant) {
        const vName = matchedVariant.variant_name || matchedVariant.variant_value;
        if (matchedVariant.stock_quantity > 0) {
          return {
            content: `Dạ sản phẩm **${product.product_name}** phân loại **${vName}** hiện còn **${matchedVariant.stock_quantity}** sản phẩm trong kho (giá ${formatVnd(matchedVariant.price)}) ạ.`,
            canHandoff: true,
            isAutomated: true,
            suggestHandoff: false,
            attributesUsed: ['variants', 'stock_quantity'],
          };
        } else {
          const availableOther = product.variants.filter((v) => v.stock_quantity > 0);
          const otherNames = availableOther.map((v) => v.variant_name || v.variant_value).join(', ');
          return {
            content: `Dạ rất tiếc phân loại **${vName}** hiện tại đã tạm hết hàng trong kho rồi ạ.${
              otherNames ? ` Bạn có thể tham khảo các phân loại khác đang còn hàng: ${otherNames}.` : ''
            } Bạn có muốn nhắn Shop để hỏi đợt hàng về tiếp theo không ạ?`,
            canHandoff: true,
            isAutomated: true,
            suggestHandoff: true,
            attributesUsed: ['variants', 'stock_quantity'],
          };
        }
      }

      // Tổng quan tồn kho nếu không chỉ định biến thể
      const totalStock = product.variants.reduce((acc, v) => acc + (v.stock_quantity || 0), 0);
      if (totalStock > 0) {
        const variantSummary = product.variants
          .map((v) => `• ${v.variant_name || v.variant_value}: còn ${v.stock_quantity} cái`)
          .join('\n');
        return {
          content: `Dạ sản phẩm **${product.product_name}** hiện còn tổng cộng **${totalStock}** sản phẩm trong kho theo từng phân loại:\n${variantSummary}\n\nBạn quan tâm phân loại nào để em tư vấn thêm ạ?`,
          canHandoff: true,
          isAutomated: true,
          suggestHandoff: false,
          attributesUsed: ['variants', 'stock_quantity'],
        };
      } else {
        return {
          content: `Dạ sản phẩm **${product.product_name}** hiện tại đã tạm hết hàng toàn bộ phân loại trong kho ạ. Bạn có muốn nhắn tin với Shop để cập nhật khi có hàng mới về không ạ?`,
          canHandoff: true,
          isAutomated: true,
          suggestHandoff: true,
          attributesUsed: ['variants', 'stock_quantity'],
        };
      }
    }

    // 2. Hỏi về Giá bán
    if (
      q.includes('gia') ||
      q.includes('bao nhieu tien') ||
      q.includes('nhieu tien') ||
      q.includes('bao nhieu') ||
      q.includes('bang gia') ||
      q.includes('chi phi')
    ) {
      if (!permissions.allow_price) {
        return {
          content:
            'Dạ Shop không công khai bảng giá qua bot tự động. Bạn vui lòng bấm nút "Chat với Người Bán" để Shop báo giá chính xác cho bạn nhé!',
          canHandoff: true,
          isAutomated: true,
          suggestHandoff: true,
          attributesUsed: [],
        };
      }

      if (matchedVariant) {
        const vName = matchedVariant.variant_name || matchedVariant.variant_value;
        return {
          content: `Dạ phân loại **${vName}** của sản phẩm có giá niêm yết là **${formatVnd(matchedVariant.price)}** ạ.`,
          canHandoff: true,
          isAutomated: true,
          suggestHandoff: false,
          attributesUsed: ['variants', 'price'],
        };
      }

      const prices = product.variants.map((v) => v.price).filter((p) => typeof p === 'number' && p > 0);
      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceText =
          minPrice === maxPrice
            ? formatVnd(minPrice)
            : `${formatVnd(minPrice)} - ${formatVnd(maxPrice)}`;
        const listText = product.variants
          .map((v) => `• ${v.variant_name || v.variant_value}: ${formatVnd(v.price)}`)
          .join('\n');
        return {
          content: `Dạ sản phẩm **${product.product_name}** hiện có mức giá **${priceText}** tùy theo phân loại:\n${listText}`,
          canHandoff: true,
          isAutomated: true,
          suggestHandoff: false,
          attributesUsed: ['variants', 'price'],
        };
      }
    }

    // 3. Hỏi về Phân loại / Biến thể / Màu sắc / Kích thước
    if (
      q.includes('phan loai') ||
      q.includes('mau sac') ||
      q.includes('co nhung mau gi') ||
      q.includes('co mau gi') ||
      q.includes('kich thuoc') ||
      q.includes('size gi') ||
      q.includes('co size nao')
    ) {
      if (!permissions.allow_variants) {
        return {
          content:
            'Dạ danh mục phân loại chưa được mở cho bot tự động. Bạn hãy bấm "Chat với Người Bán" để được tư vấn kích thước và màu sắc phù hợp nhé!',
          canHandoff: true,
          isAutomated: true,
          suggestHandoff: true,
          attributesUsed: [],
        };
      }

      const options = product.variants.map((v) => v.variant_name || v.variant_value).join(', ');
      return {
        content: `Dạ sản phẩm **${product.product_name}** hiện có các phân loại sau:\n${options}.\nBạn có thể chọn phân loại trực tiếp trên trang sản phẩm để xem ảnh và số lượng chi tiết ạ.`,
        canHandoff: true,
        isAutomated: true,
        suggestHandoff: false,
        attributesUsed: ['variants'],
      };
    }

    // 4. Hỏi về Chất liệu / Mô tả / Bảo hành / Xuất xứ
    const isDescriptionQuery =
      q.includes('chat lieu') ||
      q.includes('lam bang gi') ||
      q.includes('vai gi') ||
      q.includes('xuat xu') ||
      q.includes('san xuat o dau') ||
      q.includes('nguon goc') ||
      q.includes('bao hanh') ||
      q.includes('chinh sach doi tra') ||
      q.includes('doi tra') ||
      q.includes('huong dan su dung') ||
      q.includes('bao quan') ||
      q.includes('kich co') ||
      q.includes('cong dung') ||
      q.includes('tinh nang') ||
      q.includes('thong so') ||
      q.includes('mo ta');

    if (isDescriptionQuery) {
      if (!permissions.allow_description) {
        return {
          content:
            'Dạ mô tả chi tiết của sản phẩm này chưa được chia sẻ cho bot. Bạn hãy bấm "Chat với Người Bán" để Shop giải đáp cụ thể nhé!',
          canHandoff: true,
          isAutomated: true,
          suggestHandoff: true,
          attributesUsed: [],
        };
      }

      // Trích xuất đoạn phù hợp trong mô tả
      const snippet = this.findDescriptionSnippet(rawQ, product.description);
      if (snippet) {
        return {
          content: `Dạ thông tin từ mô tả sản phẩm của Shop như sau:\n\n> "${snippet}"\n\nNếu cần biết thêm chi tiết chưa có trong mô tả, bạn có thể bấm "Chat với Người Bán" nhé!`,
          canHandoff: true,
          isAutomated: true,
          suggestHandoff: false,
          attributesUsed: ['description'],
        };
      } else {
        // Chống ảo giác: Không có trong mô tả -> Từ chối thẳng thắn
        return {
          content: `Dạ em đã rà soát kỹ mô tả sản phẩm của Shop nhưng chưa thấy thông tin chi tiết về nội dung bạn hỏi. Để đảm bảo thông tin chính xác nhất, em mời bạn bấm nút "Chat với Người Bán" bên dưới để Shop giải đáp trực tiếp cho bạn nhé!`,
          canHandoff: true,
          isAutomated: true,
          suggestHandoff: true,
          attributesUsed: ['description'],
        };
      }
    }

    // 5. Fallback thông minh: Thử tìm trong mô tả xem có liên quan không
    if (permissions.allow_description && product.description) {
      const fallbackSnippet = this.findDescriptionSnippet(rawQ, product.description);
      if (fallbackSnippet) {
        return {
          content: `Dạ dựa trên thông tin mô tả sản phẩm:\n\n> "${fallbackSnippet}"\n\nBạn có muốn trao đổi thêm trực tiếp với Shop không ạ?`,
          canHandoff: true,
          isAutomated: true,
          suggestHandoff: false,
          attributesUsed: ['description'],
        };
      }
    }

    // 6. Fallback cuối cùng: Chống bịa đặt (Anti-hallucination)
    return {
      content: `Dạ câu hỏi của bạn hiện chưa có dữ liệu trong thông tin sản phẩm mà Shop cung cấp. Em là trợ lý tự động nên không được phép suy đoán sai lệch. Bạn vui lòng bấm nút "Chat với Người Bán" để Shop hỗ trợ bạn trực tiếp ngay nhé!`,
      canHandoff: true,
      isAutomated: true,
      suggestHandoff: true,
      attributesUsed: [],
    };
  }

  private findMatchingVariant(
    normalizedQuestion: string,
    variants: GroundedProductVariant[]
  ): GroundedProductVariant | null {
    const cleanQ = normalizedQuestion.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const v of variants) {
      const nameNorm = normalize(v.variant_name || '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const valNorm = normalize(v.variant_value || '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      if ((nameNorm && cleanQ.includes(nameNorm)) || (valNorm && cleanQ.includes(valNorm))) {
        return v;
      }
    }
    return null;
  }

  private findDescriptionSnippet(rawQuestion: string, description?: string): string | null {
    if (!description || description.trim().length === 0) return null;

    const stopWords = new Set([
      'cho', 'hoi', 'shop', 'san', 'pham', 'nay', 'co', 'khong', 'the', 'nao',
      'duoc', 'minh', 'ban', 'voi', 'cua', 'va', 'cac', 'mot', 'nhung', 'o',
      'tai', 'trong', 'ra', 'vao', 'di', 'lai', 'lam', 'nhu', 'gi', 'cuc', 'rat',
      'ao', 'quan', 'hang', 'vay', 'nhe', 'a', 'da'
    ]);

    const keywords = normalize(rawQuestion)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w));

    if (keywords.length === 0) return null;

    const lines = description.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const matchedLines: string[] = [];

    for (const line of lines) {
      const lineNorm = normalize(line);
      const matchingKeywords = keywords.filter((kw) => lineNorm.includes(kw));
      const hasSignificantMatch =
        matchingKeywords.length >= 2 ||
        matchingKeywords.some((kw) => kw.length >= 6);

      if (hasSignificantMatch) {
        matchedLines.push(line);
      }
    }

    if (matchedLines.length > 0) {
      return matchedLines.slice(0, 3).join('\n');
    }

    return null;
  }
}
