import { test, expect } from "@playwright/test";

test.describe("Chi tiết sản phẩm", () => {
  test("Vào chi tiết sản phẩm hiển thị hình ảnh sản phẩm", async ({ page }) => {
    page.on("console", (msg) => console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`[PAGE ERROR]`, err));

    // Đi vào trang danh sách sản phẩm trước
    await page.goto("/products");
    await expect(page.locator("article, .product-card").first()).toBeVisible({ timeout: 15000 });

    // Tìm và click vào sản phẩm bàn phím
    const keyboardProduct = page.locator("article h3 a, .product-card h3 a").filter({ hasText: /bàn phím/i }).first();
    const productName = await keyboardProduct.innerText();
    console.log("Navigating to product:", productName);
    await keyboardProduct.click();

    // Đợi đến trang chi tiết
    await expect(page).toHaveURL(/.*\/products\/[a-zA-Z0-9-]+/);

    // Kiểm tra hình ảnh chính của sản phẩm trong khung hiển thị lớn
    const productDetailImage = page.locator('.aspect-square img');
    await expect(productDetailImage).toBeVisible({ timeout: 5000 });

    const imgSrc = await productDetailImage.first().getAttribute("src");
    console.log("Product detail image src:", imgSrc);
    expect(imgSrc).toBeTruthy();
  });
});
