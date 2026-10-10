# CR-SHOP-02 — Yêu Cầu Nâng Hạng Gian Hàng Lên Dino Mall (Seller Mall Upgrade Request)

## Trạng thái

**Approved** — 2026-10-10, Chủ dự án duyệt kế hoạch triển khai và đồng ý toàn bộ 4 phương án kỹ thuật:
1. Transaction nguyên tử duy nhất (độc lập `updateShopTier`, không mở transaction con lồng nhau, rollback 100% khi audit log/bất kỳ thao tác nào thất bại).
2. Khóa hàng chống Deadlock và Concurrency Race: Thứ tự khóa nghiêm ngặt `shops` -> `shop_mall_requests`.
3. Hồ sơ xét duyệt thống nhất: Bắt buộc link tài liệu hợp lệ (`document_url`), Admin bắt buộc nhập ghi chú/lý do tối thiểu 5 ký tự.
4. Cơ chế đọc lại (refetch/invalidation) khớp với cấu hình `staleTime: 2 phút` và nút làm mới chuyên biệt của dự án.

## Owner và review

- Owner: Nhóm Phát triển Sàn Dino E-Commerce.
- Phê duyệt: Chỉ thị trực tiếp từ Chủ dự án ngày 2026-10-10, triển khai trên nhánh `feat/yeu-cau-nang-hang-dino-mall`.
- Cơ sở kỹ thuật: Tương thích với `docs/feature/03-tiering-loyalty.md`, RBAC middleware, Error Observability, OpenAPI và TanStack Query.

## Lý do

Trước đây, việc nâng hạng gian hàng lên `MALL` chỉ có thể do Admin gán thủ công qua `PATCH /api/v1/admin/shops/:id/tier`. Seller không có kênh chính thức để nộp hồ sơ chứng minh đại lý/ủy quyền thương hiệu, không theo dõi được trạng thái xét duyệt, và không có quy trình đối soát hồ sơ rõ ràng.

Quy trình mới thiết lập luồng nghiệp vụ chuẩn:
$$\text{Seller gửi yêu cầu kèm link hồ sơ} \longrightarrow \text{Hệ thống lưu PENDING} \longrightarrow \text{Admin thẩm định hồ sơ} \longrightarrow \begin{cases} \text{Duyệt: Shop lên MALL + audit log} \\ \text{Từ chối: Giữ nguyên hạng + ghi chú lý do} \end{cases}$$

## Quyết định được duyệt

1. **Bảng dữ liệu `shop_mall_requests`:**
   - Trường dữ liệu: `request_id`, `shop_id`, `seller_id`, `admin_id`, `reason`, `document_url`, `status`, `admin_note`, `reviewed_at`, `cancelled_at`, `created_at`, `updated_at`.
   - Trạng thái hợp lệ: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`.
   - Ràng buộc khóa ngoại `RESTRICT` đối với `shops`, `app_users` (ngăn xóa cascade làm mất hồ sơ pháp lý).
   - Partial Unique Index `uq_shop_mall_requests_pending_per_shop` đảm bảo mỗi Shop chỉ có tối đa 1 yêu cầu `PENDING`.
   - Bật RLS và `REVOKE ALL` đối với các role công khai (`PUBLIC`, `anon`, `authenticated`).

2. **Transaction nguyên tử & Chống Race Condition:**
   - `approveRequest` chạy trong duy nhất 1 transaction (`withTx`).
   - Thứ tự khóa hàng chống Deadlock:
     1. Khóa bảng `shops` (`SELECT ... FROM shops WHERE shop_id = $1 FOR UPDATE`).
     2. Khóa bảng `shop_mall_requests` (`SELECT ... FROM shop_mall_requests WHERE request_id = $1 FOR UPDATE`).
   - Cập nhật đồng thời: request `APPROVED`, `shops.tier = 'MALL'`, `shops.tier_override = true`, ghi `moderation_records` (`action = 'UPDATE_TIER'`) và `admin_logs` (`action = 'SHOP_MALL_REQUEST_APPROVE'`).
   - Bất kỳ lỗi nào (kể cả lỗi ghi audit log) đều kích hoạt Rollback 100%.

3. **Luồng Từ chối (`reject`) và Hủy (`cancel`):**
   - Seller chỉ được hủy (`cancel`) khi yêu cầu còn ở trạng thái `PENDING`.
   - Admin từ chối (`reject`) bắt buộc nhập lý do (`reason`), không thay đổi hạng Shop, ghi audit log `SHOP_MALL_REQUEST_REJECT`.
   - Shop bị từ chối được phép gửi lại yêu cầu mới sau khi cập nhật hồ sơ.

4. **API Endpoints:**
   - Seller:
     - `POST /api/v1/seller/shop/mall-requests` (Nộp yêu cầu kèm `document_url` và `reason`)
     - `GET /api/v1/seller/shop/mall-requests` (Lấy danh sách yêu cầu của shop)
     - `POST /api/v1/seller/shop/mall-requests/:id/cancel` (Hủy yêu cầu đang chờ duyệt)
   - Admin:
     - `GET /api/v1/admin/shops/mall-requests` (Danh sách yêu cầu toàn sàn, hỗ trợ lọc trạng thái và phân trang cursor)
     - `POST /api/v1/admin/shops/mall-requests/:id/approve` (Duyệt nâng hạng lên Dino Mall)
     - `POST /api/v1/admin/shops/mall-requests/:id/reject` (Từ chối nâng hạng kèm lý do)

5. **Giao diện Người dùng (Frontend):**
   - Kênh người bán (`SellerShopScreen`): Khu vực Dino Mall hiển thị hạng gian hàng hiện tại, form gửi link hồ sơ + lý do, trạng thái yêu cầu PENDING kèm nút hủy, thông báo lý do nếu bị từ chối, và nút `↻ Làm mới`.
   - Kênh quản trị (`AdminShopsScreen`): Tab chuyên biệt "Yêu cầu lên Dino Mall" kèm badge đếm số lượng PENDING, bảng danh sách hồ sơ với link tài liệu an toàn, Dialog duyệt bắt buộc ghi chú, và Dialog từ chối bắt buộc lý do.

## Traceability và Acceptance

- [x] **AC-01:** Seller gửi yêu cầu hợp lệ tạo bản ghi `PENDING`. Shop đang `MALL` hoặc đã có yêu cầu `PENDING` bị từ chối bằng lỗi `409 Conflict`.
- [x] **AC-02:** Seller hủy yêu cầu chuyển trạng thái sang `CANCELLED`. Yêu cầu đã duyệt/từ chối không thể hủy.
- [x] **AC-03:** Admin duyệt yêu cầu nâng hạng `shops.tier` lên `MALL`, bật `tier_override`, ghi `moderation_records` và `admin_logs` trong cùng transaction. Lỗi audit log rollback toàn bộ.
- [x] **AC-04:** Admin từ chối yêu cầu lưu `admin_note`, ghi `admin_logs`, hạng Shop không đổi.
- [x] **AC-05:** Thứ tự route Admin Express: `/admin/shops/mall-requests` được đăng ký trước `/admin/shops/:id` tránh xung đột param.
- [x] **AC-06:** Test tự động bao phủ domain validation, atomic transaction, rollback và guard RBAC cho endpoint Seller & Admin.
