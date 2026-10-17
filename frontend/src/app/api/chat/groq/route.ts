import { NextResponse } from "next/server";

// Cấu hình GroqCloud LPU Inference
const GROQ_API_KEY =
  process.env.GROQ_API_KEY ||
  process.env.NEXT_PUBLIC_GROQ_API_KEY ||
  "";
const GROQ_BASE_URL =
  process.env.GROQ_API_BASE_URL || "https://api.groq.com/openai/v1";
const GROQ_MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export interface ChatProductVariant {
  variant_name?: string;
  variant_value?: string;
  price?: number | string;
  stock_quantity?: number;
}

export interface ChatProductContext {
  product_id?: string;
  product_name: string;
  shop_name?: string;
  min_price?: number | string;
  max_price?: number | string;
  total_stock?: number;
  description?: string;
  variants?: ChatProductVariant[];
}

function formatVnd(amount: number | string | undefined): string {
  if (amount === undefined || amount === null) return "";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return String(amount);
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
}

function evaluateFallbackRules(
  question: string,
  product: ChatProductContext | null
): string {
  const q = question.toLowerCase().trim();
  const prodName = product?.product_name || "sản phẩm này";
  const shopName = product?.shop_name || "Shop";

  if (
    q === "xin chao" ||
    q === "chao ban" ||
    q === "chao shop" ||
    q === "hello" ||
    q === "hi" ||
    q === "alo" ||
    q === "shop oi"
  ) {
    const priceRange = product?.min_price
      ? ` (giá từ ${formatVnd(product.min_price)})`
      : "";
    const stockInfo =
      product?.total_stock !== undefined
        ? ` hiện còn ${product.total_stock} sản phẩm`
        : " đang có sẵn";
    return `Dạ em chào bạn ạ! Em là Trợ lý AI của gian hàng **${shopName}**. Em có thể giải đáp nhanh thông tin về **${prodName}**${priceRange}, tình trạng kho hàng${stockInfo} hoặc tư vấn chất liệu. Bạn cần em hỗ trợ gì ạ?`;
  }

  if (
    q.includes("ton kho") ||
    q.includes("con hang") ||
    q.includes("het hang") ||
    q.includes("so luong") ||
    q.includes("con bao nhieu") ||
    q.includes("co san khong")
  ) {
    const total = product?.total_stock ?? 0;
    if (total > 0) {
      const variantList = product?.variants && product.variants.length > 0
        ? ` Đầy đủ các phân loại: ${product.variants.map((v) => `${v.variant_value || v.variant_name} (${v.stock_quantity ?? 0} cái)`).join(", ")}.`
        : "";
      return `Dạ sản phẩm **${prodName}** hiện vẫn còn hàng trong kho với tổng cộng **${total}** sản phẩm sẵn sàng giao ạ!${variantList} Bạn có muốn đặt mua ngay không ạ?`;
    }
    return `Dạ sản phẩm **${prodName}** hiện tại đang tạm hết hàng trong kho rồi ạ. Bạn có thể bấm "Chat với Người Bán" để Shop thông báo ngay khi có hàng về nhé!`;
  }

  if (
    q.includes("gia") ||
    q.includes("bao nhieu tien") ||
    q.includes("nhieu tien") ||
    q.includes("gia ca")
  ) {
    if (product?.min_price) {
      const minP = formatVnd(product.min_price);
      const maxP = formatVnd(product.max_price ?? product.min_price);
      const range = minP === maxP ? minP : `${minP} - ${maxP}`;
      return `Dạ sản phẩm **${prodName}** đang có mức giá niêm yết chính hãng là **${range}** ạ! Giá đã bao gồm thuế và các ưu đãi hiện hành của Shop.`;
    }
    return `Dạ sản phẩm **${prodName}** có mức giá cập nhật trực tiếp trên trang chi tiết ạ. Bạn có thể xem ngay trên phần giá bên cạnh ảnh sản phẩm nhé!`;
  }

  if (
    q.includes("chat lieu") ||
    q.includes("vai") ||
    q.includes("mo ta") ||
    q.includes("thanh phan")
  ) {
    if (product?.description) {
      return `Dạ thông tin chi tiết về sản phẩm **${prodName}**: ${product.description}. Bạn cần tư vấn thêm về cách sử dụng hay chọn size không ạ?`;
    }
    return `Dạ sản phẩm **${prodName}** được sản xuất với tiêu chuẩn chất lượng cao, đúng như mô tả và hình ảnh gian hàng cung cấp ạ!`;
  }

  if (
    q.includes("giam gia") ||
    q.includes("bot gia") ||
    q.includes("mac ca") ||
    q.includes("ship gap") ||
    q.includes("giao hoa toc")
  ) {
    return `Dạ các yêu cầu về ưu đãi riêng, giao hỏa tốc hoặc thương lượng giá cần Shop trực tiếp kiểm tra và phê duyệt ạ. Bạn vui lòng bấm nút "Chat với Người Bán" bên dưới để trao đổi trực tiếp với nhân viên Shop nhé!`;
  }

  return `Dạ em là trợ lý tự động của Shop hỗ trợ thông tin sản phẩm **${prodName}**. Em có thể giải đáp nhanh về giá bán, số lượng tồn kho và các phân loại hàng. Nếu bạn cần Shop hỗ trợ kỹ hơn, bạn có thể bấm nút "Chat với Người Bán" bất kỳ lúc nào nhé!`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, product } = body as {
      question?: string;
      product?: ChatProductContext;
    };

    if (!question || !question.trim()) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const trimmedQ = question.trim();

    // 1. Nếu có cấu hình GroqCloud, gọi Groq API LPU Inference
    if (GROQ_API_KEY && GROQ_API_KEY.startsWith("gsk_")) {
      const systemPrompt = `Bạn là Trợ lý AI CSKH đại diện cho gian hàng "${product?.shop_name || "Dino Official Store"}" trên sàn TMĐT Dino.
Khách hàng đang xem sản phẩm: "${product?.product_name || "Sản phẩm"}".

--- DỮ LIỆU SẢN PHẨM HIỆN TẠI ---
- Tên sản phẩm: ${product?.product_name || "Đang xem sản phẩm"}
- Tồn kho: ${product?.total_stock !== undefined ? `${product.total_stock} sản phẩm` : "Còn hàng"}
- Khoảng giá: ${product?.min_price ? `${formatVnd(product.min_price)} - ${formatVnd(product.max_price ?? product.min_price)}` : "Xem trên trang"}
- Mô tả / Chất liệu: ${product?.description || "Sản phẩm chính hãng chất lượng cao"}
${product?.variants && product.variants.length > 0 ? `- Các phân loại: ${product.variants.map((v) => `${v.variant_value || v.variant_name} (${formatVnd(v.price)}${v.stock_quantity !== undefined ? `, còn ${v.stock_quantity}` : ""})`).join("; ")}` : ""}

--- NGUYÊN TẮC BẮT BUỘC ---
1. CHỐNG BỊA ĐẶT: Tuyệt đối chỉ trả lời dựa vào dữ liệu sản phẩm ở trên. Nếu thông tin không có trong dữ liệu (ví dụ: yêu cầu giảm giá riêng, giao gấp trong 1 giờ, quà tặng bí mật), hãy lịch sự hướng dẫn khách bấm nút "Chat với Người Bán" để gặp chủ Shop.
2. VĂN PHONG: Trả lời tự nhiên, thân thiện bằng tiếng Việt, xưng "em", gọi khách là "bạn" hoặc "quý khách", súc tích, ngắn gọn (1 đến 3 câu).`;

      try {
        // Tắt TLS check nếu gặp self-signed root cert trên local Windows dev
        if (typeof process !== "undefined" && process.env) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const groqRes = await fetch(`${GROQ_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: trimmedQ },
            ],
            temperature: 0.3,
            max_tokens: 350,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (groqRes.ok) {
          const data = await groqRes.json();
          const aiReply = data.choices?.[0]?.message?.content?.trim();
          if (aiReply) {
            const needsHandoff =
              trimmedQ.toLowerCase().includes("gap shop") ||
              trimmedQ.toLowerCase().includes("nguoi ban") ||
              trimmedQ.toLowerCase().includes("mac ca") ||
              trimmedQ.toLowerCase().includes("giam gia") ||
              aiReply.toLowerCase().includes("chat với người bán");

            return NextResponse.json({
              content: aiReply,
              suggestHandoff: needsHandoff,
              source: "groq_lpu",
            });
          }
        }
      } catch (groqErr) {
        console.warn("[ChatAPI] Groq fetch error, falling back to grounded rules:", groqErr);
      }
    }

    // 2. Fallback sang Grounded Rule Engine
    const fallbackContent = evaluateFallbackRules(trimmedQ, product || null);
    return NextResponse.json({
      content: fallbackContent,
      suggestHandoff:
        trimmedQ.toLowerCase().includes("giam gia") ||
        trimmedQ.toLowerCase().includes("mac ca") ||
        trimmedQ.toLowerCase().includes("gap shop"),
      source: "grounded_engine",
    });
  } catch (error) {
    console.error("[ChatAPI] Error handling chat message:", error);
    return NextResponse.json(
      { content: "Dạ em đã nhận được tin nhắn của bạn. Em có thể hỗ trợ kiểm tra tồn kho và giá bán sản phẩm ạ!" },
      { status: 500 }
    );
  }
}
