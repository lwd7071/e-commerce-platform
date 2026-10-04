import { expect, test } from "@playwright/test";

test.describe("Seller Sub-navigation & Header Navbar Live DOM Verification", () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase Auth password grant
    await page.route("**/auth/v1/token?grant_type=password", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-jwt-seller-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: {
            id: "seller-e2e-001",
            email: "seller@dino-e2e.test",
            user_metadata: { full_name: "Dino Seller E2E" },
          },
        }),
      });
    });

    // Mock Backend /auth/me for SELLER
    await page.route("**/api/v1/auth/me", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_id: "seller-e2e-001",
          email: "seller@dino-e2e.test",
          role: "SELLER",
          shop_id: "shop-e2e-001",
          shop_status: "ACTIVE",
        }),
      });
    });

    // Mock Seller Shop API
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

    // Mock Seller Orders API
    await page.route("**/api/v1/seller/orders*", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          meta: { total: 0, next_cursor: null },
        }),
      });
    });

    // Mock Seller Products API
    await page.route("**/api/v1/seller/products*", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          meta: { total: 0 },
        }),
      });
    });

    // Mock Seller Wallet API
    await page.route("**/api/v1/seller/wallet*", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          wallet_id: "wallet-e2e-001",
          balance: "15000000.00",
          bank_name: "Vietcombank",
          bank_account_number: "9876543210",
        }),
      });
    });

    // Mock Seller Vouchers API
    await page.route("**/api/v1/seller/vouchers*", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
        }),
      });
    });

    // Mock Seller Revenue Report API
    await page.route("**/api/v1/seller/reports/revenue*", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            grossRevenue: "12000000.00",
            completedOrders: 15,
            averageOrderValue: "800000.00",
            totalOrders: 20,
            cancelledOrders: 2,
            otherOrders: 3,
            generatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    // Mock Chat Conversations API
    await page.route("**/api/v1/chat/conversations*", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
        }),
      });
    });
  });

  test("Seller logs in, verifies streamlined 5-item navbar, navigates all 8 tabs, tests chat return link, and checks mobile DOM", async ({
    page,
  }) => {
    // 1. Sign in as SELLER
    await page.goto("/login?returnTo=%2Fseller");
    await page.getByLabel("Địa chỉ Email").fill("seller@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill("Password123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/seller(?:\?|$)/, { timeout: 30_000 });

    // 2. DOM Inspection: Top Header Navbar
    // Verify streamlined 5 items for SELLER (Trang chủ, Kênh người bán, Ví người bán, Thông báo, Tài khoản)
    const headerNav = page.locator("header");
    await expect(headerNav.getByRole("link", { name: "Trang chủ", exact: true })).toBeVisible();
    await expect(headerNav.getByRole("link", { name: "Kênh người bán", exact: true })).toBeVisible();
    await expect(headerNav.getByRole("link", { name: "Ví người bán", exact: true })).toBeVisible();
    await expect(headerNav.getByRole("link", { name: "Thông báo", exact: true })).toBeVisible();
    await expect(headerNav.getByRole("link", { name: "Tài khoản", exact: true })).toBeVisible();

    // 3. DOM Inspection: Sub-navigation 8 Tabs on /seller
    const subNav = page.locator('nav[aria-label="Điều hướng kênh người bán"]').first();
    await expect(subNav).toBeVisible();

    const overviewTab = subNav.getByRole("link", { name: "Tổng quan" });
    await expect(overviewTab).toHaveAttribute("aria-current", "page");

    // 4. Navigate through all tabs and inspect DOM active state & aria-current
    // Tab: Đơn bán
    await subNav.getByRole("link", { name: "Đơn bán" }).click();
    await expect(page).toHaveURL(/\/seller\/orders(?:\?|$)/);
    await expect(page.locator('nav[aria-label="Điều hướng kênh người bán"]').getByRole("link", { name: "Đơn bán" })).toHaveAttribute("aria-current", "page");

    // Tab: Sản phẩm
    await page.locator('nav[aria-label="Điều hướng kênh người bán"]').getByRole("link", { name: "Sản phẩm" }).click();
    await expect(page).toHaveURL(/\/seller\/products(?:\?|$)/);
    await expect(page.locator('nav[aria-label="Điều hướng kênh người bán"]').getByRole("link", { name: "Sản phẩm" })).toHaveAttribute("aria-current", "page");

    // Tab: Ví người bán
    await page.locator('nav[aria-label="Điều hướng kênh người bán"]').getByRole("link", { name: "Ví người bán" }).click();
    await expect(page).toHaveURL(/\/seller\/wallet(?:\?|$)/);
    await expect(page.locator('nav[aria-label="Điều hướng kênh người bán"]').getByRole("link", { name: "Ví người bán" })).toHaveAttribute("aria-current", "page");

    // Tab: Tin nhắn
    await page.locator('nav[aria-label="Điều hướng kênh người bán"]').getByRole("link", { name: "Tin nhắn" }).click();
    await expect(page).toHaveURL(/\/seller\/chat(?:\?|$)/);
    const chatTab = page.locator('nav[aria-label="Điều hướng kênh người bán"]').getByRole("link", { name: "Tin nhắn" });
    await expect(chatTab).toBeVisible();
    await expect(chatTab).toHaveAttribute("aria-current", "page");

    // CRITICAL ROOT-CAUSE VERIFICATION:
    // Verify that from /seller/chat, seller can click "Tổng quan" to navigate back to /seller Dashboard
    await page.locator('nav[aria-label="Điều hướng kênh người bán"]').getByRole("link", { name: "Tổng quan" }).click();
    await expect(page).toHaveURL(/\/seller(?:\?|$)/);

    // Tab: Mã giảm giá
    await page.locator('nav[aria-label="Điều hướng kênh người bán"]').getByRole("link", { name: "Mã giảm giá" }).click();
    await expect(page).toHaveURL(/\/seller\/vouchers(?:\?|$)/);
    await expect(page.locator('nav[aria-label="Điều hướng kênh người bán"]').getByRole("link", { name: "Mã giảm giá" })).toHaveAttribute("aria-current", "page");

    // Tab: Báo cáo
    await page.locator('nav[aria-label="Điều hướng kênh người bán"]').getByRole("link", { name: "Báo cáo" }).click();
    await expect(page).toHaveURL(/\/seller\/reports(?:\?|$)/);
    await expect(page.locator('nav[aria-label="Điều hướng kênh người bán"]').getByRole("link", { name: "Báo cáo" })).toHaveAttribute("aria-current", "page");

    // Tab: Hồ sơ Shop
    await page.locator('nav[aria-label="Điều hướng kênh người bán"]').getByRole("link", { name: "Hồ sơ Shop" }).click();
    await expect(page).toHaveURL(/\/seller\/shop(?:\?|$)/);
    await expect(page.locator('nav[aria-label="Điều hướng kênh người bán"]').getByRole("link", { name: "Hồ sơ Shop" })).toHaveAttribute("aria-current", "page");

    // 5. Responsive Mobile DOM Inspection (375px viewport)
    await page.setViewportSize({ width: 375, height: 667 });
    const mobileSubNav = page.locator('nav[aria-label="Điều hướng kênh người bán"]').first();
    await expect(mobileSubNav).toBeVisible();
    for (const tabName of ["Tổng quan", "Đơn bán", "Sản phẩm", "Ví người bán", "Tin nhắn", "Mã giảm giá", "Báo cáo", "Hồ sơ Shop"]) {
      await expect(mobileSubNav.getByRole("link", { name: tabName })).toBeAttached();
    }
  });
});
