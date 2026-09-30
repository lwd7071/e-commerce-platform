import { expect, test } from "./fixtures";

test("seeded Buyer can sign in and open their profile", async ({ page }) => {
  const password = process.env.E2E_SEED_PASSWORD;
  if (!password) throw new Error("E2E_SEED_PASSWORD is required for the seeded Buyer login path");

  await page.goto("/login?returnTo=%2Fprofile");
  await page.getByLabel("Địa chỉ Email").fill("buyer@dino-e2e.test");
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân" })).toBeVisible();
  await expect(page.getByText("E2E Buyer", { exact: true })).toBeVisible();
});
