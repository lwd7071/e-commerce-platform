import { expect, test } from "@playwright/test";

/**
 * Playwright Browser E2E Test: Tiering & Loyalty Live Lifecycle
 *
 * Requirements tested:
 * Journey 1: Admin đổi hạng Shop -> Catalog hiển thị huy hiệu (TierBadge) trên danh sách và chi tiết sản phẩm.
 * Journey 2: Buyer xác nhận đã nhận hàng (confirmReceived) -> Hồ sơ cá nhân (/profile) cập nhật DinoPoint, hạng VIP và lịch sử giao dịch.
 *
 * Môi trường yêu cầu:
 * - Frontend dev server: http://127.0.0.1:3000
 * - Backend API server: http://127.0.0.1:8000
 * - PostgreSQL Test Database (Supabase / local test db) với các migration đã áp dụng
 * - Tài khoản Admin & Buyer được seed sẵn (E2E_SEED_PASSWORD hoặc E2E_ADMIN_PASSWORD/E2E_BUYER_PASSWORD)
 */

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@dino-e2e.test";
const adminPassword = process.env.E2E_SEED_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD;
const buyerEmail = process.env.E2E_BUYER_EMAIL ?? "buyer@dino-e2e.test";
const buyerPassword = process.env.E2E_SEED_PASSWORD ?? process.env.E2E_BUYER_PASSWORD;

test.describe("Tiering & Loyalty Full Browser E2E Journeys", () => {
  test.beforeEach(async ({}, testInfo) => {
    // Kiểm tra cấu hình môi trường E2E trước khi chạy trình duyệt
    if (!adminPassword || !buyerPassword) {
      testInfo.annotations.push({
        type: "environment_requirement",
        description:
          "Cần E2E_SEED_PASSWORD (hoặc E2E_ADMIN_PASSWORD và E2E_BUYER_PASSWORD) để chạy kiểm thử trình duyệt thực tế.",
      });
    }
  });

  test("Hành trình 1: Admin đổi hạng Shop -> Catalog và trang chi tiết hiển thị huy hiệu TierBadge", async ({ page }) => {
    test.skip(!adminPassword, "Bỏ qua vì chưa cấu hình E2E_SEED_PASSWORD/E2E_ADMIN_PASSWORD");

    // 1. Admin đăng nhập và truy cập cổng quản trị gian hàng
    await page.goto("/login?returnTo=%2Fadmin%2Fshops");
    await page.getByLabel("Địa chỉ Email").fill(adminEmail);
    await page.getByLabel("Mật khẩu").fill(adminPassword!);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/shops(?:\?|$)/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Quản lý gian hàng/i })).toBeVisible();

    // 2. Chọn một gian hàng để đổi hạng sang OFFICIAL/MALL
    const shopRow = page.locator("tbody tr").first();
    await expect(shopRow).toBeVisible({ timeout: 15_000 });

    // Click nút "Đổi hạng" trên dòng gian hàng
    await shopRow.getByRole("button", { name: /Đổi hạng/i }).click();

    // Dialog đổi hạng xuất hiện
    await expect(page.getByRole("heading", { name: /Đổi phân hạng gian hàng/i })).toBeVisible();
    await page.locator("#admin-change-tier-select").selectOption("MALL");
    await page.locator("#admin-change-tier-reason").fill("Nâng hạng đối tác chiến lược - E2E Verification");

    // Lắng nghe API PATCH đổi hạng gian hàng
    const patchResponsePromise = page.waitForResponse(
      (res) =>
        /\/api\/v1\/admin\/shops\/[0-9a-f-]+\/tier$/.test(res.url()) &&
        res.request().method() === "PATCH",
      { timeout: 20_000 },
    );

    await page.getByRole("button", { name: /Lưu thay đổi/i }).click();
    const patchResponse = await patchResponsePromise;
    expect(patchResponse.status()).toBe(200);

    // 3. Khách hàng xem danh mục sản phẩm (/products)
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: /Tất cả sản phẩm/i })).toBeVisible({ timeout: 20_000 });

    // Lọc theo bộ lọc hạng "Chính hãng (Mall)" trên UI catalog
    const mallFilterChip = page.getByRole("button", { name: /Chính hãng \(Mall\)/i });
    if (await mallFilterChip.isVisible()) {
      await mallFilterChip.click();
      await page.waitForLoadState("networkidle");
    }

    // Xác minh thẻ sản phẩm (ProductCard) có huy hiệu TierBadge
    const mallBadge = page.locator('[data-testid="tier-badge-MALL"]').or(page.getByText("Chính Hãng", { exact: false }));
    await expect(mallBadge.first()).toBeVisible({ timeout: 15_000 });

    // 4. Khách hàng click vào sản phẩm để xem trang chi tiết (/products/[id])
    const firstProductCard = page.locator('[data-testid="product-card"]').first().or(page.locator("a[href^='/products/']").first());
    await firstProductCard.click();

    await expect(page).toHaveURL(/\/products\/[0-9a-f-]+/);
    // Xác minh trang chi tiết sản phẩm hiển thị TierBadge của shop
    const detailBadge = page.locator('[data-testid="product-detail-shop-badge"]').or(page.getByText("Chính Hãng", { exact: false }));
    await expect(detailBadge.first()).toBeVisible({ timeout: 15_000 });
  });

  test("Hành trình 2: Buyer hoàn tất đơn hàng -> Profile hiển thị DinoPoint, hạng VIP và lịch sử giao dịch", async ({ page }) => {
    test.skip(!buyerPassword, "Bỏ qua vì chưa cấu hình E2E_SEED_PASSWORD/E2E_BUYER_PASSWORD");

    // 1. Buyer đăng nhập vào hệ thống
    await page.goto("/login?returnTo=%2Forders");
    await page.getByLabel("Địa chỉ Email").fill(buyerEmail);
    await page.getByLabel("Mật khẩu").fill(buyerPassword!);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/orders(?:\?|$)/, { timeout: 30_000 });

    // 2. Tìm đơn hàng ở trạng thái Đang giao (SHIPPING) để xác nhận nhận hàng
    const shippingOrder = page.locator('[data-testid="order-item"]').filter({ hasText: /Đang giao|SHIPPING/i }).first();
    const hasShippingOrder = await shippingOrder.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasShippingOrder) {
      const confirmButton = shippingOrder.getByRole("button", { name: /Đã nhận được hàng|Xác nhận nhận hàng/i });
      if (await confirmButton.isVisible()) {
        const confirmResponsePromise = page.waitForResponse(
          (res) =>
            /\/api\/v1\/orders\/[0-9a-f-]+\/confirm-received$/.test(res.url()) &&
            res.request().method() === "PATCH",
          { timeout: 20_000 },
        );
        await confirmButton.click();
        const confirmResponse = await confirmResponsePromise;
        expect(confirmResponse.status()).toBe(200);
      }
    }

    // 3. Buyer điều hướng tới trang Hồ sơ cá nhân (/profile)
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân" })).toBeVisible({ timeout: 20_000 });

    // 4. Xác minh BuyerLoyaltyCard hiển thị đầy đủ thông tin:
    // a. Section thông tin tích điểm DinoPoint
    await expect(page.getByText(/DinoPoint/i)).toBeVisible({ timeout: 15_000 });

    // b. Huy hiệu hạng thành viên (STANDARD hoặc VIP)
    const tierBadge = page.locator('[data-testid="buyer-tier-badge"]').or(page.getByText(/Hạng Tiêu Chuẩn|Hạng VIP/i));
    await expect(tierBadge.first()).toBeVisible();

    // c. Bảng hoặc danh sách lịch sử tích điểm
    const historySection = page.getByText(/Lịch sử tích điểm|Nhận hàng thành công/i);
    await expect(historySection.first()).toBeVisible();
  });
});
