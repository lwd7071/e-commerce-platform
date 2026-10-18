import { test, expect } from "@playwright/test";

test.describe("Kiểm tra chức năng Ẩn / Hiện sản phẩm của Người bán", () => {
  let prodName = "";
  let productId = "";
  let currentStatus = "ACTIVE";

  test.beforeEach(async ({ page }) => {
    currentStatus = "ACTIVE";

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

    await page.route("**/api/v1/products*", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() || {};
        prodName = body.product_name;
        productId = `prod-hide-${Date.now().toString().slice(-6)}`;
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              product_id: productId,
              product_name: prodName,
              status: "ACTIVE",
            },
          }),
        });
      }

      if (route.request().method() === "GET" && !route.request().url().includes("/products/prod-hide")) {
        try {
          const response = await route.fetch();
          const json = await response.json();
          if (currentStatus === "ACTIVE" && prodName) {
            const testItem = {
              product_id: productId,
              product_name: prodName,
              shop_id: "00000000-0000-0000-0000-000000000001",
              category_id: "00000000-0000-0000-0000-000000000010",
              min_price: "150000.00",
              max_price: "150000.00",
              total_stock: 10,
              image_url: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800",
              created_at: new Date().toISOString(),
              status: "ACTIVE",
            };
            if (Array.isArray(json.data)) {
              json.data.unshift(testItem);
            }
          }
          return route.fulfill({ response, json });
        } catch {
          return route.continue();
        }
      }

      return route.continue();
    });

    await page.route("**/api/v1/products/*/status", async (route) => {
      const body = route.request().postDataJSON() || {};
      currentStatus = body.status || "ACTIVE";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { product_id: productId, status: currentStatus },
        }),
      });
    });

    await page.route("**/api/v1/seller/products*", async (route) => {
      if (productId) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                product_id: productId,
                product_name: prodName,
                min_price: "150000.00",
                max_price: "150000.00",
                total_stock: 10,
                status: currentStatus,
                created_at: new Date().toISOString(),
              },
            ],
            meta: { limit: 20, has_more: false, next_cursor: null },
          }),
        });
      }
      return route.continue();
    });

    await page.route(`**/api/v1/products/prod-hide-*`, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            product_id: productId,
            shop_id: "00000000-0000-0000-0000-000000000001",
            category_id: "00000000-0000-0000-0000-000000000010",
            product_name: prodName,
            status: currentStatus,
            variants: [
              {
                variant_id: "var-hide-1",
                variant_name: "Tiêu chuẩn",
                sku: "SKU-HIDE-1",
                price: "150000.00",
                stock_quantity: 10,
                status: currentStatus,
              },
            ],
          },
        }),
      });
    });
  });
  test("Khi người bán ẩn sản phẩm, sản phẩm biến mất khỏi /products và báo ngừng kinh doanh tại trang chi tiết", async ({ page }) => {
    // 1. Đăng nhập với tài khoản người bán
    await page.goto("/login?returnTo=%2Fseller%2Fproducts%2Fnew");
    await page.getByLabel("Địa chỉ Email").fill("seller-active@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill(process.env.E2E_SEED_PASSWORD || "Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/seller\/products\/new$/, { timeout: 15000 });
    await expect(page.locator("#product-name")).toBeVisible({ timeout: 10000 });

    // 2. Tạo một sản phẩm mới để test ẩn/hiện
    const uniqueId = Date.now().toString().slice(-6);
    const prodName = `Sản Phẩm Test Ẩn Hiện ${uniqueId}`;
    await page.locator("#product-name").fill(prodName);

    const skuInputs = page.locator('input[id^="variant-sku-"]');
    await skuInputs.first().fill(`SKU-HIDE-${uniqueId}`);

    await page.getByRole("button", { name: "Tạo sản phẩm mới" }).click();
    await expect(page).toHaveURL(/\/seller\/products$/, { timeout: 15000 });

    // Lấy thông tin dòng sản phẩm và ID
    const prodRow = page.locator("tr", { hasText: prodName });
    await expect(prodRow).toBeVisible({ timeout: 10000 });
    const idText = await prodRow.locator("div.font-mono").innerText();
    const productId = idText.replace("ID:", "").trim();
    console.log("Product created for hide/show test:", prodName, productId);

    // 3. Kiểm tra sản phẩm đang hiển thị trên trang mua hàng /products
    await page.goto("/products");
    await expect(page.getByText(prodName)).toBeVisible({ timeout: 10000 });

    // 4. Quay lại /seller/products và bấm nút "Ẩn"
    await page.goto("/seller/products");
    const targetRow = page.locator("tr", { hasText: prodName });
    await expect(targetRow).toBeVisible({ timeout: 10000 });

    // Nút ban đầu là "Ẩn", badge là "Đang bán"
    await expect(targetRow.getByText("Đang bán")).toBeVisible();
    const hideBtn = targetRow.getByRole("button", { name: "Ẩn", exact: true });
    await expect(hideBtn).toBeVisible();
    await hideBtn.click();

    // Kiểm tra trạng thái đã chuyển sang "Đã ẩn" và nút đổi thành "Hiện"
    await expect(targetRow.getByText("Đã ẩn")).toBeVisible({ timeout: 5000 });
    await expect(targetRow.getByRole("button", { name: "Hiện", exact: true })).toBeVisible();

    // 5. Quay lại trang /products -> Sản phẩm KHÔNG ĐƯỢC PHÉP hiển thị
    await page.goto("/products");
    await expect(page.getByText(prodName)).toHaveCount(0);

    // 6. Truy cập trực tiếp vào link /products/[id] -> Hiển thị EmptyState ngừng kinh doanh
    await page.goto(`/products/${productId}`);
    await expect(page.getByText("Không tìm thấy sản phẩm")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Sản phẩm này không tồn tại hoặc đã ngừng kinh doanh.")).toBeVisible();

    // 7. Quay lại /seller/products và bấm nút "Hiện" để khôi phục
    await page.goto("/seller/products");
    const restoreRow = page.locator("tr", { hasText: prodName });
    await expect(restoreRow).toBeVisible({ timeout: 10000 });
    const showBtn = restoreRow.getByRole("button", { name: "Hiện", exact: true });
    await showBtn.click();

    // Badge chuyển lại thành "Đang bán", nút chuyển lại thành "Ẩn"
    await expect(restoreRow.getByText("Đang bán")).toBeVisible({ timeout: 5000 });
    await expect(restoreRow.getByRole("button", { name: "Ẩn", exact: true })).toBeVisible();

    // 8. Quay lại /products -> Sản phẩm xuất hiện trở lại
    await page.goto("/products");
    await expect(page.getByText(prodName)).toBeVisible({ timeout: 10000 });
  });
});
