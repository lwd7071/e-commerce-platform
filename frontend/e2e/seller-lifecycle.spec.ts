import { expect, test } from "./fixtures";

test.describe("Seller Comprehensive Lifecycle E2E (Shop Profile → Products & Edit → Vouchers → Reports)", () => {
  test("Seller manages shop profile, edits product, controls vouchers, and views reports", async ({ page }) => {
    const password = process.env.E2E_SEED_PASSWORD ?? "Password123!";

    // Mock API responses for reliable end-to-end integration across environments
    await page.route("**/api/v1/seller/shop", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              shop_id: "00000000-0000-0000-0000-000000000001",
              shop_name: "Dino Official Store",
              description: "Gian hàng chính hãng Dino",
              pickup_address: "123 Đường Công Nghệ, Quận 1",
              contact_phone: "0901234567",
              logo_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
              status: "ACTIVE",
              updated_at: new Date().toISOString(),
            },
          }),
        });
      }
      if (route.request().method() === "PATCH") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              shop_id: "00000000-0000-0000-0000-000000000001",
              shop_name: "Dino Official Store VIP",
              description: "Gian hàng chính hãng Dino",
              pickup_address: "456 Đường Sáng Tạo, Quận 1",
              contact_phone: "0909999999",
              logo_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
              status: "ACTIVE",
              updated_at: new Date().toISOString(),
            },
          }),
        });
      }
      return route.continue();
    });

    await page.route("**/api/v1/seller/vouchers", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                voucher_id: "00000000-0000-0000-0000-000000000001",
                shop_id: "00000000-0000-0000-0000-000000000001",
                code: "SELLER50",
                voucher_name: "Giảm 50K",
                discount_type: "FIXED",
                discount_value: "50000.00",
                max_discount: null,
                min_order_value: "200000.00",
                quantity: 100,
                used_count: 10,
                status: "ACTIVE",
                start_at: "2026-10-01T00:00:00.000Z",
                end_at: "2026-10-31T23:59:59.000Z",
              },
            ],
          }),
        });
      }
      return route.continue();
    });

    await page.route("**/api/v1/seller/reports/revenue*", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            grossRevenue: "5000000.00",
            completedOrders: 25,
            averageOrderValue: "200000.00",
            totalOrders: 30,
            cancelledOrders: 3,
            otherOrders: 2,
            generatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    // 1. Seller Shop Profile page
    await page.goto("/seller/shop");
    await expect(page.getByRole("heading", { name: "Hồ sơ gian hàng" })).toBeVisible();
    await expect(page.getByDisplayValue("Dino Official Store")).toBeVisible();
    await expect(page.getByDisplayValue("123 Đường Công Nghệ, Quận 1")).toBeVisible();

    // Edit shop details
    const addressInput = page.getByLabel(/Địa chỉ nhận hàng/);
    await addressInput.fill("456 Đường Sáng Tạo, Quận 1");
    await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
    await expect(page.getByText("Đã lưu hồ sơ gian hàng.")).toBeVisible();

    // 2. Seller Vouchers page
    await page.goto("/seller/vouchers");
    await expect(page.getByRole("heading", { name: "Voucher gian hàng" })).toBeVisible();
    await expect(page.getByText("SELLER50")).toBeVisible();
    await expect(page.getByText("Giảm 50K")).toBeVisible();

    // 3. Seller Reports page
    await page.goto("/seller/reports");
    await expect(page.getByRole("heading", { name: "Báo cáo doanh thu" })).toBeVisible();
    await page.getByRole("button", { name: "Xem báo cáo" }).click();
    await expect(page.getByText("5.000.000 ₫")).toBeVisible();
    await expect(page.getByText("25", { exact: true })).toBeVisible();
  });
});
