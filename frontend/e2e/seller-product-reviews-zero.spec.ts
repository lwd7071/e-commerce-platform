import { test, expect } from "@playwright/test";

test.describe("Kiểm tra sản phẩm vừa tạo không có đánh giá/người mua mặc định", () => {
  let createdProductId = "";
  let createdProductName = "";

  test.beforeEach(async ({ page }) => {
    await page.route("**/auth/v1/token?grant_type=password", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-jwt-seller-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: {
            id: "seller-e2e-001",
            email: "seller-active@dino-e2e.test",
            user_metadata: { full_name: "Dino Seller E2E" },
          },
        }),
      });
    });

    await page.route("**/api/v1/auth/me", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_id: "seller-e2e-001",
          email: "seller-active@dino-e2e.test",
          role: "SELLER",
          shop_id: "00000000-0000-0000-0000-000000000001",
          shop_status: "ACTIVE",
        }),
      });
    });

    await page.route("**/api/v1/products", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() || {};
        createdProductName = body.product_name;
        createdProductId = `prod-zero-${Date.now().toString().slice(-6)}`;
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              product_id: createdProductId,
              product_name: createdProductName,
              status: "ACTIVE",
            },
          }),
        });
      }
      return route.continue();
    });

    await page.route("**/api/v1/seller/products*", async (route) => {
      if (createdProductId) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                product_id: createdProductId,
                product_name: createdProductName,
                min_price: "150000.00",
                max_price: "150000.00",
                total_stock: 10,
                status: "ACTIVE",
                created_at: new Date().toISOString(),
              },
            ],
            meta: { limit: 20, has_more: false, next_cursor: null },
          }),
        });
      }
      return route.continue();
    });

    await page.route(`**/api/v1/products/prod-zero-*`, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            product_id: createdProductId,
            shop_id: "00000000-0000-0000-0000-000000000001",
            category_id: "00000000-0000-0000-0000-000000000010",
            product_name: createdProductName,
            description: "Sản phẩm mới kiểm thử không có review",
            status: "ACTIVE",
            variants: [
              {
                variant_id: "var-zero-1",
                variant_name: "Tiêu chuẩn",
                sku: "SKU-ZERO-1",
                price: "150000.00",
                stock_quantity: 10,
                status: "ACTIVE",
              },
            ],
          },
        }),
      });
    });
  });
  test("Sản phẩm mới tạo phải có 0 đánh giá và không có người mua mặc định", async ({ page }) => {
    // 1. Đăng nhập với tài khoản người bán
    await page.goto("/login?returnTo=%2Fseller%2Fproducts%2Fnew");
    await page.getByLabel("Địa chỉ Email").fill("seller-active@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill(process.env.E2E_SEED_PASSWORD || "Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    // 2. Chờ chuyển hướng đến trang tạo sản phẩm
    await expect(page).toHaveURL(/\/seller\/products\/new$/, { timeout: 15000 });
    await expect(page.locator("#product-name")).toBeVisible({ timeout: 10000 });

    const uniqueId = Date.now().toString().slice(-6);
    const prodName = `Sản Phẩm Mới Không Có Review ${uniqueId}`;
    await page.locator("#product-name").fill(prodName);

    const skuInputs = page.locator('input[id^="variant-sku-"]');
    await skuInputs.first().fill(`SKU-ZERO-REV-${uniqueId}`);

    // Bấm Tạo sản phẩm mới
    await page.getByRole("button", { name: "Tạo sản phẩm mới" }).click();

    // Chờ điều hướng về trang quản lý /seller/products
    await expect(page).toHaveURL(/\/seller\/products$/, { timeout: 15000 });

    // Tìm sản phẩm vừa tạo trong bảng và lấy product_id
    const prodRow = page.locator("tr", { hasText: prodName });
    await expect(prodRow).toBeVisible({ timeout: 10000 });
    const idText = await prodRow.locator("div.font-mono").innerText();
    const productId = idText.replace("ID:", "").trim();
    console.log("Created product with ID:", productId);

    // 3. Truy cập vào trang chi tiết sản phẩm /products/[id]
    await page.goto(`/products/${productId}`);
    await expect(page.locator("h1")).toHaveText(prodName, { timeout: 10000 });

    // 4. Kiểm tra giao diện:
    // - Phải hiển thị "Chưa có đánh giá nào cho sản phẩm này"
    await expect(page.getByText("Chưa có đánh giá nào cho sản phẩm này").first()).toBeVisible();

    // - KHÔNG ĐƯỢC có thông tin "Người mua đã xác minh"
    await expect(page.getByText("Người mua đã xác minh")).toHaveCount(0);

    // - KHÔNG ĐƯỢC có nhận xét mặc định
    await expect(page.getByText("Sản phẩm chất lượng vượt mong đợi")).toHaveCount(0);

    // - KHÔNG ĐƯỢC có "1 đánh giá" hoặc "1 lượt đánh giá"
    await expect(page.getByText("(1 đánh giá)")).toHaveCount(0);
    await expect(page.getByText("1 lượt đánh giá")).toHaveCount(0);

    // 5. Kiểm tra sản phẩm có sẵn đánh giá vẫn hiển thị đúng đánh giá của riêng nó
    await page.goto("/products/4afa6af7-6756-4de6-9ab1-5751c91a5d6c");
    await expect(page.locator("h1")).toContainText("Serum Dưỡng Trắng");
    await expect(page.getByText("(1 đánh giá)")).toBeVisible();
    await expect(page.getByText("Người mua đã xác minh")).toBeVisible();
  });
});
