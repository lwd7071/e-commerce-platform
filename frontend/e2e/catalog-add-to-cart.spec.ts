import { test, expect } from "@playwright/test";

test.describe("Kiểm tra chức năng Thêm vào giỏ hàng và Mua ngay", () => {
  test("Người dùng thêm sản phẩm vào giỏ hàng từ trang chi tiết và kiểm tra trong /cart", async ({ page }) => {
    // 1. Đăng nhập để thực hiện thêm vào giỏ hàng (hỗ trợ cả BUYER và SELLER)
    await page.goto("/login?returnTo=%2Fproducts");
    await page.getByLabel("Địa chỉ Email").fill("seller-active@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill(process.env.E2E_SEED_PASSWORD || "Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/products$/, { timeout: 15000 });

    // 2. Click vào sản phẩm đầu tiên trên trang /products
    const firstProductCard = page.locator("a[href^='/products/']").first();
    await expect(firstProductCard).toBeVisible({ timeout: 10000 });
    await firstProductCard.click();
    await expect(page).toHaveURL(/\/products\/[^/]+$/, { timeout: 10000 });

    // Lấy tên sản phẩm thực tế từ thẻ h1 trên trang chi tiết
    const productName = (await page.locator("h1").first().innerText()).trim();
    console.log("Selected product for add-to-cart test:", productName);

    // 3. Đang ở trang chi tiết sản phẩm: Tăng số lượng lên 2 nếu có nút
    const increaseBtn = page.getByRole("button", { name: "Tăng số lượng" });
    if (await increaseBtn.isVisible()) {
      await increaseBtn.click();
    }

    // 4. Bấm "Thêm Vào Giỏ Hàng"
    const addToCartBtn = page.getByRole("button", { name: "Thêm Vào Giỏ Hàng" });
    await expect(addToCartBtn).toBeVisible({ timeout: 10000 });
    await addToCartBtn.click();

    // 5. Kiểm tra thông báo Toast thành công
    await expect(
      page.getByText(/Đã thêm.*vào giỏ hàng thành công/i)
    ).toBeVisible({ timeout: 10000 });

    // 6. Đi tới trang Giỏ hàng (/cart)
    await page.goto("/cart");
    await expect(page).toHaveURL(/\/cart$/, { timeout: 10000 });

    // 7. Xác nhận sản phẩm vừa thêm hiển thị đầy đủ trong Giỏ hàng
    await expect(page.getByRole("heading", { name: /giỏ hàng/i })).toBeVisible();
    await expect(page.locator("body")).toContainText(productName);
  });

  test("Người dùng bấm Mua Ngay sẽ tự động thêm và chuyển hướng tới /checkout", async ({ page }) => {
    // 1. Đăng nhập
    await page.goto("/login?returnTo=%2Fproducts");
    await page.getByLabel("Địa chỉ Email").fill("seller-active@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill(process.env.E2E_SEED_PASSWORD || "Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/products$/, { timeout: 15000 });

    // 2. Vào sản phẩm đầu tiên
    const firstProductCard = page.locator("a[href^='/products/']").first();
    await expect(firstProductCard).toBeVisible({ timeout: 10000 });
    await firstProductCard.click();
    await expect(page).toHaveURL(/\/products\/[^/]+$/, { timeout: 10000 });

    // 3. Bấm "Mua Ngay"
    const buyNowBtn = page.getByRole("button", { name: "Mua Ngay" });
    await expect(buyNowBtn).toBeVisible({ timeout: 10000 });
    await buyNowBtn.click();

    // 4. Kiểm tra chuyển hướng tới /checkout
    await expect(page).toHaveURL(/\/checkout$/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /thanh toán đơn hàng/i })).toBeVisible({ timeout: 10000 });
  });
});
