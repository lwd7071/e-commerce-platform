# Tiến độ FE — Người 5 (Orders, Review và Admin)

## Trạng thái hiện tại

- Phase/ticket: Phase 5 — O-504 & O-505 hoàn tất (Cụm 2)
- Cập nhật lần cuối: 2026-09-28
- Đang làm: Đã hoàn thành 100% Cụm 2 gồm Ticket O-504 (Seller Orders Queue `/seller/orders`) và O-505 (Fulfillment flow tuần tự: Confirm -> Preparing -> Shipping, Từ chối/hủy đơn với lý do bắt buộc, xử lý 409 conflict). Đã tích hợp kiểm thử đơn vị `frontend/test/seller-orders.spec.ts` (5/5 pass). Toàn bộ test suite 35/35 pass, `next build` 100% thành công.
- Nhánh/PR: thanh-vien-5
- Bị block bởi: Không
- Việc tiếp theo: Triển khai Cụm 3 gồm O-507 (Review Form UI `/orders/[id]/review`) và P-607c (Review media preview).

## Nhật ký theo ngày

### 2026-09-28 (Hoàn thành Cụm 2: O-504 Seller Orders Table & O-505 Sequential Fulfillment Flow)

- **Đã làm:**
  - **1. Triển khai O-504 (Trình bày danh sách đơn bán hàng tại `/seller/orders`):**
    - Cấu hình route `/seller/orders` bọc trong `ProtectedPage allowedRoles={["SELLER", "ADMIN"]}`.
    - Thanh điều hướng phụ mượt mà giữa "Đơn hàng cần xử lý" (`/seller/orders`) và "Danh sách sản phẩm" (`/seller/products`).
    - Thẻ thống kê nhanh hàng đợi xử lý (Quick Queue Stats): `Chờ xác nhận`, `Đang chuẩn bị hàng`, `Đang vận chuyển` với các token màu sắc chuẩn, không dùng màu thô.
    - Bộ lọc trạng thái đa năng gồm `Tất cả` và 6 trạng thái xử lý bán hàng (`PENDING_CONFIRMATION`, `CONFIRMED`, `PREPARING`, `SHIPPING`, `COMPLETED`, `CANCELLED`).
    - Giao diện đáp ứng kép (Dual Responsive): Bảng dữ liệu chi tiết trên Desktop (`table view`) và Danh sách thẻ tinh gọn trên Mobile (`card view`).
  - **2. Triển khai O-505 (Xác nhận & xử lý đơn hàng theo luồng tuần tự):**
    - Thao tác xác nhận đơn: Nút `Xác nhận đơn` chuyển trạng thái `PENDING_CONFIRMATION` -> `CONFIRMED` qua `orderRepo.confirmOrder(id)`.
    - Thao tác tuần tự fulfillment:
      - Khi `CONFIRMED`: Nút `Chuẩn bị hàng` chuyển trạng thái sang `PREPARING`.
      - Khi `PREPARING`: Nút `Giao cho vận chuyển` chuyển trạng thái sang `SHIPPING`.
      - Khi `SHIPPING`: Tuân thủ nghiêm ngặt quy tắc QD11 — Seller không thể tự ý chuyển sang `COMPLETED` (trạng thái chờ người mua xác nhận hoặc webhook vận chuyển).
    - Thao tác từ chối / hủy đơn: Modal `<Dialog>` yêu cầu bắt buộc chọn hoặc nhập lý do hủy (RB-LTT08).
    - Cơ chế phòng ngừa xung đột (Concurrency 409): Khi phát hiện trạng thái đơn hàng đã thay đổi trước đó (HTTP 409 Conflict), hệ thống hiển thị thông báo chi tiết và tự động làm mới danh sách dữ liệu.
  - **3. Cập nhật Repository & API Contract:**
    - Mở rộng `orderApi.getOrders` và `IOrderRepository.getOrders` hỗ trợ lọc theo `shop_id`.
    - Cập nhật `mockOrderRepository.transitionOrder` mô phỏng kiểm tra lỗi 409 cho các đơn hàng ở trạng thái kết thúc chu trình (`CANCELLED`, `COMPLETED`, `DELIVERY_FAILED`).
  - **4. Kiểm thử chất lượng (Quality Gates):**
    - Tạo `frontend/test/seller-orders.spec.ts` kiểm tra 5 kịch bản: Lọc đơn theo `shop_id` & `status`, Xác nhận đơn hàng, Chuyển đổi tuần tự `CONFIRMED -> PREPARING -> SHIPPING`, Hủy đơn kèm lý do, Bắt lỗi 409 xung đột (5/5 PASS).
    - Toàn bộ Vitest frontend: **35/35 tests PASS (100%)**.
    - Typecheck frontend: **0 errors** (`tsc --noEmit`).
    - ESLint frontend: **0 errors**.
    - Next.js Production Build: **100% SUCCESS** (toàn bộ 13 routes tĩnh/động prerender hợp lệ).
- **Quyết định kỹ thuật:**
  - Tối ưu hóa render effect theo chuẩn React 19 / ESLint bằng asynchronous promise callback, tránh hoàn toàn lỗi setState đồng bộ trong effect.
  - Tối ưu hóa UI/UX với các hiệu ứng hover, badge trạng thái `StatusBadge`, định dạng tiền tệ `moneyAdapter.formatVND`, định dạng ngày tháng tiếng Việt.
- **Contract/port thay đổi:**
  - Bổ sung tham số `shop_id` tùy chọn trong `getOrders`.
- **Blocker phát sinh:**
  - Không.
- **Test đã viết:**
  - `frontend/test/seller-orders.spec.ts` — Kiểm thử Seller Orders & Fulfillment Actions — Kết quả: 5/5 PASS.

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
- [x] O-504/O-505 — Seller orders table, confirm & transition actions tuần tự (`/seller/orders`).
- [ ] O-507 — Review form UI (`/orders/[id]/review`).
- [ ] A-704/A-705/A-708 — admin dashboard, user lock/unlock, seller KPI khi API sẵn.
- [ ] A-709 — admin categories page, tiêu thụ category adapter A-700 của Người 3; nối API sau A-701.
- [ ] P-607c — review media UI khi P-606/GAP-09 đóng.
- [ ] Q-805 — RBAC/security gate cho direct URL/API.
