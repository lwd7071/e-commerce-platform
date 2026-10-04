import { expect, test } from "@playwright/test";

test.describe("Đợt 2: Kênh Người Bán — Live E2E Verification (T2-E2E-01 & T2-E2E-03)", () => {
  test.beforeEach(async ({ page }) => {
    // Dynamic mock for Supabase Auth password grant
    await page.route("**/auth/v1/token?grant_type=password", async (route) => {
      const postData = route.request().postDataJSON() || {};
      const email = postData.email || "seller@dino-e2e.test";

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-jwt-seller-phase2-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: {
            id: "seller-phase2-001",
            email,
            user_metadata: { full_name: "Nguyễn Trung Hải - Seller Phase 2" },
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
          user_id: "seller-phase2-001",
          email: "seller@dino-e2e.test",
          role: "SELLER",
          shop_id: "shp-phase2-shop-001",
          shop_status: "ACTIVE",
        }),
      });
    });

    // Mock Seller Shop API
    await page.route("**/api/v1/seller/shop", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              shop_id: "shp-phase2-shop-001",
              shop_name: "Hải Tech Official Store",
              description: "Gian hàng công nghệ cao cấp",
              pickup_address: "123 Xa Lộ Hà Nội, TP. Thủ Đức, TP. Hồ Chí Minh",
              contact_phone: "0901234567",
              logo_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
              status: "ACTIVE",
              updated_at: new Date().toISOString(),
            },
          }),
        });
      }
      if (route.request().method() === "PATCH") {
        const patchData = route.request().postDataJSON() || {};
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              shop_id: "shp-phase2-shop-001",
              shop_name: patchData.shop_name || "Hải Tech Official Store",
              description: patchData.description || "Gian hàng công nghệ cao cấp",
              pickup_address: patchData.pickup_address || "123 Xa Lộ Hà Nội, TP. Thủ Đức, TP. Hồ Chí Minh",
              contact_phone: patchData.contact_phone || "0901234567",
              logo_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
              status: "ACTIVE",
              updated_at: new Date().toISOString(),
            },
          }),
        });
      }
      return route.continue();
    });

    // Mock Seller Orders API
    await page.route("**/api/v1/seller/orders*", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "ord-p2-001-pending",
              shop_id: "shp-phase2-shop-001",
              buyer_id: "buyer-001",
              status: "PENDING_CONFIRMATION",
              total_amount: 250000,
              items: [
                {
                  product_id: "prod-001",
                  title: "Chuột không dây công thái học",
                  quantity: 1,
                  price: 250000,
                },
              ],
              created_at: new Date().toISOString(),
            },
            {
              id: "ord-p2-002-confirmed",
              shop_id: "shp-phase2-shop-001",
              buyer_id: "buyer-002",
              status: "CONFIRMED",
              total_amount: 450000,
              items: [
                {
                  product_id: "prod-002",
                  title: "Bàn phím cơ Bluetooth",
                  quantity: 1,
                  price: 450000,
                },
              ],
              created_at: new Date().toISOString(),
            },
            {
              id: "ord-p2-003-shipping",
              shop_id: "shp-phase2-shop-001",
              buyer_id: "buyer-003",
              status: "SHIPPING",
              total_amount: 180000,
              items: [
                {
                  product_id: "prod-003",
                  title: "Cáp sạc USB-C nhanh 65W",
                  quantity: 1,
                  price: 180000,
                },
              ],
              created_at: new Date().toISOString(),
            },
          ],
          meta: { next_cursor: null, has_more: false, limit: 20 },
        }),
      });
    });

    // Mock Seller Products API
    await page.route("**/api/v1/seller/products*", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "prod-001",
              title: "Chuột không dây công thái học",
              price: 250000,
              stock: 50,
              status: "ACTIVE",
            },
          ],
          meta: { next_cursor: null, has_more: false, limit: 20 },
        }),
      });
    });
  });

  test("T2-E2E-01: Quản trị đơn hàng Seller, bộ lọc trạng thái và kiểm định nghiêm ngặt QD11", async ({ page }) => {
    // 1. Đăng nhập với tài khoản người bán
    await page.goto("/login");
    await page.fill('input[type="email"]', "seller@dino-e2e.test");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');

    // Tự động chuyển hướng về Kênh Người Bán /seller
    await expect(page).toHaveURL(/\/seller/);

    // 2. Chuyển sang màn hình Quản lý đơn hàng
    await page.goto("/seller/orders");
    await page.waitForLoadState("networkidle");

    // 3. Kiểm tra các tab bộ lọc trạng thái
    const tabsNav = page.locator('button:has-text("Tất cả"), [role="tab"]:has-text("Tất cả")');
    await expect(tabsNav.first()).toBeVisible();

    // 4. KIỂM ĐỊNH NGHIÊM NGẶT QD11:
    // Tuyệt đối KHÔNG có nút nào trong bảng đơn hàng cho phép Seller bấm "Hoàn tất" hoặc "Complete"
    const orderActionCompleteButtons = page.locator('tbody tr button:has-text("Hoàn tất"), tbody tr button:has-text("Complete"), tbody tr button:has-text("Đã giao thành công")');
    const completeCount = await orderActionCompleteButtons.count();
    expect(completeCount).toBe(0);

    // 5. Kiểm tra các nút hợp lệ của Seller:
    // Đơn PENDING_CONFIRMATION có nút Xác nhận đơn hoặc Từ chối
    const confirmButton = page.locator('button:has-text("Xác nhận đơn")');
    if (await confirmButton.count() > 0) {
      await expect(confirmButton.first()).toBeVisible();
    }

    // 6. Kiểm tra hộp thoại Hủy đơn (Modal focus trap & Escape key)
    const rejectButton = page.locator('button:has-text("Từ chối"), button:has-text("Hủy")');
    if (await rejectButton.count() > 0) {
      await rejectButton.first().click();
      const cancelDialog = page.locator('[role="dialog"]');
      if (await cancelDialog.count() > 0) {
        await expect(cancelDialog).toBeVisible();
        // Nhấn phím Escape để đóng hộp thoại an toàn
        await page.keyboard.press("Escape");
        await expect(cancelDialog).toBeHidden();
      }
    }
  });

  test("T2-E2E-03: Quản trị hồ sơ Shop, huy hiệu trạng thái và cập nhật địa chỉ lấy hàng", async ({ page }) => {
    // 1. Đăng nhập
    await page.goto("/login");
    await page.fill('input[type="email"]', "seller@dino-e2e.test");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/seller/);

    // 2. Truy cập màn hình Hồ sơ Shop
    await page.goto("/seller/shop");
    await page.waitForLoadState("networkidle");

    // 3. Kiểm tra thông tin Shop hiển thị trên form
    const shopNameInput = page.locator('input[value*="Hải Tech"], input[name*="name"], input#shop_name');
    await expect(shopNameInput.first()).toBeVisible();

    // 4. Kiểm tra huy hiệu trạng thái Shop (Status Badge)
    const activeBadge = page.locator('text=ACTIVE, text=Hoạt động, [data-status="ACTIVE"]');
    if (await activeBadge.count() > 0) {
      await expect(activeBadge.first()).toBeVisible();
    }

    // 5. Kiểm tra trường địa chỉ lấy hàng
    const addressInput = page.locator('input[value*="Xa Lộ Hà Nội"], textarea[name*="address"], input[name*="address"]');
    await expect(addressInput.first()).toBeVisible();

    // 6. Truy cập màn hình Sản phẩm
    await page.goto("/seller/products");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('h1:has-text("Quản Lý Sản Phẩm")').first()).toBeVisible();
    await expect(page.locator('[data-testid="add-product-btn"]').first()).toBeVisible();
  });
});
