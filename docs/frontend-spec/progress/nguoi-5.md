# Tiến độ FE — Người 5 (Orders, Review và Admin)

## Trạng thái hiện tại

- Phase/ticket: Phase 5 — O-502 & O-503 hoàn tất
- Cập nhật lần cuối: 2026-09-28
- Đang làm: Đã hoàn thành 100% Ticket O-502 (Buyer Order Center `/orders`) và O-503 (Cancel Order Dialog). Đã tích hợp kiểm thử đơn vị `frontend/test/orders.spec.ts` (4/4 pass). Đảm bảo chuẩn UI/UX tokens và WCAG AA.
- Nhánh/PR: thanh-vien-5
- Bị block bởi: Không
- Việc tiếp theo: Triển khai O-504 / O-505 (Seller orders table, confirm & transition actions tuần tự) tại `/seller/orders`.

## Nhật ký theo ngày

### 2026-09-28 (Hoàn thành O-502 Buyer Order Center và O-503 Cancel Order)

- **Đã làm:**
  - **1. Triển khai O-502 (Buyer Order Center tại `frontend/src/app/orders/page.tsx` và `frontend/src/features/orders/`):**
    - Cấu hình route `/orders` bọc trong `ProtectedPage allowedRoles={["BUYER"]}`, metadata chuẩn "Đơn hàng của tôi - Dino".
    - Xây dựng thanh lọc 8 tabs gồm "Tất cả" và 7 trạng thái chuẩn Backend (`PENDING_CONFIRMATION`, `CONFIRMED`, `PREPARING`, `SHIPPING`, `COMPLETED`, `CANCELLED`, `DELIVERY_FAILED`) dùng `.filter-tabs` và `.filter-tab` có `aria-pressed`.
    - Component `OrderCard`: Trình bày mã đơn bằng `Geist Mono`, ngày đặt, gian hàng, badge trạng thái `StatusBadge`, danh sách sản phẩm (tên, phân loại, giá, số lượng), chi tiết thanh toán (tiền hàng, giảm giá, phí ship 0₫ theo contract, tổng thanh toán).
    - Xử lý liên kết với Người 4: Đọc query param `?created=<ids>` từ trang `/checkout` chuyển sang để highlight đơn hàng vừa đặt và hiển thị banner thông báo chúc mừng.
    - Đầy đủ các trạng thái giao diện theo quy chuẩn: Skeleton khi tải, `EmptyState` khi không có đơn kèm nút điều hướng đến `/products`, `ErrorState` khi lỗi kèm nút thử lại.
  - **2. Triển khai O-503 (Cancel Order Modal & Validation):**
    - Modal `CancelOrderDialog` dùng component `<Dialog>` chuẩn accessible: Danh sách lý do hủy định sẵn + ô nhập chi tiết khi chọn "Lý do khác".
    - Bắt buộc nhập `reason` hợp lệ (không để trống) theo quy tắc RB-LTT08.
    - Xử lý trường hợp 409 Conflict / `ORDER_CANCELLATION_NOT_ALLOWED`: Thông báo rõ ràng cho người dùng khi đơn hàng đã bị đổi trạng thái từ phía seller và tự động làm mới danh sách.
  - **3. Cập nhật Repository & Mock Contract:**
    - Cập nhật `order.api.ts`: Chuẩn hóa `WireOrder` dùng `OrderStatus`, bổ sung endpoint `cancelOrder(id, reason)`.
    - Cập nhật `types.ts` và `repository-factory.ts`: Thêm `cancelOrder` vào `IOrderRepository`, xây dựng `inMemoryMockOrders` phong phú với dữ liệu mẫu nhiều trạng thái, hỗ trợ cập nhật status sang `CANCELLED`.
  - **4. Kiểm thử chất lượng (Quality Gates):**
    - Viết `frontend/test/orders.spec.ts` kiểm tra bộ tabs, lọc theo trạng thái, hủy đơn thành công và chặn hủy đơn 409 khi đơn đã xác nhận (4/4 tests PASS).
    - Chạy full test suite frontend: **30/30 tests PASS (100%)**.
    - Typecheck frontend: **0 errors** (`tsc --noEmit`).
- **Quyết định kỹ thuật:**
  - Áp dụng triệt để nguyên tắc Ponytail: Tối đa hóa tái sử dụng các component có sẵn (`ProtectedPage`, `Dialog`, `Button`, `StatusBadge`, `FormField`, `TextArea`, `EmptyState`, `Skeleton`, `moneyAdapter`), diff gọn gàng, ít file.
  - Sử dụng Suspense bọc `OrdersScreen` tại `app/orders/page.tsx` để xử lý `useSearchParams` an toàn theo chuẩn Next.js App Router.
- **Contract/port thay đổi:**
  - Bổ sung `cancelOrder(id: string, reason: string)` vào `orderApi` và `IOrderRepository`.
- **Blocker phát sinh:**
  - Không.
- **Test đã viết:**
  - `frontend/test/orders.spec.ts` — Kiểm thử Orders Center & Cancel Lifecycle — Kết quả: 4/4 PASS.

### 2026-09-28 (Khởi động FE & Đối soát Đặc tả Frontend Người 5)

- **Đã làm:**
  - Đồng bộ nhánh `dev` mới nhất: Kéo toàn bộ foundation FE mẫu (`ecommerce-web/src/app/orders/page.tsx`, `orders/[id]/review/page.tsx`, `admin/categories/page.tsx`, `seller/page.tsx`).
  - Đối soát API Contract (`docs/frontend-spec/05-api-contract.md`): Rà soát các endpoint Order Lifecycle mà Người 5 phụ trách (`POST /orders/{id}/cancel`, `POST /orders/{id}/confirm`, `POST /orders/{id}/transition`, `POST /orders/{id}/payments`), đảm bảo request/response payload, headers (Idempotency-Key) và error codes (`PAYMENT_STATE_INVALID`, `ORDER_CANCELLATION_NOT_ALLOWED`, `ORDER_INVALID_TRANSITION`) khớp 1-1 giữa Backend và Frontend.
  - Lập kế hoạch component cho Màn hình Orders & Timeline: chuẩn bị state transition helpers, cancellation dialog, reason input validation theo RB-LTT08.
- **Quyết định kỹ thuật:**
  - Tái sử dụng contract error code chuẩn hóa từ Backend envelope `{ success, data, error: { code, message }, meta }` cho các xử lý UI thông báo lỗi.
- **Blocker phát sinh:**
  - Không.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| Order status/actions + reason | Người 4 | State machine/role/409 fixture + test | Đã sẵn sàng | [backend/src/modules/order/domain/order-state-machine.ts](../../backend/src/modules/order/domain/order-state-machine.ts) |
| Admin/category consumer | Người 3 | Category adapter input, moderation/readiness | Sẵn sàng phối hợp | [docs/frontend-spec/05-api-contract.md](../05-api-contract.md) |
| Seller KPI/reporting UI | Người 1, 3 | Date range, timezone, server totals contract | Đã sẵn sàng (QD19) | [backend/src/modules/reporting/services/reporting.service.ts](../../backend/src/modules/reporting/services/reporting.service.ts) |

## Việc được giao

- [x] O-502 — Buyer order center (`/orders`), tabs 7 trạng thái, order card, loading/empty/error states.
- [x] O-503 — Cancel order dialog, bắt buộc nhập lý do (RB-LTT08), xử lý 409 conflict tự động làm mới.
- [ ] O-504/O-505 — Seller orders table, confirm & transition actions tuần tự (`/seller/orders`).
- [ ] O-507 — Review form UI (`/orders/[id]/review`).
- [ ] A-704/A-705/A-708 — admin dashboard, user lock/unlock, seller KPI khi API sẵn.
- [ ] A-709 — admin categories page, tiêu thụ category adapter A-700 của Người 3; nối API sau A-701.
- [ ] P-607c — review media UI khi P-606/GAP-09 đóng.
- [ ] Q-805 — RBAC/security gate cho direct URL/API.
