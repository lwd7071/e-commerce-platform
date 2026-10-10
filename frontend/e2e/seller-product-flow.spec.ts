import { expect, test } from "./fixtures";

test.describe("B-206: Seller Product Flow E2E (upload → create → list → stock → hide/show)", () => {
  test("seeded active Seller can create product, view in list, edit stock, and toggle visibility", async ({ page }) => {
    const password = process.env.E2E_SEED_PASSWORD;
    if (!password) {
      throw new Error("E2E_SEED_PASSWORD is required for the seeded Seller flow");
    }

    // 1. Sign in as active Seller
    await page.goto("/login?returnTo=%2Fseller%2Fproducts");
    await page.getByLabel("Địa chỉ Email").fill("seller-active@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill(password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    // 2. Verify redirect to /seller/products
    await expect(page).toHaveURL(/\/seller\/products$/);
    await expect(page.getByRole("heading", { name: "Quản Lý Sản Phẩm" })).toBeVisible();

    // 3. Navigate to product creation page
    await page.getByRole("link", { name: "+ Thêm sản phẩm mới" }).click();
    await expect(page).toHaveURL(/\/seller\/products\/new$/);
    await expect(page.getByRole("heading", { name: "Thêm Sản Phẩm Mới" })).toBeVisible();

    // 4. Fill product creation form
    const uniqueSuffix = Date.now().toString().slice(-6);
    const testProductName = `Bàn Phím Cơ Dino E2E ${uniqueSuffix}`;

    await page.locator("#product-name").fill(testProductName);
    await page.locator("#product-description").fill("Bàn phím cơ cao cấp switch quang học phục vụ kiểm thử E2E");

    // Add image URL
    await page.locator("#custom-image-url").fill("https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600");
    await page.getByRole("button", { name: "Thêm URL" }).click();

    // Configure variant SKU, price, stock
    const skuInput = page.locator("input[id^='variant-sku-']").first();
    await skuInput.fill(`SKU-KB-${uniqueSuffix}`);

    const priceInput = page.locator("input[id^='variant-price-']").first();
    await priceInput.fill("750000");

    const stockInput = page.locator("input[id^='variant-stock-']").first();
    await stockInput.fill("40");

    // Submit product creation
    await page.getByRole("button", { name: "Tạo sản phẩm mới" }).click();

    // 5. Verify returned to list screen and new product appears
    await expect(page).toHaveURL(/\/seller\/products$/);
    const productRow = page.locator("tr", { hasText: testProductName });
    await expect(productRow).toBeVisible();
    await expect(productRow.getByText("40", { exact: true })).toBeVisible();
    await expect(productRow.getByText("Đang bán", { exact: true })).toBeVisible();

    // 6. Quick-edit stock
    await productRow.getByRole("button", { name: "Chỉnh tồn kho" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const stockDialogInput = page.locator("#variant-stock-input");
    await stockDialogInput.fill("85");
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();

    // Verify stock is updated to 85
    await expect(productRow.getByText("85", { exact: true })).toBeVisible();

    // 7. Toggle Hide/Show (Status switch)
    // Click "Ẩn" to hide product
    const hideBtn = productRow.getByRole("button", { name: "Ẩn", exact: true });
    await hideBtn.click();
    await expect(productRow.getByText("Đã ẩn", { exact: true })).toBeVisible();

    // Click "Hiện" to reactivate product
    const showBtn = productRow.getByRole("button", { name: "Hiện", exact: true });
    await showBtn.click();
    await expect(productRow.getByText("Đang bán", { exact: true })).toBeVisible();
  });
});
