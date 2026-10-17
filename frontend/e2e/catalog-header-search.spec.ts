import { test, expect } from "@playwright/test";

test.describe("Thanh tìm kiếm chung (SiteHeader Search)", () => {
  test("Gõ 'bàn phím' vào thanh tìm kiếm trên header và nhấn Enter lọc đúng sản phẩm trên trang /products", async ({ page }) => {
    page.on("console", (msg) => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
    page.on("requestfailed", (req) => console.log(`[REQUEST FAILED] ${req.url()} - ${req.failure()?.errorText}`));
    page.on("request", (req) => {
      if (req.url().includes("product") || req.url().includes("categor") || req.url().includes("api")) {
        console.log(`[REQ] ${req.method()} ${req.url()}`);
      }
    });
    page.on("response", async (res) => {
      if (res.url().includes("product") || res.url().includes("categor") || res.url().includes("api")) {
        console.log(`[RES] ${res.status()} ${res.url()}`);
      }
    });

    // 1. Điều hướng đến trang danh sách sản phẩm
    await page.goto("/products");

    // Đợi trang hydrate và tải sản phẩm ban đầu
    await expect(page.locator("article, .product-card").first()).toBeVisible({ timeout: 15000 });

    // 2. Tìm ô search chung trên SiteHeader
    const searchInput = page.locator('header form.header-search input[name="search"], header input[type="search"]');
    await expect(searchInput).toBeVisible();

    // 3. Nhập từ khóa 'bàn phím' và nhấn Enter
    await searchInput.fill("bàn phím");
    await searchInput.press("Enter");

    // 4. Kiểm tra URL đã được đồng bộ chính xác
    await expect(page).toHaveURL(/.*\/products\?search=b(%C3%A0n|\+)?.*ph(%C3%ADm|\+)?/i);

    // 5. Kiểm tra danh sách hiển thị đúng sản phẩm Bàn Phím Cơ Không Dây 3 Chế Độ
    const keyboardProduct = page.locator("article, .product-card").filter({ hasText: /bàn phím/i });
    await expect(keyboardProduct.first()).toBeVisible({ timeout: 10000 });
    await expect(keyboardProduct.first()).toContainText("Bàn Phím Cơ Không Dây 3 Chế Độ");

    // 6. Nhập từ khóa 'serum' và nhấn Enter
    await searchInput.fill("serum");
    await searchInput.press("Enter");
    await expect(page).toHaveURL(/.*\/products\?search=serum/i);
    const serumProduct = page.locator("article, .product-card").filter({ hasText: /serum/i });
    await expect(serumProduct.first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("article, .product-card").filter({ hasText: /bàn phím/i })).toHaveCount(0);

    // 7. Xóa ô tìm kiếm và nhấn Enter để reset lại danh sách tất cả sản phẩm
    await searchInput.fill("");
    await searchInput.press("Enter");
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.locator("article, .product-card").first()).toBeVisible({ timeout: 10000 });
  });
});
