import { expect, test } from "@playwright/test";

test.describe("Guest access boundaries", () => {
  test("can open the public catalog and is sent to login from the Buyer cart", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Khám Phá Sản Phẩm" })).toBeVisible();

    await page.goto("/cart");
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fcart$/);
    await expect(page.getByRole("heading", { name: "Đăng nhập tài khoản" })).toBeVisible();
  });
});
