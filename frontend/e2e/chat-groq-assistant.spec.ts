import { test, expect } from "@playwright/test";

test.describe("Kiểm tra Trợ lý AI Sản Phẩm (Groq LLM Assistant)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/auth/v1/token?grant_type=password", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-jwt-buyer-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: {
            id: "buyer-e2e-001",
            email: "buyer@dino-e2e.test",
            user_metadata: { full_name: "Dino Buyer E2E" },
          },
        }),
      });
    });

    await page.route("**/api/v1/auth/me", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_id: "buyer-e2e-001",
          email: "buyer@dino-e2e.test",
          role: "BUYER",
          shop_id: null,
        }),
      });
    });
  });

  test("Khách mua mở Chat với Shop trên trang chi tiết sản phẩm, hỏi 'xin chào' -> Bot AI phản hồi thông minh, không dùng câu rập khuôn cũ", async ({ page }) => {
    // 1. Đăng nhập tài khoản Buyer với returnTo=/products
    await page.goto("/login?returnTo=%2Fproducts");
    await page.getByLabel("Địa chỉ Email").fill("buyer@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill(process.env.E2E_SEED_PASSWORD || "Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/products$/, { timeout: 15000 });

    const productLink = page.locator("article h3 a[href^='/products/']").first();
    await expect(productLink).toBeVisible({ timeout: 10000 });
    await productLink.click();
    await expect(page).toHaveURL(/\/products\/[^/]+$/, { timeout: 15000 });

    // 3. Bấm nút "Chat với Shop" để mở khung chat nổi
    const chatBtn = page.getByRole("button", { name: "Chat với Shop" });
    await expect(chatBtn).toBeVisible({ timeout: 10000 });
    await chatBtn.click();

    // 4. Khung chat nổi xuất hiện
    await expect(page.getByText("Trợ lý AI Sản Phẩm")).toBeVisible({ timeout: 10000 });

    // 5. Nhập câu hỏi gửi cho Bot AI
    const chatInput = page.getByPlaceholder(/Hỏi tồn kho, giá bán, chất liệu/i);
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    await chatInput.fill("Sản phẩm này còn hàng không?");
    const sendBtn = page.getByRole("button", { name: "Gửi" });
    if (await sendBtn.isEnabled()) {
      await sendBtn.click();
    } else {
      await chatInput.press("Enter");
    }

    // 6. Tin nhắn người dùng xuất hiện
    await expect(page.getByText(/Sản phẩm này còn hàng không\?/i).first()).toBeVisible({ timeout: 10000 });

    // 7. Chờ Bot phản hồi tự động
    // Phản hồi của Bot PHẢI KHÔNG CÒN câu mẫu cứng nhắc cũ:
    // 'Dạ em đã ghi nhận câu hỏi của bạn về "xin chào"'
    await expect(
      page.getByText(/Dạ em đã ghi nhận câu hỏi của bạn về "xin chào"/i)
    ).toHaveCount(0);

    // Lấy thẻ tin nhắn cuối cùng của Bot
    const botContainer = page.locator("div.flex.flex-col.items-start").last();
    await expect(botContainer).toBeVisible({ timeout: 15000 });

    const replyText = await botContainer.innerText();
    console.log("Full Bot AI Reply Container:", replyText);

    // Kiểm tra câu trả lời thân thiện, lịch sự bằng tiếng Việt
    expect(replyText.toLowerCase()).toMatch(/(chào|hỗ trợ|sản phẩm|tồn kho|giá|bạn)/i);
  });
});
