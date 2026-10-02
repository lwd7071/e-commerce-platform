import { expect, test } from "./fixtures";

test("Seller cannot submit a product using demo categories when the live category API fails", async ({ page }) => {
  const password = process.env.E2E_SEED_PASSWORD;
  if (!password) throw new Error("E2E_SEED_PASSWORD is required for the seeded Seller flow");

  await page.route("**/categories", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "DEPENDENCY_UNAVAILABLE", message: "Category API unavailable" } }),
  }));

  await page.goto("/login?returnTo=%2Fseller%2Fproducts%2Fnew");
  await page.getByLabel("Địa chỉ Email").fill("seller-active@dino-e2e.test");
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/seller\/products\/new$/);

  await expect(page.getByRole("alert")).toContainText("Không thể tải danh mục thật");
  await expect(page.locator("#product-category option[value^='00000000-']")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tạo sản phẩm mới" })).toBeDisabled();
});
