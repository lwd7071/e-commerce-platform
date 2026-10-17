import { test, expect } from "@playwright/test";

test.describe("Kiểm tra chống trùng mã SKU (Seller Product Create)", () => {
  test.beforeEach(async ({ page }) => {
    const createdSkus = new Set<string>();

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
        const variants = body.variants || [];
        for (const v of variants) {
          const sku = String(v.sku || "").trim().toLowerCase();
          if (createdSkus.has(sku)) {
            return route.fulfill({
              status: 409,
              contentType: "application/json",
              body: JSON.stringify({
                error: {
                  code: "SKU_CONFLICT",
                  message: `Mã SKU '${v.sku}' đã tồn tại trong gian hàng của bạn. Vui lòng chọn SKU khác.`,
                },
              }),
            });
          }
          createdSkus.add(sku);
        }
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              product_id: "prod-new-001",
              product_name: body.product_name,
              status: "ACTIVE",
            },
          }),
        });
      }
      return route.continue();
    });
  });

  test("Cảnh báo viền đỏ và từ chối khi tạo sản phẩm có mã SKU trùng lặp", async ({ page }) => {
    page.on("console", (msg) => console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`));

    // 1. Đăng nhập với tài khoản người bán
    await page.goto("/login?returnTo=%2Fseller%2Fproducts%2Fnew");
    await page.getByLabel("Địa chỉ Email").fill("seller-active@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill(process.env.E2E_SEED_PASSWORD || "Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    // 2. Chờ chuyển hướng đến trang tạo sản phẩm
    await expect(page).toHaveURL(/\/seller\/products\/new$/, { timeout: 15000 });
    await expect(page.locator("#product-name")).toBeVisible({ timeout: 10000 });

    // Test trường hợp 1: Trong cùng 1 sản phẩm, tạo 2 biến thể cố tình gõ cùng mã SKU (ví dụ: SKU-PROD-01)
    console.log("Kiểm tra trường hợp 1: 2 biến thể trong cùng 1 form cố tình trùng SKU...");
    await page.locator("#product-name").fill("Sản Phẩm Test SKU Trùng Biến Thể");

    // Bấm "+ Thêm biến thể"
    const addVariantBtn = page.getByRole("button", { name: "+ Thêm biến thể" });
    await addVariantBtn.click();

    // Biến thể 1 có SKU mặc định là SKU-PROD-01
    // Đặt biến thể 2 cũng có SKU là SKU-PROD-01
    const skuInputs = page.locator('input[id^="variant-sku-"]');
    await expect(skuInputs).toHaveCount(2);
    await skuInputs.nth(1).fill("SKU-PROD-01");

    // Bấm nút "Tạo sản phẩm mới"
    await page.getByRole("button", { name: "Tạo sản phẩm mới" }).click();

    // Kỳ vọng: Form báo lỗi và hiển thị thông báo trùng lặp với viền đỏ (field-error)
    const errorText = page.locator(".field-error, p:has-text('trùng lặp')").first();
    await expect(errorText).toBeVisible({ timeout: 5000 });
    const errContent = await errorText.innerText();
    console.log("Error displayed for intra-product SKU duplicate:", errContent);
    expect(errContent).toContain("bị trùng lặp");

    // Test trường hợp 2: Tạo sản phẩm 1 thành công với SKU duy nhất
    console.log("Kiểm tra trường hợp 2: Tạo sản phẩm 1 với SKU duy nhất...");
    // Xóa bớt biến thể thứ 2
    const removeVariantBtn = page.locator("button:has-text('Xóa biến thể')").first();
    await removeVariantBtn.click();

    const uniqueSuffix = Date.now().toString().slice(-6);
    const uniqueSku = `SKU-TEST-${uniqueSuffix}`;
    await skuInputs.first().fill(uniqueSku);

    // Bấm "Tạo sản phẩm mới"
    await page.getByRole("button", { name: "Tạo sản phẩm mới" }).click();

    // Đợi sản phẩm 1 được tạo và chuyển hướng về trang danh sách /seller/products
    await expect(page).toHaveURL(/\/seller\/products$/, { timeout: 15000 });

    // Test trường hợp 3: Quay lại tạo sản phẩm 2 với CÙNG MÃ SKU đã tồn tại trong gian hàng
    console.log("Kiểm tra trường hợp 3: Tạo sản phẩm 2 với SKU đã tồn tại trong Shop...");
    await page.goto("/seller/products/new");
    await expect(page.locator("#product-name")).toBeVisible({ timeout: 10000 });

    await page.locator("#product-name").fill("Sản Phẩm Test SKU Trùng Shop");
    const skuInputProd2 = page.locator('input[id^="variant-sku-"]').first();
    await skuInputProd2.fill(uniqueSku);

    // Bấm tạo sản phẩm
    await page.getByRole("button", { name: "Tạo sản phẩm mới" }).click();

    // Kỳ vọng: Hệ thống từ chối tạo, không chuyển trang, ô SKU hiển thị viền đỏ và thông báo xung đột
    await expect(page).toHaveURL(/\/seller\/products\/new$/);
    const conflictError = page.locator(".field-error, p:has-text('tồn tại')").first();
    await expect(conflictError).toBeVisible({ timeout: 5000 });
    const conflictMsg = await conflictError.innerText();
    console.log("Conflict message displayed on field:", conflictMsg);
    expect(conflictMsg).toContain("đã tồn tại");
  });
});
