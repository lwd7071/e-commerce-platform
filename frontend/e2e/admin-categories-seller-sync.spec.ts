import { test, expect } from "@playwright/test";

test.describe("Kiểm tra đồng bộ danh mục ngành hàng từ Admin sang Người bán", () => {
  let currentRole = "ADMIN";
  let currentUserEmail = "admin-master@dino-e2e.test";

  test.beforeEach(async ({ page }) => {
    currentRole = "ADMIN";
    currentUserEmail = "admin-master@dino-e2e.test";

    await page.route("**/auth/v1/token?grant_type=password", async (route) => {
      const postData = route.request().postDataJSON() || {};
      currentUserEmail = postData.email || "admin-master@dino-e2e.test";
      currentRole = currentUserEmail.includes("seller") ? "SELLER" : "ADMIN";

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: `mock-jwt-${currentRole.toLowerCase()}-token`,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: {
            id: `${currentRole.toLowerCase()}-e2e-001`,
            email: currentUserEmail,
            user_metadata: { full_name: `Dino ${currentRole} E2E` },
          },
        }),
      });
    });

    await page.route("**/api/v1/auth/me", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_id: `${currentRole.toLowerCase()}-e2e-001`,
          email: currentUserEmail,
          role: currentRole,
          shop_id: currentRole === "SELLER" ? "00000000-0000-0000-0000-000000000001" : null,
          shop_status: "ACTIVE",
        }),
      });
    });
  });

  test("Admin thêm danh mục ngành hàng mới -> Seller vào /seller/products/new nhìn thấy danh mục mới", async ({ page }) => {
    // 1. Đăng nhập với tài khoản Admin
    await page.goto("/login?returnTo=%2Fadmin%2Fcategories");
    await page.getByLabel("Địa chỉ Email").fill("admin-master@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill(process.env.E2E_SEED_PASSWORD || "Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/admin\/categories$/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /quản lý danh mục ngành hàng/i })).toBeVisible({ timeout: 10000 });

    // 2. Mở modal thêm danh mục mới
    const addCatBtn = page.getByRole("button", { name: "+ Thêm danh mục mới" });
    await expect(addCatBtn).toBeVisible({ timeout: 10000 });
    await addCatBtn.click();

    // 3. Nhập thông tin danh mục mới
    const uniqueId = Date.now().toString().slice(-6);
    const newCategoryName = `Ngành Hàng Siêu Cấp ${uniqueId}`;
    await page.locator("#new-cat-name").fill(newCategoryName);
    await page.locator("#new-cat-desc").fill(`Mô tả cho ${newCategoryName}`);

    // Bấm Tạo danh mục
    const createBtn = page.getByRole("button", { name: "Tạo danh mục" });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // 4. Xác nhận thông báo thành công và danh mục xuất hiện trên cây admin
    await expect(page.getByText(new RegExp(`Đã thêm danh mục "${newCategoryName}"`, "i"))).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: newCategoryName })).toBeVisible({ timeout: 10000 });

    // 5. Chuyển sang tài khoản Người bán (Đăng xuất admin và đăng nhập Seller)
    await page.goto("/login?returnTo=%2Fseller%2Fproducts%2Fnew");
    await page.getByLabel("Địa chỉ Email").fill("seller-active@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill(process.env.E2E_SEED_PASSWORD || "Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/seller\/products\/new$/, { timeout: 15000 });
    await expect(page.locator("#product-category")).toBeVisible({ timeout: 10000 });

    // 6. Kiểm tra dropdown danh mục của Seller: PHẢI CÓ danh mục vừa tạo từ Admin
    const categorySelect = page.locator("#product-category");
    await expect(categorySelect).toContainText(newCategoryName, { timeout: 10000 });

    // Có thể chọn được danh mục đó
    const matchingOption = categorySelect.locator("option", { hasText: newCategoryName });
    await expect(matchingOption).toBeAttached();
    const optionValue = await matchingOption.getAttribute("value");
    expect(optionValue).toBeTruthy();

    await categorySelect.selectOption(optionValue!);
    expect(await categorySelect.inputValue()).toBe(optionValue);
  });
});
