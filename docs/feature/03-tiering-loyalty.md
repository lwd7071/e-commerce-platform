# Báo cáo: Phân cấp Buyer & Shop (Tiering & Loyalty)

## Owner và trạng thái

- Owner: Chưa xác định
- Người phối hợp: Không
- Trạng thái: Đang làm
- Cập nhật lần cuối: 2026-10-02
- Nhánh / PR / commit: `codex/tiering-loyalty` (cập nhật từ `dev` commit `0811358`)

## Mục tiêu và phạm vi

- Mục tiêu: Xây dựng hệ thống phân hạng tinh gọn và minh bạch cho Shop (STANDARD / PREFERRED / MALL) và Buyer (STANDARD / VIP) kèm cơ chế tích lũy điểm DinoPoint an toàn khi đơn hàng hoàn tất.
- Trong phạm vi được duyệt (P0-1 đến P0-8, Đợt A và Đợt B):
  - Bước 0: Sửa lỗi nền runtime wiring `confirmReceived` trên `createRuntimeApp` và hoàn thiện kiểm tra điều kiện Shipment (P0-9).
  - Đợt A: Bổ sung `tier` cho Shop (`STANDARD`, `PREFERRED`, `MALL`) do Admin quản lý duyệt thủ công kèm audit log bắt buộc theo QD20; hỗ trợ bộ lọc và huy hiệu `TierBadge`.
  - Đợt B: Phân hạng Buyer (`STANDARD`, `VIP`) tự động dựa trên tổng chi tiêu tích lũy `total_spent` (>= 5.000.000 VNĐ). Tích lũy điểm DinoPoint (10.000 VNĐ = 1 điểm cho Standard, x2 cho VIP) và ghi nhận vào bảng Ledger `loyalty_point_transactions`. Hiển thị thông tin thành viên VIP, số dư điểm và tiến trình chi tiêu trong trang Profile của Buyer.
- Ngoài phạm vi:
  - Không backfill dữ liệu cũ (P0-6).
  - Đổi điểm trừ tiền khi checkout hoặc voucher đổi thưởng (P0-5: chỉ tích lũy và hiển thị điểm).
  - Xử lý hoàn điểm/thu hồi điểm khi hoàn tiền/trả hàng (P0-7).
  - Đợt C: Không triển khai cron tự động xét PREFERRED hoặc boost MALL trong tìm kiếm.
  - Trợ lý AI, chat realtime, ví tiền thật.

## Đã thực hiện

- Bước 0: Sửa lỗi wiring `confirmReceived` và kiểm tra quyền hoàn tất đơn:
  - Đấu nối `confirmReceived` vào `orderServices` trong `createRuntimeApp` (`backend/src/platform/http/app.ts`).
  - Mở rộng `OrderServices` interface và ủy thác handler trong `backend/src/platform/http/routes/order-routes.ts`.
  - Thực hiện kiểm tra quyền và điều kiện Shipment P0-9 trong `PgCheckoutService.confirmReceived` (`backend/src/modules/checkout/services/pg-checkout.service.ts`).
  - Viết bộ kiểm thử tích hợp 8/8 tests pass qua `createRuntimeApp` tại `backend/test/platform/order-confirm-received.spec.ts`.

## Thiết kế / quyết định kỹ thuật

- Quyết định P0-9 (Đã chốt với Chủ dự án 2026-10-02):
  - Order phải ở `SHIPPING`.
  - Shipment bắt buộc phải tồn tại trong bảng `shipments`; nếu thiếu trả về `409 SHIPMENT_REQUIRED`.
  - Admin xác nhận phải có `reason` không rỗng; nếu thiếu trả về `422 REASON_REQUIRED`.
  - Trạng thái Shipment chỉ được chuyển sang `DELIVERED` nếu đang ở trạng thái hợp lệ (`SHIPPING` -> `DELIVERED`, hoặc giữ nguyên nếu đã là `DELIVERED`). Nếu ở trạng thái không thể chuyển (ví dụ `FAILED`), từ chối với `409 SHIPMENT_INVALID_STATE`.
  - Cập nhật Shipment `DELIVERED`, Order `COMPLETED`, `order_status_history`, audit log (`admin_logs`) và thông báo được thực thi nguyên tử trong cùng một database transaction.
- Loại bỏ hoàn toàn Floating Point: Sử dụng số học `BigInt` cents chuẩn repository (`order-calculation.ts`) quy đổi 10.000 VNĐ = `1_000_000n` cents.
- Xử lý Duplicate trong PostgreSQL Transaction: Dùng `INSERT ... ON CONFLICT (reference_order_id) WHERE reason = 'ORDER_COMPLETED' DO NOTHING RETURNING transaction_id`. Chỉ tăng chi tiêu và điểm khi `rowCount === 1`. Đơn dưới 10.000 VNĐ vẫn ghi Ledger (`points_delta = 0`) để chống duplicate.
- An toàn Concurrency: Khóa dòng Buyer `SELECT ... FROM app_users WHERE user_id = $1 FOR UPDATE` trong transaction sau khi đã khóa Order. Đọc `old_total_spent` và `old_tier` dưới khóa, tính toán `new_total_spent` và `new_tier` bằng domain logic rồi truyền tham số vào câu lệnh UPDATE.
- Metadata Override cho Shop: Bổ sung các cột `tier_override`, `tier_override_reason`, `tier_overridden_at`, `tier_override_by` vào bảng `shops` để phân biệt hạng thủ công do Admin gán và tự động.
- Tương thích dữ liệu cũ / rollback: Toàn bộ cột thêm mới đều có giá trị `DEFAULT` (`'STANDARD'`, `0`, `FALSE`), bảo đảm Zero Breaking Changes.

## Kiểm tra và kết quả

| Kiểm tra | Lệnh / CI job | Kết quả | Bằng chứng / ghi chú |
|---|---|---|---|
| Runtime Wiring & P0-9 Shipment Integration | `npx tsx --test test/platform/order-confirm-received.spec.ts` | PASS | 8/8 tests pass (Buyer/Admin/Shipment/Role). |
| Backend Node Test Suite | `npm --prefix backend run test:node` | PASS | 700/700 tests pass (197 test suites). |
| Backend Typecheck | `npm --prefix backend run typecheck` | PASS | `tsc --noEmit` 0 errors. |
| Backend Lint | `npm --prefix backend run lint` | PASS | ESLint 0 errors, 0 warnings. |
| Frontend Test Suites | `npm --prefix frontend test` | PASS | 321/321 tests PASS (66 test files). |
| Frontend Typecheck | `npm --prefix frontend run typecheck` | PASS | `tsc --noEmit` 0 errors. |

## An toàn và tình huống lỗi

- Phân quyền / dữ liệu nhạy cảm: Áp dụng RBAC nghiêm ngặt (`requireRole`). Seller tuyệt đối không thể tự nâng tier của shop mình qua `PATCH /seller/shop`. Buyer chỉ xem được điểm và lịch sử của chính mình qua `context.user_id`.
- Retry, request trùng, race condition: Unique Index `uq_loyalty_transactions__order_earned` và cơ chế `FOR UPDATE` khóa dòng Buyer đảm bảo không mất cập nhật hoặc nhân đôi điểm khi 2 đơn hoàn tất đồng thời.
- Hủy, hoàn tiền, rollback: Mọi thao tác cập nhật trạng thái đơn, cập nhật shipment, ghi nhận ledger, tăng chi tiêu và ghi audit log (`admin_logs`) chạy trong một transaction duy nhất. Nếu bất kỳ bước nào lỗi, toàn bộ transaction rollback.

## Việc còn lại và blocker

- [x] Bước 0: Sửa lỗi nền wiring `confirmReceived` và kiểm tra quyền hoàn tất đơn — Owner: Chưa xác định — Trạng thái: Đã triển khai
- [ ] Đợt A: Triển khai migration `shops.tier` & override metadata, Admin tier API, catalog filter và `TierBadge` UI — Owner: Chưa xác định — Trạng thái: Đang làm
- [ ] Đợt B: Triển khai migration `app_users` + `loyalty_point_transactions`, core hook tích điểm, Buyer loyalty API và Profile UI — Owner: Chưa xác định — Trạng thái: Đang làm
- [ ] Đợt C: Đánh giá tự động PREFERRED và composite cursor search boost — Trạng thái: Ngoài phạm vi đợt này
- Blocker: Không có.

## Nhật ký cập nhật

### 2026-10-02 (Bước 0 - Hoàn tất sửa wiring confirmReceived & P0-9)

- Đã làm:
  - Đấu nối `confirmReceived` trong `createRuntimeApp` (`backend/src/platform/http/app.ts`) và `order-routes.ts`.
  - Chốt quyết định P0-9 với Chủ dự án: Order phải ở `SHIPPING`, Shipment bắt buộc tồn tại (`409 SHIPMENT_REQUIRED`), Admin phải có lý do (`422 REASON_REQUIRED`), chuyển trạng thái Shipment sang `DELIVERED` hợp lệ trong cùng transaction.
  - Hiện thực hóa logic kiểm tra và cập nhật Shipment trong `PgCheckoutService.confirmReceived`.
  - Tạo bộ kiểm thử tích hợp qua `createRuntimeApp` tại `backend/test/platform/order-confirm-received.spec.ts` (8/8 tests pass).
  - Kiểm tra toàn bộ 700 tests backend node, typecheck và lint đạt 100% PASS.
- Tiếp theo: Triển khai Đợt A (Shop tiering, Admin tier management, catalog filter và UI TierBadge).

### 2026-10-02 (Khởi tạo kế hoạch & báo cáo)

- Đã làm:
  - Kéo code mới nhất từ nhánh `dev` (commit `0811358 docs: add feature reporting guide`).
  - Tạo nhánh làm việc `codex/tiering-loyalty`.
  - Hoàn thiện kế hoạch chi tiết, loại bỏ floating point, thiết kế transaction nguyên tử chống duplicate bằng `ON CONFLICT DO NOTHING RETURNING`, đối soát state machine và lập bảng 9 quyết định P0.
  - Khởi tạo file báo cáo tiến độ `docs/feature/03-tiering-loyalty.md`.
