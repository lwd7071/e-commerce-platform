import { expect, test } from "./fixtures";

test.describe("Seller Comprehensive Lifecycle E2E (Shop Profile → Products & Edit → Vouchers → Reports)", () => {
  test("Seller logs in, manages shop profile, edits product, controls vouchers, and views reports", async ({ page }) => {
    const password = process.env.E2E_SEED_PASSWORD ?? "Password123!";

    // Mock API routes to keep E2E reliable and independent of database state
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

    let patchedProductPayload: {
      product_name?: string;
      images?: Array<{ image_id?: string; media_id?: string; image_url?: string; sort_order?: number }>;
    } | null = null;

    await page.route("**/api/v1/media/uploads/presign", (route) => {
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            media_id: "media-e2e-new-001",
            upload_url: "https://mock-storage.test/upload/media-e2e-new-001.png",
            storage_path: "shops/00000000-0000-0000-0000-000000000001/products/prod-e2e-01/media-e2e-new-001.png",
            expires_in_seconds: 3600,
          },
        }),
      });
    });

    await page.route("https://mock-storage.test/**", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "OK",
      });
    });

    await page.route("**/api/v1/media/uploads/*/finalize", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            media_id: "media-e2e-new-001",
            public_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
            storage_path: "shops/00000000-0000-0000-0000-000000000001/products/prod-e2e-01/media-e2e-new-001.png",
            status: "FINALIZED",
          },
        }),
      });
    });

    await page.route("**/api/v1/seller/products/prod-e2e-01", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              product_id: "prod-e2e-01",
              shop_id: "00000000-0000-0000-0000-000000000001",
              category_id: "00000000-0000-0000-0000-000000000001",
              product_name: "Bàn Phím Cơ Dino E2E",
              description: "Bàn phím cơ cao cấp",
              status: "ACTIVE",
              variants: [
                {
                  variant_id: "var-001",
                  variant_name: "Tiêu chuẩn",
                  variant_value: "Mặc định",
                  sku: "SKU-KB-01",
                  price: "750000.00",
                  stock_quantity: 40,
                  status: "ACTIVE",
                },
              ],
              images: [
                {
                  image_id: "img-001",
                  image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600",
                  sort_order: 0,
                },
              ],
            },
          }),
        });
      }
      if (route.request().method() === "PATCH") {
        patchedProductPayload = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              product_id: "prod-e2e-01",
              product_name: "Bàn Phím Cơ Dino E2E Pro",
              status: "ACTIVE",
            },
          }),
        });
      }
      return route.continue();
    });

    await page.route("**/api/v1/seller/vouchers*", (route) => {
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
                status: "ACTIVE",
                start_at: "2026-10-01T00:00:00.000Z",
                end_at: "2026-10-31T23:59:59.000Z",
              },
            ],
          }),
        });
      }
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              voucher_id: "00000000-0000-0000-0000-000000000002",
              shop_id: "00000000-0000-0000-0000-000000000001",
              code: "SELLER100",
              voucher_name: "Giảm 100K",
              discount_type: "FIXED",
              discount_value: "100000.00",
              status: "ACTIVE",
            },
          }),
        });
      }
      return route.continue();
    });

    await page.route("**/api/v1/seller/vouchers/*/status", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            voucher_id: "00000000-0000-0000-0000-000000000001",
            status: "INACTIVE",
          },
        }),
      });
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

    // 0. Sign in as active Seller
    await page.goto("/login?returnTo=%2Fseller%2Fshop");
    await page.getByLabel("Địa chỉ Email").fill("seller-active@dino-e2e.test");
    await page.getByLabel("Mật khẩu").fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/seller\/shop(?:\?|$)/, { timeout: 30_000 });

    // 1. Seller Shop Profile page
    await expect(page.getByRole("heading", { name: "Hồ sơ gian hàng" })).toBeVisible();
    await expect(page.locator("input#shop-name")).toHaveValue("Dino Official Store");
    await expect(page.locator("input#pickup-address")).toHaveValue("123 Đường Công Nghệ, Quận 1");

    // Edit shop details
    const addressInput = page.getByLabel(/Địa chỉ nhận hàng/);
    await addressInput.fill("456 Đường Sáng Tạo, Quận 1");
    await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
    await expect(page.getByText("Đã lưu hồ sơ gian hàng.")).toBeVisible();

    // 2. Edit product page (including image upload and deletion)
    await page.goto("/seller/products/prod-e2e-01/edit");
    await expect(page.getByRole("heading", { name: "Sửa sản phẩm" })).toBeVisible();
    await expect(page.locator("input#seller-product-name")).toHaveValue("Bàn Phím Cơ Dino E2E");
    await expect(page.getByAltText("Ảnh sản phẩm 1")).toBeVisible();

    // Upload a new image
    await page.getByLabel("Tải ảnh sản phẩm").setInputFiles({
      name: "keycap-pro.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
    });
    await expect(page.getByText("Tải ảnh thành công!")).toBeVisible();
    await expect(page.getByAltText("Ảnh sản phẩm 2")).toBeVisible();

    // Delete the first (old) image
    await page.getByLabel("Xóa ảnh 1").click();
    await expect(page.getByAltText("Ảnh sản phẩm 2")).toHaveCount(0);

    // Edit product name and submit changes
    await page.locator("input#seller-product-name").fill("Bàn Phím Cơ Dino E2E Pro");
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(page).toHaveURL(/\/seller\/products(?:\?|$)/, { timeout: 30_000 });

    // Assert that the payload sent to backend retained the new image with media_id and omitted old image
    const payload = patchedProductPayload as {
      product_name?: string;
      images?: Array<{ image_id?: string; media_id?: string; image_url?: string; sort_order?: number }>;
    } | null;
    expect(payload?.product_name).toBe("Bàn Phím Cơ Dino E2E Pro");
    expect(payload?.images).toHaveLength(1);
    expect(payload?.images?.[0]?.media_id).toBe("media-e2e-new-001");

    // 3. Seller Vouchers page
    await page.goto("/seller/vouchers");
    await expect(page.getByRole("heading", { name: "Voucher gian hàng" })).toBeVisible();
    await expect(page.getByText("SELLER50")).toBeVisible();
    // Toggle voucher
    await page.getByRole("button", { name: "Tắt" }).click();
    await expect(page.getByText("Đã tắt voucher.")).toBeVisible();

    // 4. Seller Reports page
    await page.goto("/seller/reports");
    await expect(page.getByRole("heading", { name: "Báo cáo doanh thu" })).toBeVisible();
    await page.getByRole("button", { name: "Xem báo cáo" }).click();
    await expect(page.getByText("5.000.000 ₫")).toBeVisible();
    await expect(page.getByText("25", { exact: true })).toBeVisible();
  });
});
