import { test, expect } from "@playwright/test";

test.describe("Bộ lọc khoảng giá (Catalog Price Filter)", () => {
  test("Nhập khoảng giá và kiểm tra lọc sản phẩm", async ({ page }) => {
    page.on("console", (msg) => console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`));
    page.on("request", (req) => {
      if (req.url().includes("/products") || req.url().includes("/api/v1/products")) {
        console.log(`[REQ] ${req.method()} ${req.url()}`);
      }
    });
    page.on("response", async (res) => {
      if (res.url().includes("/products") || res.url().includes("/api/v1/products")) {
        console.log(`[RES] ${res.status()} ${res.url()}`);
      }
    });

    await page.goto("/products");
    await expect(page.locator("article, .product-card").first()).toBeVisible({ timeout: 15000 });

    const initialCount = await page.locator("article, .product-card").count();
    console.log("Initial products count:", initialCount);
    expect(initialCount).toBeGreaterThanOrEqual(4);

    const minInput = page.locator("input[type='number']").first();
    const maxInput = page.locator("input[type='number']").nth(1);
    const applyButton = page.getByRole("button", { name: "Áp dụng khoảng giá" });

    // Test 1: Lọc Giá từ 800.000đ -> Chỉ còn Bàn phím cơ
    console.log("Setting minPrice to 800000 and clicking Apply...");
    await minInput.fill("800000");
    await applyButton.click();
    await page.waitForTimeout(500);

    const titlesMin = await page.locator("article h3, .product-card h3").allInnerTexts();
    console.log("Titles with min=800k:", titlesMin);
    expect(titlesMin.length).toBeGreaterThanOrEqual(1);
    expect(titlesMin.some((t) => t.includes("Bàn Phím Cơ"))).toBe(true);

    // Test 2: Bấm nút "Xóa" khoảng giá -> Danh sách quay lại đầy đủ
    const clearButton = page.getByRole("button", { name: "Xóa khoảng giá" });
    await clearButton.click();
    await page.waitForTimeout(500);

    const titlesReset = await page.locator("article h3, .product-card h3").allInnerTexts();
    console.log("Titles after clear:", titlesReset);
    expect(titlesReset.length).toBeGreaterThanOrEqual(4);

    // Test 3: Lọc Đến 300.000đ bằng phím Enter -> Chỉ các sản phẩm có giá <= 300k
    console.log("Setting maxPrice to 300000 and pressing Enter...");
    await maxInput.fill("300000");
    await maxInput.press("Enter");
    await page.waitForTimeout(500);

    const titlesMax = await page.locator("article h3, .product-card h3").allInnerTexts();
    console.log("Titles with max=300k:", titlesMax);
    expect(titlesMax.length).toBeGreaterThan(0);
    // Bàn phím cơ (min 850k) không được nằm trong danh sách <= 300k
    expect(titlesMax.some(t => t.includes("Bàn Phím Cơ"))).toBe(false);
  });
});
