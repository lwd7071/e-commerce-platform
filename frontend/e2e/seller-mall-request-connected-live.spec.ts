import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Playwright E2E Thực Tế: Nối Frontend, Backend và Database Test Thật (CR-SHOP-02)
 *
 * Kiểm tra toàn bộ luồng nghiệp vụ trên hệ thống live thực tế:
 * - KHÔNG mock auth (dùng Supabase Auth thật hoặc Backend Auth thật).
 * - KHÔNG mock API của luồng cần kiểm chứng bằng page.route().
 * - KHÔNG ghi mock_mall_tier vào sessionStorage hay localStorage để tạo badge.
 * - Dữ liệu, trạng thái xét duyệt và phân hạng gian hàng được lưu và truy vấn từ Database thật.
 *
 * 3 Hành trình cần kiểm chứng:
 * 1. Journey 1: Seller gửi hồ sơ -> Admin duyệt -> Seller làm mới thấy MALL -> Buyer tải lại thấy badge trên catalog.
 * 2. Journey 2: Seller gửi -> Admin từ chối kèm lý do -> Seller thấy lý do và được phép nộp lại hồ sơ mới.
 * 3. Journey 3: Seller gửi yêu cầu PENDING -> Seller hủy yêu cầu -> Trạng thái chuyển CANCELLED và form nộp mở lại.
 */

// Thông tin tài khoản E2E thực tế được cung cấp qua biến môi trường
const sellerEmail = process.env.E2E_SELLER_EMAIL ?? "seller-active@dino-e2e.test";
const sellerPassword = process.env.E2E_SEED_PASSWORD ?? process.env.E2E_SELLER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@dino-e2e.test";
const adminPassword = process.env.E2E_SEED_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD;

// Địa chỉ Backend API thực tế
const backendApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

/**
 * Hàm kiểm tra an toàn và xác minh môi trường trước khi chạy kiểm thử
 */
async function verifyTestEnvironmentSafety(request: APIRequestContext) {
  const blockers: string[] = [];

  // 1. Tuyệt đối không chạy trên Production
  if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_RELEASE_PHASE === "production") {
    throw new Error("CHẶN TUYỆT ĐỐI: Không chạy E2E test trên môi trường Production!");
  }

  // 2. Kiểm tra tài khoản E2E mật khẩu
  if (!sellerPassword || !adminPassword) {
    blockers.push("Thiếu E2E_SEED_PASSWORD (hoặc E2E_SELLER_PASSWORD / E2E_ADMIN_PASSWORD) để đăng nhập tài khoản thật.");
  }

  // 3. Kiểm tra kết nối tới Backend API server thật
  let backendHealthy = false;
  try {
    const healthRes = await request.get(`${backendApiUrl.replace(/\/api\/v1\/?$/, "")}/api/v1/health`, {
      timeout: 3000,
    });
    if (healthRes.ok()) {
      backendHealthy = true;
    } else {
      blockers.push(`Backend API phản hồi mã lỗi ${healthRes.status()} tại ${backendApiUrl}/health`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    blockers.push(`Backend API server không phản hồi tại ${backendApiUrl} (Lỗi: ${msg || "Connection refused"}). Cần khởi chạy backend server trước.`);
  }

  // 4. Kiểm tra xem database test riêng đã được áp dụng migration shop_mall_requests chưa
  if (backendHealthy) {
    try {
      // Kiểm tra sơ bộ endpoint mall-requests xem bảng đã tồn tại chưa
      const pingRes = await request.get(`${backendApiUrl}/seller/shop/mall-requests`, {
        timeout: 3000,
      });
      // 401 Unauthorized là bình thường vì chưa có token, nhưng nếu 500 kèm lỗi quan hệ chưa tồn tại thì schema chưa migrate
      if (pingRes.status() === 500) {
        const text = await pingRes.text();
        if (text.includes("relation \"shop_mall_requests\" does not exist") || text.includes("42P01")) {
          blockers.push("Cơ sở dữ liệu kết nối chưa được áp dụng migration 20261011100000_shop_mall_requests.");
        }
      }
    } catch {
      // Bỏ qua lỗi kết nối ở bước ping
    }
  }

  // 5. Xác minh cờ database test độc lập
  const isDedicatedTestDb =
    process.env.DATABASE_ENVIRONMENT === "test" ||
    process.env.EXPECTED_SUPABASE_PROJECT_REF === "localtest" ||
    process.env.RUN_REAL_E2E_TEST === "true";

  if (!isDedicatedTestDb) {
    blockers.push("Chưa xác minh cờ DATABASE_ENVIRONMENT=test hoặc RUN_REAL_E2E_TEST=true để đảm bảo không dùng database dùng chung/production chưa được xác nhận.");
  }

  return blockers;
}

test.describe("Seller Dino Mall Upgrade — Live Connected E2E (Frontend + Backend + Real Test DB)", () => {
  let envBlockers: string[] = [];

  test.beforeAll(async ({ request }) => {
    envBlockers = await verifyTestEnvironmentSafety(request);
  });

  test.beforeEach(async ({}, testInfo) => {
    if (envBlockers.length > 0) {
      testInfo.annotations.push({
        type: "environment_blocker",
        description: `Môi trường test thật chưa sẵn sàng:\n- ${envBlockers.join("\n- ")}`,
      });
    }
  });

  test("Hành trình 1: Seller gửi hồ sơ -> Admin duyệt -> Seller làm mới thấy MALL -> Buyer tải lại thấy badge", async ({ page }) => {
    test.skip(
      envBlockers.length > 0,
      `Bỏ qua vì thiếu môi trường live test thật: ${envBlockers.join("; ")}`,
    );

    const docUrl = `https://brand.dino-e2e.test/cert-${Date.now()}.pdf`;
    const submitReason = `Hồ sơ đại lý chính hãng Dino Mall E2E Live ${Date.now()}`;
    const approvalNote = `Admin thẩm định hồ sơ chính hãng hợp lệ lúc ${new Date().toISOString()}`;

    // 1. SELLER ĐĂNG NHẬP THẬT QUA GIAO DIỆN
    await page.goto("/login?returnTo=%2Fseller%2Fshop");
    await page.getByLabel("Địa chỉ Email").fill(sellerEmail);
    await page.getByLabel("Mật khẩu").fill(sellerPassword!);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    // Chờ điều hướng vào màn hình Kênh Người Bán
    await expect(page).toHaveURL(/\/seller\/shop(?:\?|$)/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Quản lý thông tin Shop/i })).toBeVisible({ timeout: 15_000 });

    // 2. SELLER NỘP HỒ SƠ LÊN DINO MALL (GỌI API BACKEND THẬT, KHÔNG MOCK)
    const docInput = page.getByLabel(/Đường dẫn hồ sơ chứng minh/i);
    const reasonInput = page.getByLabel(/Lý do \/ Giới thiệu/i);

    // Chờ form nộp hồ sơ hiển thị
    await expect(docInput).toBeVisible({ timeout: 10_000 });
    await docInput.fill(docUrl);
    await reasonInput.fill(submitReason);

    // Lắng nghe phản hồi HTTP thực tế từ backend
    const submitResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/v1/seller/shop/mall-requests") && res.request().method() === "POST",
      { timeout: 15_000 },
    );

    await page.getByRole("button", { name: /Gửi yêu cầu nâng hạng/i }).click();

    const submitResponse = await submitResponsePromise;
    expect(submitResponse.status(), "API backend nộp hồ sơ phải trả mã thành công (201 Created)").toBe(201);
    const submitBody = await submitResponse.json();
    const createdRequestId = submitBody?.data?.request_id || submitBody?.data?.id;
    expect(createdRequestId).toBeTruthy();

    // Xác minh giao diện Seller hiển thị trạng thái Đang chờ duyệt (PENDING)
    await expect(page.getByText(/Đang chờ duyệt/i).first()).toBeVisible({ timeout: 10_000 });

    // 3. ADMIN ĐĂNG NHẬP THẬT ĐỂ THẨM ĐỊNH HỒ SƠ
    await page.goto("/login?returnTo=%2Fadmin%2Fshops");
    await page.getByLabel("Địa chỉ Email").fill(adminEmail);
    await page.getByLabel("Mật khẩu").fill(adminPassword!);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/admin\/shops(?:\?|$)/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Quản lý gian hàng/i })).toBeVisible({ timeout: 15_000 });

    // Mở tab "Yêu cầu lên Dino Mall"
    const mallTab = page.getByRole("tab", { name: /Yêu cầu lên Dino Mall/i });
    await mallTab.click();

    // Chờ danh sách yêu cầu hiển thị từ Backend thật
    const requestRow = page.locator("tr").filter({ hasText: submitReason }).first();
    await expect(requestRow).toBeVisible({ timeout: 15_000 });

    // Click nút "Duyệt" trên dòng yêu cầu
    const approveBtn = requestRow.getByRole("button", { name: /^Duyệt$/i });
    await approveBtn.click();

    // Dialog duyệt xuất hiện -> nhập ghi chú thẩm định
    const dialogHeading = page.getByRole("heading", { name: /Duyệt yêu cầu lên Dino Mall/i });
    await expect(dialogHeading).toBeVisible({ timeout: 5_000 });

    const noteInput = page.getByLabel(/Ghi chú phê duyệt/i);
    await noteInput.fill(approvalNote);

    // Lắng nghe API duyệt từ Backend thật
    const approveResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/admin/shops/mall-requests/${createdRequestId}/approve`) &&
        res.request().method() === "POST",
      { timeout: 15_000 },
    );

    await page.getByRole("button", { name: /Xác nhận duyệt/i }).click();

    const approveResponse = await approveResponsePromise;
    expect(approveResponse.status(), "API backend duyệt phải trả về 200 OK").toBe(200);

    // 4. SELLER LÀM MỚI SHOP -> THẤY HẠNG DINO MALL THẬT (KHÔNG DÙNG LOCALSTORAGE MOCK)
    await page.goto("/seller/shop");
    await expect(page.getByRole("heading", { name: /Quản lý thông tin Shop/i })).toBeVisible({ timeout: 15_000 });

    // Click nút làm mới để refetch trạng thái từ server
    const refreshBtn = page.getByRole("button", { name: /Làm mới/i });
    if (await refreshBtn.isVisible()) {
      await refreshBtn.click();
    }

    // Xác minh thẻ hạng hiển thị Dino Mall
    await expect(page.getByText(/Dino Mall/i).first()).toBeVisible({ timeout: 10_000 });

    // 5. BUYER TẢI LẠI CATALOG -> THẤY HUY HIỆU DINO MALL TRÊN SẢN PHẨM CỦA SHOP
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: /Tất cả sản phẩm/i })).toBeVisible({ timeout: 20_000 });

    // Lọc theo Dino Mall
    const mallChip = page.getByRole("button", { name: /Chính hãng \(Mall\)/i });
    if (await mallChip.isVisible()) {
      await mallChip.click();
      await page.waitForLoadState("networkidle");
    }

    // Badge Dino Mall hiển thị từ dữ liệu shop_tier thật trả về từ PostgreSQL
    const mallBadge = page.locator('[data-testid="tier-badge-MALL"]').or(page.getByText("Chính Hãng", { exact: false }));
    await expect(mallBadge.first()).toBeVisible({ timeout: 15_000 });
  });

  test("Hành trình 2: Seller gửi -> Admin từ chối kèm lý do -> Seller thấy lý do và được phép nộp lại", async ({ page }) => {
    test.skip(
      envBlockers.length > 0,
      `Bỏ qua vì thiếu môi trường live test thật: ${envBlockers.join("; ")}`,
    );

    const docUrl = `https://brand.dino-e2e.test/expired-cert-${Date.now()}.pdf`;
    const submitReason = `Hồ sơ đại lý thử nghiệm từ chối ${Date.now()}`;
    const rejectionNote = `Hồ sơ ủy quyền phân phối không đủ tính pháp lý ngày ${Date.now()}`;

    // 1. Seller nộp hồ sơ
    await page.goto("/seller/shop");
    await expect(page.getByRole("heading", { name: /Quản lý thông tin Shop/i })).toBeVisible({ timeout: 15_000 });

    const docInput = page.getByLabel(/Đường dẫn hồ sơ chứng minh/i);
    await expect(docInput).toBeVisible({ timeout: 10_000 });
    await docInput.fill(docUrl);
    await page.getByLabel(/Lý do \/ Giới thiệu/i).fill(submitReason);

    const submitResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/v1/seller/shop/mall-requests") && res.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /Gửi yêu cầu nâng hạng/i }).click();

    const submitResponse = await submitResponsePromise;
    expect(submitResponse.status()).toBe(201);
    const submitBody = await submitResponse.json();
    const createdRequestId = submitBody?.data?.request_id || submitBody?.data?.id;

    // 2. Admin thẩm định và Từ chối
    await page.goto("/admin/shops");
    await page.getByRole("tab", { name: /Yêu cầu lên Dino Mall/i }).click();

    const requestRow = page.locator("tr").filter({ hasText: submitReason }).first();
    await expect(requestRow).toBeVisible({ timeout: 15_000 });

    await requestRow.getByRole("button", { name: /^Từ chối$/i }).click();
    await expect(page.getByRole("heading", { name: /Từ chối yêu cầu lên Dino Mall/i })).toBeVisible();

    await page.getByLabel(/Lý do từ chối/i).fill(rejectionNote);

    const rejectResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/admin/shops/mall-requests/${createdRequestId}/reject`) &&
        res.request().method() === "POST",
      { timeout: 15_000 },
    );

    await page.getByRole("button", { name: /Xác nhận từ chối/i }).click();
    const rejectResponse = await rejectResponsePromise;
    expect(rejectResponse.status()).toBe(200);

    // 3. Seller quay lại màn hình Shop -> Thấy lý do từ chối và form nộp mở lại
    await page.goto("/seller/shop");
    await expect(page.getByText(/Bị từ chối/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(rejectionNote).first()).toBeVisible({ timeout: 10_000 });

    // Form nộp mới sẵn sàng
    await expect(page.getByLabel(/Đường dẫn hồ sơ chứng minh/i)).toBeEnabled();
  });

  test("Hành trình 3: Seller nộp yêu cầu PENDING -> Hủy yêu cầu thành công", async ({ page }) => {
    test.skip(
      envBlockers.length > 0,
      `Bỏ qua vì thiếu môi trường live test thật: ${envBlockers.join("; ")}`,
    );

    const docUrl = `https://brand.dino-e2e.test/pending-cert-${Date.now()}.pdf`;
    const submitReason = `Hồ sơ muốn tự hủy ${Date.now()}`;

    await page.goto("/seller/shop");
    await expect(page.getByRole("heading", { name: /Quản lý thông tin Shop/i })).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/Đường dẫn hồ sơ chứng minh/i).fill(docUrl);
    await page.getByLabel(/Lý do \/ Giới thiệu/i).fill(submitReason);

    const submitResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/v1/seller/shop/mall-requests") && res.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /Gửi yêu cầu nâng hạng/i }).click();
    const submitResponse = await submitResponsePromise;
    expect(submitResponse.status()).toBe(201);
    const submitBody = await submitResponse.json();
    const createdRequestId = submitBody?.data?.request_id || submitBody?.data?.id;

    // Nút Hủy yêu cầu hiển thị
    const cancelBtn = page.getByRole("button", { name: /Hủy yêu cầu/i });
    await expect(cancelBtn).toBeVisible({ timeout: 10_000 });

    const cancelResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/seller/shop/mall-requests/${createdRequestId}/cancel`) &&
        res.request().method() === "POST",
      { timeout: 15_000 },
    );

    await cancelBtn.click();
    // Xác nhận dialog nếu có
    const confirmCancelBtn = page.getByRole("button", { name: /^Xác nhận|Đồng ý$/i });
    if (await confirmCancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmCancelBtn.click();
    }

    const cancelResponse = await cancelResponsePromise;
    expect(cancelResponse.status()).toBe(200);

    // Trạng thái chuyển sang CANCELLED và form nộp mở lại
    await expect(page.getByText(/Đã hủy/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/Đường dẫn hồ sơ chứng minh/i)).toBeEnabled();
  });
});
