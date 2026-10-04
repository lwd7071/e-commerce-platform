import { expect, test } from "@playwright/test";

test.describe("Auth Role-Based Landing Redirect & Privilege Bypass Prevention Live E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Dynamic mock for Supabase Auth password grant based on email
    await page.route("**/auth/v1/token?grant_type=password", async (route) => {
      const postData = route.request().postDataJSON() || {};
      const email = postData.email || "";

      let role = "BUYER";
      if (email.includes("seller")) role = "SELLER";
      if (email.includes("admin")) role = "ADMIN";

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: `mock-jwt-${role.toLowerCase()}-token`,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: {
            id: `${role.toLowerCase()}-e2e-001`,
            email,
            user_metadata: { full_name: `Dino ${role} E2E` },
          },
        }),
      });
    });

    // Dynamic mock for Backend /auth/me based on auth header / state
    await page.route("**/api/v1/auth/me", (route) => {
      const authHeader = route.request().headers()["authorization"] || "";
      let role = "BUYER";
      if (authHeader.includes("seller")) role = "SELLER";
      if (authHeader.includes("admin")) role = "ADMIN";

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_id: `${role.toLowerCase()}-e2e-001`,
          email: `${role.toLowerCase()}@dino-e2e.test`,
          role,
          shop_id: role === "SELLER" ? "shop-e2e-001" : null,
          shop_status: role === "SELLER" ? "ACTIVE" : null,
        }),
      });
    });

    // Mock seller shop API if accessed
    await page.route("**/api/v1/seller/shop", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          shop_id: "shop-e2e-001",
          shop_name: "Dino Official Store",
          status: "ACTIVE",
          pickup_address: "123 Đường Số 1, Quận 1",
          contact_phone: "0901234567",
        }),
      });
    });

    // Mock seller orders API
    await page.route("**/api/v1/seller/orders*", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], meta: { total: 0 } }),
      });
    });

    // Mock admin dashboard KPI if accessed
    await page.route("**/api/v1/admin/**", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });
  });

  test("1. Buyer signs in without returnTo -> automatically redirected to home '/'", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Địa chỉ Email").fill("buyer@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill("Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  });

  test("2. Seller signs in without returnTo -> automatically redirected to seller portal '/seller'", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Địa chỉ Email").fill("seller@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill("Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/seller(?:\?|$)/, { timeout: 30_000 });
    await expect(page.locator('nav[aria-label="Điều hướng kênh người bán"]').first()).toBeVisible();
  });

  test("3. Admin signs in without returnTo -> automatically redirected to admin portal '/admin'", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Địa chỉ Email").fill("admin@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill("Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/admin(?:\?|$)/, { timeout: 30_000 });
  });

  test("4. Anti-Bypass: Buyer attempts returnTo=/admin -> neutralized to '/'", async ({ page }) => {
    await page.goto("/login?returnTo=%2Fadmin");
    await page.getByLabel("Địa chỉ Email").fill("buyer@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill("Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    // Must NOT redirect to /admin, should fall back safely to /
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  });

  test("5. Anti-Bypass: Seller attempts returnTo=/admin -> neutralized to '/seller'", async ({ page }) => {
    await page.goto("/login?returnTo=%2Fadmin");
    await page.getByLabel("Địa chỉ Email").fill("seller@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill("Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    // Must NOT redirect to /admin, should fall back safely to /seller
    await expect(page).toHaveURL(/\/seller(?:\?|$)/, { timeout: 30_000 });
  });

  test("6. Valid Deep Link: Seller signs in with returnTo=/seller/orders -> redirected to '/seller/orders'", async ({ page }) => {
    await page.goto("/login?returnTo=%2Fseller%2Forders");
    await page.getByLabel("Địa chỉ Email").fill("seller@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill("Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/seller\/orders(?:\?|$)/, { timeout: 30_000 });
  });
});
