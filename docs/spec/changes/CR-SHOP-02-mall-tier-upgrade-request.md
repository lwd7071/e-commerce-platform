# CR-SHOP-02 — Yêu Cầu Nâng Hạng Gian Hàng Lên Dino Mall (Seller Mall Upgrade Request)

## Trạng thái

**Nghiệm thu từng phần (Partial Acceptance)** — 2026-10-10, triển khai và hoàn thiện trên nhánh `feat/yeu-cau-nang-hang-dino-mall`.
- Logic mã nguồn và chất lượng (Quality Gates: Build, Lint, Typecheck, Prisma Validate, API Types Check) đã đạt 100%.
- Kiểm chứng tích hợp trên PostgreSQL thật (11/11 tests PASS) và kiểm thử trình duyệt thực tế Playwright E2E (3/3 tests PASS).
- **Lý do chưa nghiệm thu toàn bộ:** Migration `20261011100000_shop_mall_requests` chỉ mới kiểm chứng trên schema cô lập của PostgreSQL thật và ephemeral Docker CI; chưa được áp dụng trên cơ sở dữ liệu dùng chung (staging/production) do pipeline GitHub Actions chỉ áp dụng migration remote khi có sự kiện push vào nhánh `dev`/`main`.

## Owner và review

- Owner: Nhóm Phát triển Sàn Dino E-Commerce.
- Nhánh triển khai: `feat/yeu-cau-nang-hang-dino-mall`.
- Phê duyệt: Chủ dự án ngày 2026-10-10, hoàn thiện theo Change Request CR-SHOP-02.
- Cơ sở kỹ thuật: Tương thích với `docs/feature/03-tiering-loyalty.md`, RBAC middleware, Error Observability, OpenAPI và TanStack Query.

## Lý do

Trước đây, việc nâng hạng gian hàng lên `MALL` chỉ có thể do Admin gán thủ công qua `PATCH /api/v1/admin/shops/:id/tier`. Seller không có kênh chính thức để nộp hồ sơ chứng minh đại lý/ủy quyền thương hiệu, không theo dõi được trạng thái xét duyệt, và không có quy trình đối soát hồ sơ rõ ràng.

Quy trình mới thiết lập luồng nghiệp vụ chuẩn:
$$\text{Seller gửi yêu cầu kèm link hồ sơ} \longrightarrow \text{Hệ thống lưu PENDING} \longrightarrow \text{Admin thẩm định hồ sơ} \longrightarrow \begin{cases} \text{Duyệt: Shop lên MALL + override + audit log} \\ \text{Từ chối: Giữ nguyên hạng + ghi chú lý do} \end{cases}$$

## Quyết định kỹ thuật

1. **Bảng dữ liệu `shop_mall_requests`:**
   - Trường dữ liệu: `request_id`, `shop_id`, `seller_id`, `admin_id`, `reason`, `document_url`, `status`, `admin_note`, `reviewed_at`, `cancelled_at`, `created_at`, `updated_at`.
   - Trạng thái hợp lệ: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`.
   - Ràng buộc khóa ngoại `ON DELETE RESTRICT` đối với `shops`, `app_users` (ngăn xóa cascade làm mất hồ sơ pháp lý).
   - CHECK constraint định dạng `document_url` (`document_url ~* '^https?://'`).
   - Partial Unique Index `uq_shop_mall_requests_pending_per_shop` đảm bảo mỗi Shop chỉ có tối đa 1 yêu cầu `PENDING`.
   - Bật RLS và `REVOKE ALL` đối với các role công khai (`PUBLIC`, `anon`, `authenticated`).

2. **Transaction nguyên tử & Chống Deadlock/Race Condition:**
   - Thao tác `approveRequest` chạy trong duy nhất 1 transaction (`withTx`).
   - Thứ tự khóa hàng chống Deadlock:
     1. Khóa bảng `shops` (`SELECT ... FROM shops WHERE shop_id = $1 FOR UPDATE`).
     2. Khóa bảng `shop_mall_requests` (`SELECT ... FROM shop_mall_requests WHERE request_id = $1 FOR UPDATE`).
   - Cập nhật đồng thời khi duyệt: request chuyển `APPROVED`, `shops.tier = 'MALL'`, `shops.tier_override = true`, ghi `moderation_records` (`action = 'UPDATE_TIER'`) và `admin_logs` (`action = 'SHOP_MALL_REQUEST_APPROVE'`).
   - Rollback nguyên tử 100%: Bất kỳ thao tác nào thất bại (kể cả ghi audit log vào `admin_logs`) đều rollback toàn bộ transaction; trạng thái request và tier của shop giữ nguyên vẹn.

3. **Luồng Từ chối (`reject`) và Hủy (`cancel`):**
   - Seller chỉ được hủy (`cancel`) khi yêu cầu còn ở trạng thái `PENDING`.
   - Admin từ chối (`reject`) bắt buộc nhập lý do (`admin_note` tối thiểu 5 ký tự), **giữ nguyên hạng hiện tại của shop**, ghi audit log `admin_logs` (`action = 'SHOP_MALL_REQUEST_REJECT'`).
   - Shop bị từ chối được phép gửi lại yêu cầu mới sau khi cập nhật/bổ sung hồ sơ.

4. **API Endpoints:**
   - Seller:
     - `POST /api/v1/seller/shop/mall-requests` (Nộp yêu cầu kèm `document_url` và `reason`)
     - `GET /api/v1/seller/shop/mall-requests` (Lấy danh sách yêu cầu của shop)
     - `POST /api/v1/seller/shop/mall-requests/:id/cancel` (Hủy yêu cầu đang chờ duyệt)
   - Admin:
     - `GET /api/v1/admin/shops/mall-requests` (Danh sách yêu cầu toàn sàn, hỗ trợ lọc trạng thái và cursor pagination)
     - `POST /api/v1/admin/shops/mall-requests/:id/approve` (Duyệt nâng hạng lên Dino Mall)
     - `POST /api/v1/admin/shops/mall-requests/:id/reject` (Từ chối nâng hạng kèm lý do)

5. **Giao diện Người dùng (Frontend):**
   - Kênh người bán (`SellerShopScreen`): Khu vực Dino Mall hiển thị hạng gian hàng hiện tại, form gửi link hồ sơ + lý do, trạng thái yêu cầu PENDING kèm nút hủy, hiển thị lý do từ chối nếu có, và nút `↻ Làm mới`.
   - Kênh quản trị (`AdminShopsScreen`): Tab chuyên biệt "Yêu cầu lên Dino Mall" kèm badge đếm số lượng PENDING, bảng danh sách hồ sơ với link tài liệu an toàn, Dialog duyệt bắt buộc ghi chú, và Dialog từ chối bắt buộc lý do.

## Bằng chứng kiểm chứng (3 Tầng Kiểm thử Độc lập)

### Tầng 1: Unit & Mock Integration Tests (Node Test Runner)
- File: `backend/test/platform/seller-mall-request.spec.ts`
- Kết quả: **14/14 tests PASS**
- Phạm vi: Domain validation, DTO constraints, Express route ordering (`/admin/shops/mall-requests` trước `/admin/shops/:id`), RBAC guards, mock transactional flow.

### Tầng 2: Kiểm thử Cơ sở dữ liệu PostgreSQL thật (Vitest)
- File: `backend/tests/db/seller-mall-request.integration.test.ts`
- Runner & Môi trường: Vitest chạy trên isolated schema PostgreSQL thật (75.76s).
- Kết quả: **11/11 tests PASS**
- Các kịch bản đã chứng minh:
  1. `document_url NOT NULL` và CHECK constraint regex `^https?://` ngăn chặn dữ liệu không hợp lệ (SQLSTATE 23514 / 23502).
  2. Partial unique index `uq_shop_mall_requests_pending_per_shop` ngăn chặn shop nộp 2 request PENDING đồng thời (SQLSTATE 23505).
  3. Ràng buộc khóa ngoại `ON DELETE RESTRICT` ngăn xóa shop/seller khi đang có request liên quan (SQLSTATE 23503).
  4. RLS kích hoạt và revoke toàn bộ quyền `SELECT/INSERT/UPDATE/DELETE` đối với role `anon` và `authenticated` (SQLSTATE 42501).
  5. Concurrency Race: Hai lệnh submit đồng thời từ cùng một shop -> đúng 1 lệnh thành công, 1 lệnh bị conflict.
  6. Concurrency Race: Admin Duyệt vs Admin Từ chối đồng thời -> đúng 1 lệnh thành công, lệnh sau nhận lỗi conflict.
  7. Concurrency Race: Admin Duyệt vs Seller Hủy đồng thời -> đúng 1 lệnh thành công, không có trạng thái mập mờ.
  8. Atomic Transaction Rollback: Khi thao tác ghi audit log `admin_logs` bị lỗi (mô phỏng bảng audit khóa/lỗi), transaction rollback 100% -> request giữ nguyên `PENDING`, shop giữ nguyên `STANDARD`.
  9. Idempotency: Gửi lại cùng key và payload trả về kết quả đã lưu; gửi cùng key nhưng khác payload trả lỗi 409 Conflict.
  10. Trạng thái không hợp lệ: Từ chối thao tác duyệt/từ chối trên request đã xử lý.

### Tầng 3: Kiểm thử Trình duyệt Thực tế Playwright E2E
- File: `frontend/e2e/seller-mall-request-live.spec.ts`
- Runner & Môi trường: Playwright Browser Runner trên Google Chrome (35.0s).
- Kết quả: **3/3 journeys PASS**
- Các hành trình đã chứng minh:
  1. **Hành trình 1 (Duyệt thành công):** Seller nộp hồ sơ nâng hạng PENDING -> Admin nhận thông báo và duyệt kèm ghi chú -> Seller làm mới thấy hạng gian hàng chuyển sang Dino Mall (`MALL`) -> Buyer truy cập catalog thấy badge Dino Mall trên sản phẩm của Shop.
  2. **Hành trình 2 (Từ chối & nộp lại):** Seller nộp hồ sơ -> Admin từ chối kèm lý do thẩm định -> Seller nhận trạng thái REJECTED và thấy rõ lý do từ chối -> Seller được phép nộp lại hồ sơ mới.
  3. **Hành trình 3 (Seller hủy yêu cầu):** Seller nộp yêu cầu PENDING -> Đổi ý bấm "Hủy yêu cầu" -> Trạng thái chuyển CANCELLED và form nộp hồ sơ mở lại.

## Hướng dẫn Vận hành và Sử dụng

### 1. Dành cho Người bán (Seller)
- Truy cập menu **Quản lý Shop** -> tìm mục **Dino Mall**.
- Nếu shop đang ở hạng `STANDARD` hoặc `PREFERRED`:
  - Nhập **Đường dẫn hồ sơ chứng minh** (bắt buộc dạng URL `https://...` trỏ đến tài liệu chứng nhận phân phối/nhãn hiệu hợp lệ).
  - Nhập **Lý do / Giới thiệu** về thương hiệu.
  - Bấm **Gửi yêu cầu nâng hạng**.
- Sau khi gửi:
  - Yêu cầu ở trạng thái `Đang chờ duyệt (PENDING)`.
  - Trong lúc chờ duyệt, Seller có thể bấm **Hủy yêu cầu** nếu muốn cập nhật lại thông tin.
  - Bấm nút **↻ Làm mới** để cập nhật trạng thái mới nhất từ Admin.
- Khi được duyệt: Nhãn hạng gian hàng đổi thành **Dino Mall**, sản phẩm của shop tự động mang huy hiệu Mall trên sàn.
- Khi bị từ chối: Mục Dino Mall hiển thị trạng thái **Bị từ chối** kèm **Lý do từ chối** từ ban quản trị; Seller có thể nộp lại hồ sơ mới.

### 2. Dành cho Quản trị viên (Admin)
- Truy cập menu **Quản lý Gian hàng (Admin Shops)** -> chọn tab **Yêu cầu lên Dino Mall**.
- Badge số lượng trên tab hiển thị số hồ sơ đang ở trạng thái `PENDING`.
- Xem thông tin hồ sơ: Tên shop, Người nộp, Ngày nộp, Lý do và bấm link **Xem hồ sơ** (mở tab mới an toàn với `rel="noopener noreferrer"`).
- Thẩm định:
  - **Duyệt nâng hạng:** Bấm "Duyệt" -> Nhập ghi chú thẩm định -> Xác nhận. Gian hàng sẽ được nâng lên `MALL` với cờ `tier_override = true`. Thao tác được ghi vào `admin_logs`.
  - **Từ chối:** Bấm "Từ chối" -> Bắt buộc nhập lý do từ chối rõ ràng (tối thiểu 5 ký tự) -> Xác nhận. Gian hàng giữ nguyên hạng hiện tại. Thao tác được ghi vào `admin_logs`.

### 3. Hạn chế Vận hành và Lưu ý
- **Cơ chế cập nhật trạng thái:** Hệ thống hiện tại sử dụng polling/invalidation qua TanStack Query kết hợp nút làm mới chủ động trên giao diện; chưa có WebSocket push thông báo tức thì đến Seller.
- **Áp dụng Migration:** Migration DDL `20261011100000_shop_mall_requests` chỉ được chạy trên staging/production sau khi PR được merge vào nhánh `dev`/`main`. Trong thời gian ở nhánh tính năng, cần đảm bảo database mục tiêu đã chạy migration này trước khi test thủ công.

