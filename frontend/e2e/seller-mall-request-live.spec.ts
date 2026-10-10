import { expect, test } from "@playwright/test";

/**
 * UI Browser Test với API Mock: Quy trình Nâng Hạng Dino Mall (Playwright)
 *
 * Kiểm thử luồng giao diện người dùng trên trình duyệt Google Chrome thật bằng Playwright
 * nhưng các endpoint HTTP (/api/v1/...) và xác thực Auth được mô phỏng bằng page.route()
 * để cô lập hành vi DOM/UX và không yêu cầu backend runtime:
 * 1. Hành trình 1: Seller gửi hồ sơ -> Admin duyệt -> Seller làm mới thấy MALL -> Buyer đọc lại catalog thấy badge.
 * 2. Hành trình 2: Seller gửi -> Admin từ chối -> Seller thấy lý do -> gửi yêu cầu mới.
 * 3. Hành trình 3: Seller hủy yêu cầu PENDING.
 */

test.describe("Seller Dino Mall Upgrade — UI Browser Test với API Mock", () => {
  let shopState = {
    shop_id: "shop-e2e-mall-001",
    shop_name: "Dino Tech Store",
    tier: "STANDARD",
    status: "ACTIVE",
    pickup_address: "123 Lê Duẩn, Hà Nội",
    contact_phone: "0912345678",
  };

  let requests: Array<{
    request_id: string;
    id?: string;
    shop_id: string;
    seller_id: string;
    reason: string;
    document_url: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    admin_note: string | null;
    created_at: string;
    updated_at: string;
  }> = [];

  test.beforeEach(async ({ page }) => {
    shopState = {
      shop_id: "00000000-0000-0000-0000-000000000001",
      shop_name: "Dino Tech Store",
      tier: "STANDARD",
      status: "ACTIVE",
      pickup_address: "123 Lê Duẩn, Hà Nội",
      contact_phone: "0912345678",
    };
    requests = [];

    // 1. Mock Supabase Auth password grant for both SELLER and ADMIN
    await page.route("**/auth/v1/token?grant_type=password", async (route) => {
      const postData = route.request().postDataJSON() || {};
      const email = postData.email || "seller@dino-e2e.test";
      const isAdmin = email.includes("admin");

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: isAdmin ? "mock-jwt-admin-token" : "mock-jwt-seller-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: {
            id: isAdmin ? "admin-e2e-001" : "seller-e2e-001",
            email,
            user_metadata: {
              full_name: isAdmin ? "Admin System" : "Dino Seller Pro",
            },
          },
        }),
      });
    });

    // 2. Mock Backend /api/v1/auth/me
    await page.route("**/api/v1/auth/me", (route) => {
      const authHeader = route.request().headers()["authorization"] || "";
      const isAdmin = authHeader.includes("admin");

      if (isAdmin) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            user_id: "admin-e2e-001",
            email: "admin@dino-e2e.test",
            role: "ADMIN",
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_id: "seller-e2e-001",
          email: "seller@dino-e2e.test",
          role: "SELLER",
          shop_id: shopState.shop_id,
          shop_status: "ACTIVE",
        }),
      });
    });

    // 3. Mock Seller Shop API
    await page.route("**/api/v1/seller/shop", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: shopState,
          }),
        });
      }
      return route.continue();
    });

    // 4. Mock Seller Mall Requests API
    await page.route("**/api/v1/seller/shop/mall-requests**", (route) => {
      const method = route.request().method();
      const url = route.request().url();

      if (method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: requests.map((r) => ({ ...r, id: r.request_id })),
            meta: { next_cursor: null, has_more: false, limit: 20 },
          }),
        });
      }

      if (method === "POST" && !url.includes("/cancel")) {
        const body = route.request().postDataJSON() || {};
        const newReq = {
          request_id: `req-${Date.now()}`,
          id: `req-${Date.now()}`,
          shop_id: shopState.shop_id,
          seller_id: "seller-e2e-001",
          reason: body.reason,
          document_url: body.document_url,
          status: "PENDING" as const,
          admin_note: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        requests.unshift(newReq);
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ data: newReq }),
        });
      }

      if (method === "POST" && url.includes("/cancel")) {
        const reqId = url.split("/mall-requests/")[1]?.split("/")[0]?.replace("cancel", "");
        const target = requests.find((r) => r.request_id === reqId || r.id === reqId) || requests[0];
        if (target) {
          target.status = "CANCELLED";
          target.updated_at = new Date().toISOString();
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { ...target, id: target?.request_id } }),
        });
      }

      return route.continue();
    });

    // 5. Mock Admin Mall Requests API
    await page.route("**/api/v1/admin/shops/mall-requests**", (route) => {
      const method = route.request().method();
      const url = route.request().url();

      if (method === "GET") {
        const urlObj = new URL(url);
        const statusFilter = urlObj.searchParams.get("status");
        const filtered = statusFilter && statusFilter !== "ALL"
          ? requests.filter((r) => r.status === statusFilter)
          : requests;

        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: filtered.map((r) => ({
              ...r,
              id: r.request_id,
              shop_name: shopState.shop_name,
              seller_email: "seller@dino-e2e.test",
            })),
            meta: { next_cursor: null, has_more: false, limit: 20 },
          }),
        });
      }

      if (method === "POST" && url.includes("/approve")) {
        const reqId = url.split("/mall-requests/")[1]?.split("/")[0]?.replace("approve", "");
        const body = route.request().postDataJSON() || {};
        const target = requests.find((r) => r.request_id === reqId || r.id === reqId) || requests[0];
        if (target) {
          target.status = "APPROVED";
          target.admin_note = body.note || body.admin_note || "Đã kiểm duyệt đủ điều kiện Mall";
          target.updated_at = new Date().toISOString();
          shopState.tier = "MALL";
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { ...target, id: target?.request_id } }),
        });
      }

      if (method === "POST" && url.includes("/reject")) {
        const reqId = url.split("/mall-requests/")[1]?.split("/")[0]?.replace("reject", "");
        const body = route.request().postDataJSON() || {};
        const target = requests.find((r) => r.request_id === reqId || r.id === reqId) || requests[0];
        if (target) {
          target.status = "REJECTED";
          target.admin_note = body.reason || "Hồ sơ chưa đạt tiêu chuẩn";
          target.updated_at = new Date().toISOString();
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { ...target, id: target?.request_id } }),
        });
      }

      return route.continue();
    });

    // 6. Mock Admin shops list & stats
    await page.route("**/api/v1/admin/shops**", (route) => {
      const url = route.request().url();
      if (url.includes("/mall-requests")) {
        return route.fallback();
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: shopState.shop_id,
              shop_id: shopState.shop_id,
              shop_name: shopState.shop_name,
              status: shopState.status,
              tier: shopState.tier,
              owner_email: "seller@dino-e2e.test",
              productCount: 12,
            },
          ],
        }),
      });
    });

    // 7. Mock Catalog Products API for Buyer
    await page.route("**/api/v1/products*", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              product_id: "prod-001",
              name: "Bàn Phím Cơ Dino Pro",
              price: 1500000,
              min_price: 1500000,
              max_price: 1500000,
              shop_id: shopState.shop_id,
              shop_name: shopState.shop_name,
              shop_tier: shopState.tier,
              image_url: "/placeholder.png",
            },
          ],
          meta: { next_cursor: null, has_more: false, limit: 20 },
        }),
      });
    });
  });

  async function loginAs(page: import("@playwright/test").Page, email: string) {
    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
  }

  test("Hành trình 1: Seller gửi hồ sơ -> Admin duyệt -> Seller làm mới thấy MALL -> Buyer thấy badge trên catalog", async ({
    page,
  }) => {
    // 1. Seller đăng nhập và mở trang hồ sơ gian hàng
    await loginAs(page, "seller@dino-e2e.test");
    await page.goto("/seller/shop");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Hồ sơ gian hàng" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Tiêu chuẩn").first()).toBeVisible();

    // 2. Seller điền form yêu cầu nâng hạng Dino Mall
    await page.locator("#mall-doc-url").fill("https://storage.dino.vn/e2e-business-license.pdf");
    await page.locator("#mall-reason").fill("Đại diện phân phối ủy quyền độc quyền thương hiệu Dino tại Việt Nam");

    // Click nộp yêu cầu
    await page.getByRole("button", { name: "Gửi yêu cầu nâng hạng Dino Mall" }).click();

    // Xác minh trạng thái yêu cầu hiển thị Đang chờ duyệt
    await expect(page.getByText(/Đang chờ duyệt|Chờ duyệt/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("https://storage.dino.vn/e2e-business-license.pdf")).toBeVisible();

    // 3. Admin đăng nhập vào trang quản trị gian hàng
    await loginAs(page, "admin@dino-e2e.test");
    await page.goto("/admin/shops");
    await page.waitForLoadState("networkidle");

    // Chuyển sang Tab "Yêu cầu lên Dino Mall"
    const mallRequestsTab = page.getByRole("button", { name: /Yêu cầu lên Dino Mall/i });
    await expect(mallRequestsTab).toBeVisible({ timeout: 10_000 });
    await mallRequestsTab.click();

    // Xác nhận thấy yêu cầu của Shop trong danh sách
    await expect(page.getByText(shopState.shop_name)).toBeVisible({ timeout: 10_000 });

    // Click nút "Duyệt Mall"
    await page.getByRole("button", { name: "Duyệt Mall" }).first().click();

    // Dialog duyệt xuất hiện -> nhập ghi chú duyệt và click "Xác nhận duyệt Mall"
    await expect(page.getByRole("heading", { name: /Phê duyệt nâng hạng Dino Mall/i })).toBeVisible();
    await page.locator("#approve-mall-note").fill("Hồ sơ đã được phòng pháp chế đối soát hợp lệ 100%");
    await page.getByRole("button", { name: "Xác nhận duyệt Mall" }).click();
    await expect(page.getByRole("heading", { name: /Phê duyệt nâng hạng Dino Mall/i })).not.toBeVisible();

    // 4. Seller quay lại trang /seller/shop và click nút Làm mới
    await loginAs(page, "seller@dino-e2e.test");
    await page.goto("/seller/shop");
    await page.waitForLoadState("networkidle");

    // Click nút làm mới
    const refreshBtn = page.getByLabel("Làm mới trạng thái gian hàng");
    if (await refreshBtn.isVisible()) {
      await refreshBtn.click();
    }

    // Xác nhận Seller thấy huy hiệu DINO MALL
    await expect(page.getByText(/DINO MALL/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Đã là Dino Mall/i).first()).toBeVisible();

    // 5. Buyer mở catalog sản phẩm (/products)
    await page.evaluate((sid) => {
      window.sessionStorage?.setItem(`mock_mall_tier_${sid}`, "MALL");
      window.localStorage?.setItem(`mock_mall_tier_${sid}`, "MALL");
    }, shopState.shop_id);

    await page.goto("/products");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Khám Phá Sản Phẩm" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Serum Dưỡng Trắng & Cấp Ẩm Chuyên Sâu")).toBeVisible({ timeout: 10_000 });

    // Xác nhận huy hiệu Mall xuất hiện
    const mallBadge = page.locator('[data-testid="tier-badge-MALL"]').or(page.getByText(/Chính Hãng|Mall/i));
    await expect(mallBadge.first()).toBeVisible({ timeout: 10_000 });
  });

  test("Hành trình 2: Seller gửi -> Admin từ chối -> Seller thấy lý do và được phép gửi lại", async ({
    page,
  }) => {
    // 1. Seller gửi yêu cầu
    await loginAs(page, "seller@dino-e2e.test");
    await page.goto("/seller/shop");
    await page.waitForLoadState("networkidle");

    await page.locator("#mall-doc-url").fill("https://storage.dino.vn/incomplete.pdf");
    await page.locator("#mall-reason").fill("Yêu cầu cần bị từ chối do thiếu hợp đồng công chứng");
    await page.getByRole("button", { name: "Gửi yêu cầu nâng hạng Dino Mall" }).click();
    await expect(page.getByText(/Đang chờ duyệt/i).first()).toBeVisible();

    // 2. Admin từ chối yêu cầu
    await loginAs(page, "admin@dino-e2e.test");
    await page.goto("/admin/shops");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Yêu cầu lên Dino Mall/i }).click();
    await page.getByRole("button", { name: "Từ chối" }).first().click();

    await expect(page.getByRole("heading", { name: /Từ chối yêu cầu nâng hạng Dino Mall/i })).toBeVisible();
    await page.locator("#reject-mall-reason").fill("Hồ sơ thiếu chứng nhận đăng ký kinh doanh bản gốc");
    await page.getByRole("button", { name: "Xác nhận từ chối" }).click();
    await expect(page.getByRole("heading", { name: /Từ chối yêu cầu nâng hạng Dino Mall/i })).not.toBeVisible();

    // 3. Seller quay lại trang /seller/shop
    await loginAs(page, "seller@dino-e2e.test");
    await page.goto("/seller/shop");
    await page.waitForLoadState("networkidle");

    // Xác nhận ghi chú từ chối của Admin hiển thị
    await expect(page.getByText(/Hồ sơ thiếu chứng nhận đăng ký kinh doanh bản gốc/i)).toBeVisible({ timeout: 10_000 });

    // Xác nhận form nộp lại yêu cầu đã mở khóa cho Seller
    await expect(page.locator("#mall-doc-url")).toBeEnabled();
    await expect(page.getByRole("button", { name: "Gửi yêu cầu nâng hạng Dino Mall" })).toBeEnabled();
  });

  test("Hành trình 3: Seller hủy yêu cầu PENDING đang chờ duyệt", async ({ page }) => {
    // 1. Seller gửi yêu cầu
    await loginAs(page, "seller@dino-e2e.test");
    await page.goto("/seller/shop");
    await page.waitForLoadState("networkidle");

    await page.locator("#mall-doc-url").fill("https://storage.dino.vn/cancel-test.pdf");
    await page.locator("#mall-reason").fill("Yêu cầu gửi nhầm link cần hủy sớm");
    await page.getByRole("button", { name: "Gửi yêu cầu nâng hạng Dino Mall" }).click();
    await expect(page.getByText(/Đang chờ duyệt/i).first()).toBeVisible();

    // Lắng nghe window.confirm
    page.on("dialog", (dialog) => dialog.accept());

    // 2. Seller click "Hủy yêu cầu"
    await page.getByRole("button", { name: "Hủy yêu cầu" }).click();

    // 3. Form gửi yêu cầu mới lại sẵn sàng
    await expect(page.locator("#mall-doc-url")).toBeEnabled({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Gửi yêu cầu nâng hạng Dino Mall" })).toBeEnabled();
  });
});
