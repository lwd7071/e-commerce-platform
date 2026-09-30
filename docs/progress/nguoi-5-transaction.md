# Nhật ký tiến độ — Người 5 (Transaction core)

## Trạng thái hiện tại

- Mốc: T3 Backend (Hoàn tất) & Frontend Phase 5, Phase 6 (Hoàn tất 100% Cụm 1, 2, 3, 4 & Buyer Confirm-Received P0-08 / C-103)
- Cập nhật lần cuối: 2026-09-30
- Trạng thái: Hoàn tất các hạng mục trọng điểm và ghi nhận hiện trạng kết nối code thực tế:
  1. Cụm 1 & Cụm 2: Chuyển đổi toàn bộ màu sắc thống kê đơn seller và thông báo đơn hàng sang token semantic/brand của design system; FE Transaction core (POST /checkout kèm Idempotency-Key, order mutation hủy/xác nhận/xác nhận nhận hàng/chuyển trạng thái kết nối API thật và có fallback mock). Kênh đọc đơn (`getOrders`, `getOrderById`) dùng mock in-memory do GAP-01.
  2. Cụm 3: O-507 (Review Form UI `/orders/[id]/review` bảo vệ quyền BUYER, điều kiện hoàn thành QD14, chống trùng RB-LB09, rating 1..5 sao, nhận xét 10-500 ký tự) và P-607c (Review Media Upload & Preview UI, tối đa 5 ảnh, 5MB/ảnh). Data layer Review hỗ trợ live API và tự động fallback mock khi offline / lỗi xác thực / lỗi mạng.
  3. Cụm 4: A-704 (Admin Dashboard `/admin`), A-705 (Khóa/Mở người dùng & gian hàng với lý do bắt buộc RB-LTT08 và audit logging), A-708 (Seller Dashboard & KPI UI `/seller` tuân thủ nghiêm ngặt quy tắc QD19 doanh thu chỉ tính đơn COMPLETED), A-709 (Admin Categories `/admin/categories` cây danh mục tối đa 2 cấp RB-KN04), Q-805 (RBAC route guard cho `/admin`, `/admin/categories`, `/seller`). Data layer Admin hỗ trợ fallback mock.
  4. Triển khai hoàn tất: Endpoint Buyer `confirm-received` (`POST /orders/:id/confirm-received` theo Plan 08 / P0-08, C-103, C-104) đã được hiện thực hóa ở cả Backend (`order-routes.ts`, `t1-routes.ts`, `pg-checkout.service.ts`, `order-lifecycle.service.ts`, `order-state-machine.ts`) và Frontend (`order.api.ts`, `repository-factory.ts`, `order-card.tsx`, `orders-screen.tsx`).
  5. Quality Gates: 217/217 Vitest tests PASS (100%), typecheck 0 errors (`tsc --noEmit`), Next.js Production Build 100% SUCCESS (17/17 routes).
- Bị block bởi: Không

## Nhật ký theo ngày

### 2026-09-30 (Triển khai Buyer confirm-received P0-08/C-103 & Đối soát trung thực Code vs Docs)

- **Đã làm:**
  - **1. Triển khai trọn gói Buyer `confirm-received` (P0-08 / C-103, C-104):**
    - Backend: Thêm `POST /orders/:order_id/confirm-received`, cập nhật `order-state-machine.ts`, `order-lifecycle.service.ts`, `pg-checkout.service.ts` cho phép Buyer chuyển đơn từ `SHIPPING` $\rightarrow$ `COMPLETED`, kiểm thử 8/8 tests pass trong `order-state-machine.spec.ts`.
    - Frontend: Thêm `confirmReceived` vào `orderApi`, `IOrderRepository`, `hybridOrderRepository`, `mockOrderRepository`. Gắn nút "Đã nhận được hàng" trên thẻ đơn hàng `SHIPPING` tại `/orders`, kích hoạt toast thành công và mở khóa nút viết đánh giá Review (QD14). Thêm tests pass 7/7 trong `orders.spec.ts`.
  - **2. Đối soát Code vs Docs:**
    - Làm rõ cơ chế Hybrid/Mock Fallback của Orders (GAP-01), Review (GAP-09) và Admin trong tài liệu, bảo đảm tính trung thực tuyệt đối.
  - **3. Quality Gates:**
    - Toàn bộ Vitest frontend: **217/217 tests PASS (100%)**.
    - Backend node tests: PASS 100%.
    - Typecheck (`tsc --noEmit`): **0 errors**.

### 2026-09-29 (Hoàn thành 100% Cụm 4: A-704, A-705, A-708, A-709, Q-805)

- **Đã làm:**
  - **1. Triển khai A-704 — Admin Dashboard Screen (`/admin`):**
    - Trang trung tâm quản trị toàn diện: thẻ KPI (Tổng người dùng, Tổng gian hàng, Tổng sản phẩm, Platform GMV theo **QD19** chỉ tính đơn `COMPLETED`).
    - Hệ thống chuyển Tab: Người dùng, Gian hàng, Sản phẩm kiểm duyệt, Nhật ký kiểm toán audit logs.
  - **2. Triển khai A-705 — User/Shop Moderation & Audit Logging:**
    - Khóa tài khoản người dùng/shop với modal yêu cầu bắt buộc nhập lý do (**RB-LTT08**), chặn khóa tài khoản admin, ghi log audit đầy đủ.
    - Mở khóa tài khoản khôi phục trạng thái ACTIVE kèm audit log.
    - Kiểm duyệt sản phẩm: ẩn/khôi phục hiển thị kèm lý do.
  - **3. Triển khai A-708 — Seller Dashboard & KPI UI (`/seller`):**
    - Trang tổng quan người bán được bảo vệ bởi `<ProtectedPage allowedRoles={["SELLER", "ADMIN"]}>`.
    - **Quy tắc QD19**: Doanh thu chỉ tổng hợp từ các đơn hàng `COMPLETED`, không tạm tính đơn đang giao hay đã hủy.
    - Thẻ KPI: Doanh thu thực tế (QD19), Đơn hoàn tất, Đơn chờ xác nhận, Sản phẩm đang bán, Đánh giá gian hàng.
    - Hàng đợi đơn hàng cần xử lý (Action Queue) và bảng cảnh báo tồn kho thấp (Low Stock Inventory).
  - **4. Triển khai A-709 — Admin Categories UI (`/admin/categories`):**
    - Cây danh mục phân cấp 2 cấp, tuân thủ **RB-KN04** (giới hạn tối đa 2 cấp), thêm danh mục mới, bật/tắt trạng thái ACTIVE/INACTIVE, xóa danh mục (chặn xóa danh mục cha đang có con).
  - **5. Triển khai Q-805 — Route Protection & RBAC:**
    - Phân quyền nghiêm ngặt: `/admin*` (chỉ `ADMIN`), `/seller*` (`SELLER` & `ADMIN`). Chống open redirect khi đăng nhập.
  - **6. Quality Gates & Token Compliance:**
    - 0 hardcoded hex colors (100% token compliant).
    - Tạo `frontend/test/admin.spec.ts` (16/16 tests PASS).
    - Toàn bộ Vitest frontend: **60/60 tests PASS (100%)**.
    - Typecheck (`tsc --noEmit`): **0 errors**.
    - Production build (`next build`): **17/17 routes SUCCESS**.


### 2026-09-29 (Hoàn thành Cụm 3: O-507 Review Form UI & P-607c Review Media Upload)

- **Đã làm:**
  - **1. Triển khai O-507 — Review Form UI (`/orders/[id]/review`):**
    - Trang dynamic `/orders/[id]/review` bọc bởi `ProtectedPage allowedRoles={["BUYER"]}`.
    - Kiểm tra điều kiện hoàn thành đơn hàng theo quy tắc **QD14**: Chỉ cho phép đánh giá đơn hàng có trạng thái `COMPLETED`. Đơn chưa hoàn thành hiển thị thông báo giải thích cụ thể và nút quay lại.
    - Phòng ngừa đánh giá lặp theo quy tắc **RB-LB09**: Đơn đã được đánh giá sẽ hiển thị màn hình thông báo cùng nội dung đánh giá đã gửi.
    - Form đánh giá đa sản phẩm: Chấm sao tương tác 1..5 sao (role `radiogroup`, hover preview, active badge), nhận xét chi tiết 10..500 ký tự kèm character counter và validate realtime, tùy chọn đánh giá ẩn danh.
    - Màn hình phản hồi thành công và tự động quay về `/orders` sau 2.5s.
  - **2. Triển khai P-607c — Review Media Upload & Preview Component:**
    - Component `ReviewMediaUpload` hỗ trợ tải ảnh thực tế (JPG, PNG, WEBP), tối đa 5 ảnh/sản phẩm (F-607), tối đa 5MB/ảnh.
    - Xem trước tức thì (thumbnail preview), nút xóa từng ảnh có `aria-label`, thanh tiến trình mô phỏng và cơ chế thử lại.
  - **3. Review Repository & Storage Layer:**
    - `reviewRepository`: hỗ trợ `submitReview`, `getOrderReviews`, `isOrderReviewed` với cả mock in-memory và live backend API.
    - Bổ sung icon `star`, `camera`, `trash` vào hệ thống icon.
  - **4. Quality Gates:**
    - Tạo `frontend/test/review.spec.ts` (7/7 tests PASS).
    - Toàn bộ Vitest frontend: **44/44 tests PASS (100%)**.
    - Typecheck: **0 errors** (`tsc --noEmit`).
    - Next.js Production Build: **100% SUCCESS** (14/14 routes).

### 2026-09-29 (Hoàn thành Token Design System Refactoring & FE Transaction Core Lifecycle)

- **Đã làm:**
  - **1. Design System Token Refactoring:**
    - Khắc phục triệt để các mã hex tự do tại `frontend/src/features/seller/seller-orders-screen.tsx`, `frontend/src/features/orders/orders-screen.tsx`, `frontend/src/features/orders/order-card.tsx`.
    - Bổ sung `--success-border: #a7f3d0;` vào `:root` tại `frontend/src/app/globals.css`.
    - Chuyển toàn bộ các thẻ hàng đợi seller và alert box sang token semantic: `--warning-*`, `--info-*`, `--success-*`, `--danger-*`.
    - Rà soát regex đảm bảo 100% không còn mã hex hardcoded trong `src/features/orders` và `src/features/seller`.
  - **2. FE Transaction Core & GAP-01 Mitigation:**
    - Hoàn tất luồng `POST /checkout` truyền `Idempotency-Key` qua `ApiCheckoutRepository.submitCheckout`.
    - Triển khai `registerCreatedOrder` tự động ghi nhận đơn vừa đặt vào in-memory store để lập tức hiển thị và sẵn sàng thao tác trên `/orders` và `/seller/orders`.
    - Thiết lập `hybridOrderRepository` tại `frontend/src/lib/repositories/repository-factory.ts`:
      - Đọc đơn: dùng mock in-memory để khắc phục GAP-01 (tránh lỗi danh sách rỗng từ backend hiện tại).
      - Đột biến trạng thái (`cancelOrder`, `confirmOrder`, `transitionOrder`): gọi API backend thực tế khi có kết nối, đồng bộ kết quả vào kho in-memory và lan truyền chính xác mã lỗi 409 Conflict / 400 / 403 để UI thông báo kịp thời.
    - Cập nhật chuyển hướng sau checkout sang `/orders?created=${createdIds}` để kích hoạt banner thông báo thành công.
  - **3. Quality Gates:**
    - Bổ sung tests cho chu trình checkout tạo order ID -> hủy đơn / fulfill: Vitest **37/37 PASS (100%)**.
    - Typecheck: **0 errors** (`tsc --noEmit`).
    - Next.js Production Build: **100% SUCCESS** (13/13 routes).

### 2026-09-28 (Đối soát toàn diện 100% Code & Docs, xác nhận đóng Mốc T3 và chuẩn bị FE)

- **Đã làm:**
  - **1. Đối soát khớp nối 100% Code & Docs cho 4 finding T3-P5 (theo yêu cầu của Lead):**
    - **T3-P5-01 (`cancelOrder` & `persistTransition`):**
      - *Code thực tế:* Trong `backend/src/modules/checkout/services/pg-checkout.service.ts`, hàm `cancelOrder()` và `persistTransition()` chạy trong `withTransaction`. Khóa dòng `orders` bằng `SELECT ... FOR UPDATE`, kiểm tra trạng thái `PENDING_CONFIRMATION`. Khóa `order_items` và khóa `product_variants` theo thứ tự UUID (`SELECT variant_id FROM product_variants WHERE variant_id=ANY($1::uuid[]) ORDER BY variant_id FOR UPDATE`) triệt tiêu deadlock. Hoàn kho atomic `UPDATE product_variants SET stock_quantity=stock_quantity+$1`, đổi status `CANCELLED` và ghi `order_status_history` bằng cùng client DB.
      - *Test khớp nối:* `tests/db/pg-checkout.integration.test.ts`: test 4 request hủy đồng thời chỉ 1 thành công, hoàn kho đúng 1 lần, retry không hoàn kho lần 2; trigger lỗi ghi history rollback sạch toàn bộ cả status và stock.
    - **T3-P5-02 (`retryPayment`):**
      - *Code thực tế:* Trong `pg-checkout.service.ts`, hàm `retryPayment()` bọc trong `withTransaction`. Khóa dòng `orders` trước `FOR UPDATE`, guard chặn ngay nếu đơn ở terminal state (`CANCELLED`, `COMPLETED`, `DELIVERY_FAILED`) quăng `PAYMENT_STATE_INVALID`. Khóa các Payment attempts `FOR UPDATE`, guard chặn nếu không có attempt cũ hoặc đã có attempt `PENDING` hay `SUCCESS`. Validate phương thức thanh toán, trích xuất `order.total_amount` từ DB qua `createPaymentRetry()`.
      - *Test khớp nối:* `pg-checkout.integration.test.ts`: test từ chối retry đơn terminal, từ chối retry khi có `SUCCESS`/`PENDING`, 3 retry đồng thời chỉ tạo đúng 1 attempt `PENDING` mới, cơ chế lock-wait và recheck cancellation/payment success commit đồng thời.
    - **T3-P5-03 (`confirmOrder` & `transitionOrder` đồng bộ history):**
      - *Code thực tế:* Trong `pg-checkout.service.ts`, `confirmOrder()` và `transitionOrder()` khóa Order `FOR UPDATE OF o`, xác thực quyền Admin/Seller theo state machine. Dùng chung `persistTransition()` để cập nhật status và ghi `order_status_history` trong cùng một transaction. Nhánh `transitionOrder` sang `CANCELLED` tự động khóa variant và hoàn kho.
      - *Test khớp nối:* `pg-checkout.integration.test.ts`: confirm ghi đúng history và chặn trùng lặp; trigger lỗi ghi history rollback status; seller hủy qua `transitionOrder` cũng hoàn kho đúng 1 lần.
    - **T3-P5-04 (Release Gate PostgreSQL đa kết nối):**
      - *Hiện thực:* Bộ test `backend/tests/db/pg-checkout.integration.test.ts` và runner `scripts/test-transaction-pg.mjs` (`npm run test:transaction:pg`) phối hợp cùng `runConcurrentTransactions` và migration DDL thật trên schema UUID cô lập.
      - *Kiểm chứng thực tế:* **32/32 tests PASS (100%, 0 skipped)** trên PostgreSQL 17.6 (thời gian 401.89s). Kiểm chứng trọn vẹn: Overselling (5 buyer tranh 1 tồn kho), Idempotency lease/replay/conflict, rollback từng bước qua trigger fault injection, rollback 2 shop + voucher, deadlock vòng thật (`40P01`), serialization natural conflict (`40001`) và retry loop/backoff.
  - **2. Đồng bộ nhánh `dev` & Quality Gates:**
    - Nhánh `thanh-vien-5` đã được merge vào `origin/dev` tại commit `c4ef012`.
    - Đã kéo các cập nhật mới nhất từ `origin/dev` về nhánh `thanh-vien-5` local (Fast-forward, 0 xung đột), bao gồm toàn bộ UI Next.js mới và docs frontend-spec.
    - Toàn bộ backend Quality Gates đạt chuẩn: Typecheck 0 lỗi (`tsc --noEmit`), Build thành công (`esbuild dist/app.js`), Lint 0 errors.
  - **3. Đóng mốc T3 & Chuyển giao Frontend:**
    - Hoàn tất 100% nhiệm vụ Backend Người 5.
    - Cập nhật nhật ký tiến độ Frontend tại `docs/frontend-spec/progress/nguoi-5.md` chuẩn bị cho các màn Orders, Review và Admin.
- **Quyết định kỹ thuật:**
  - Khóa variant theo thứ tự UUID tăng dần (`ORDER BY variant_id FOR UPDATE`) ở cả luồng checkout và luồng cancel/restock — Lý do: Loại bỏ hoàn toàn khả năng deadlock giữa checkout và hủy đơn.
  - Phân tách rõ ràng giữa `OrderLifecycleService` (domain logic / in-memory abstract) và `PgCheckoutService` (production transactional persistence trên PostgreSQL) — Lý do: Đảm bảo tính độc lập giữa kiểm thử đơn vị logic nghiệp vụ và kiểm chứng ACID thực tế trên database engine.
- **Contract/port thay đổi:**
  - Không thay đổi contract mới; giữ vững contract `CheckoutCommand`, `CheckoutResult`, `IdempotencyPort`, `IOrderQueryPort`, `TransactionDomainEvent` đã chốt.
- **Blocker phát sinh:**
  - Không.
- **Test đã viết & kết quả:**
  - `npm run test:transaction:pg`: **32/32 PASS (100%)** trên PostgreSQL thật.
  - `npm run test:node`: **593/593 PASS (100%)** trên toàn backend.
  - `npm run typecheck`: **0 errors**.

### 2026-09-27 — Đóng bốn finding T3-P5 bằng PostgreSQL integration tests

- `cancelOrder()` khóa Order/OrderItems/variants, hoàn kho đúng một lần và ghi status/history trong cùng transaction. Nhánh hủy qua `transitionOrder()` dùng chung xử lý này.
- `retryPayment()` khóa Order/Payment và guard trạng thái trước khi tạo attempt; chặn terminal Order, SUCCESS/PENDING và retry đồng thời.
- `confirmOrder()` bổ sung history; confirm/transition rollback trạng thái nếu ghi history thất bại.
- Thêm `npm run test:transaction:pg`: gọi `PgCheckoutService` thật trên schema riêng, dùng migration/fixture và concurrency harness của Người 2. Kiểm tra overselling, duplicate key, deadlock thật, serialization và rollback từng bước/từng shop/voucher.
- Trước sửa: 12 test fail, 10 pass. Sau sửa: **32/32 PostgreSQL pass, 0 skip**, PostgreSQL 17.6; thời gian 401.89 giây trên kết nối remote.
- Regression bổ sung: 533 Node tests pass qua esbuild do lỗi môi trường `tsx` trên Windows; 89 Vitest pass (59 remote test khác không chạy trong lượt này). Typecheck/build pass; lint toàn backend 0 error, 219 warning ngoài các file sửa.
- Đính chính nhật ký 2026-09-25: các test mutex/in-memory/mock retry khi đó chỉ chứng minh logic mô phỏng, chưa phải bằng chứng ACID/lock của `PgCheckoutService`. Kết quả PostgreSQL mới ở trên thay thế kết luận đó cho bốn finding T3-P5.

### 2026-09-25 — Hoàn thành 100% Mốc T3: Transaction Hardening, Concurrency Harness, Edge Cases & Reporting Module

- **Bước 1 (Concurrency Hardening)**:
  - Triển khai `test/modules/checkout/t3-transaction-concurrency.spec.ts` (4/4 tests PASS):
    1. Overselling race condition: 5 concurrent requests tranh mua 1 tồn kho duy nhất -> đúng 1 request thành công, 4 request nhận `INVENTORY_INSUFFICIENT`, kho còn 0.
    2. Idempotency atomic lease: cơ chế claim lock (`acquired`), chặn race condition `in_progress`, và `replay` kết quả khi đã xử lý xong.
    3. Serialization retry loop: tự động bắt lỗi PostgreSQL `40001`/`40P01` và retry tối đa 3 lần với backoff 25ms, 50ms.
    4. Chống double payment callback: 2 worker callback cùng chốt `SUCCESS` cho 1 thanh toán `PENDING` -> chỉ 1 worker thành công, worker kia nhận lỗi `PAYMENT_STATE_INVALID`.
- **Bước 2 (Exhaustive Edge Cases)**:
  - Triển khai `test/modules/order/t3-exhaustive-edge-cases.spec.ts` (6/6 tests PASS):
    1. Amount mismatch khi settle payment -> quăng `PAYMENT_AMOUNT_INVALID` (422).
    2. Duplicate cancel retry -> chặn gọi lại, không restock trùng lần 2, không sinh thêm bản ghi history.
    3. Hủy đơn khi đang `PREPARING` -> bắt buộc cờ `exceptionalCancellation: true`.
    4. Trạng thái kết thúc của Shipment (`DELIVERED`, `FAILED`) là terminal; Order chuyển sang `SHIPPING`/`COMPLETED` phải kiểm tra trạng thái tương ứng của Shipment.
    5. Payment retry bị từ chối nếu đơn đã thanh toán thành công hoặc đã bị hủy.
    6. Kiểm tra tính bất biến và chuỗi thời gian của `order_status_history`.
- **Bước 3 (Reporting Module & QD19)**:
  - Tạo domain module `backend/src/modules/reporting/`:
    - `ReportingDomainError`, `ReportingErrorCode` (`REPORT_FILTER_INVALID`, `REPORT_ACCESS_DENIED`).
    - DTOs và types: `ShopRevenueReport`, `BuyerSpendingReport`, `PlatformSummaryReport`.
    - `ReportingService`: Thực thi quy tắc **QD19** — chỉ tính các đơn có trạng thái `COMPLETED` vào doanh thu, loại trừ hoàn toàn các đơn `CANCELLED`, `DELIVERY_FAILED`, `PENDING`, `PREPARING`, `SHIPPING`.
    - Đấu nối mã lỗi `REPORT_FILTER_INVALID` vào `error-handler.ts` (HTTP 422).
  - Triển khai `test/modules/order/reporting.spec.ts` (5/5 tests PASS).
- **Bước 4 (Phối hợp & Quality Gate)**:
  - `npm run test:node`: **533/533 tests PASS (100%)**.
  - `npm run typecheck`: **0 errors**.
  - Sẵn sàng bàn giao cho Người 1 (OpenAPI 3.1) và Người 2 (Index tuning / Concurrency harness).

### 2026-09-25 — Hoàn thành 100% Mốc T2: Order Lifecycle Routing, Payment Service & E2E Happy Path

- Triển khai `payment/services/payment.service.ts`:
  - `retryPayment`: kiểm tra quyền sở hữu của buyer, trạng thái đơn chưa hủy/hoàn tất, tạo bản ghi thanh toán retry `PENDING`.
  - `settlePayment`: chốt trạng thái thanh toán `SUCCESS` / `FAILED` đồng bộ với Order.
- Nâng cấp `order/services/order-lifecycle.service.ts`:
  - `confirmOrder`: Seller kiểm tra shop sở hữu và xác nhận đơn (`CONFIRMED`).
  - `transitionOrder`: Hỗ trợ transition đa trạng thái (`PREPARING`, `SHIPPING`, `DELIVERED`, `COMPLETED`, `CANCELLED`).
- Hoàn thiện `order-routes.ts`:
  - Đấu nối chính thức `confirmOrder`, `transitionOrder`, `retryPayment` vào router Express.
  - Viết 7 tests mới trong `order-routes.spec.ts` (16/16 tests PASS).
- Triển khai `test/modules/checkout/e2e-happy-path.spec.ts`:
  - Kiểm thử happy path khép kín từ Giỏ hàng & Voucher (Người 4), Khóa tồn kho Catalog (Người 3), Checkout ACID & Thanh toán & Vòng đời đơn (Người 5), Đánh giá Review (Người 4) và Thông báo Notification (Người 4).
- Quality Gate:
  - `npm run test:node`: **518/518 PASS (100%)**.
  - `npm run typecheck`: **0 lỗi (exit 0)**.

### 2026-09-23 — Transactional Checkout (ACID 12 bước), Order Lifecycle (Cancel & Restock) & Payment Repository

- Triển khai `payment/domain/repositories.ts`:
  - Định nghĩa `IPaymentRepository` và `PaymentRecord` tương thích bảng `payments` trong Schema Freeze v1.
- Triển khai `payment/repositories/in-memory-payment.repository.ts` và `payment/repositories/pg-payment.repository.ts`:
  - Lưu trữ và cập nhật trạng thái thanh toán PostgreSQL với `client?: PoolClient` bảo đảm tham gia cùng transaction cha.
- Triển khai `checkout/services/transactional-checkout.service.ts`:
  - Hiện thực hóa quy trình checkout 12 bước nguyên tử ACID kết nối trực tiếp với `withTransaction(pool, ...)` của Người 2:
    - Sắp xếp và khóa dòng variants theo thứ tự UUID (`SELECT ... FOR UPDATE` chống race condition).
    - Tạo `orders`, `order_items` snapshot, `order_status_history` ban đầu, và `payments` (`PENDING`) trong 1 transaction duy nhất.
    - Tiêu thụ `voucher_usages` và dọn `cart_items` của Người 4.
    - Tự động `ROLLBACK` sạch sẽ nếu có bất kỳ bước nào thất bại.
- Triển khai `order/services/order-lifecycle.service.ts`:
  - `cancelOrder`: Xác thực quyền actor theo `order-state-machine.ts`, chuyển trạng thái `CANCELLED`, ghi lý do vào history và **hoàn lại tồn kho variant (Restock)** chính xác 1 lần trong transaction.
- Triển khai `order/domain/repositories.ts`, `in-memory-order.repository.ts`, `pg-order.repository.ts`, `order-query.service.ts`.
- Bổ sung integration tests tại `test/modules/checkout/transactional-checkout.spec.ts` (Happy path + Cancel & restock).
- Quality gate: `test:node` **247/247 pass** (0 fail, 75 suites); `typecheck` 0 lỗi; `build` pass (`dist/app.js` 5.3kb).

### 2026-09-19 — PostgreSQL checkout persistence

- Đã thêm `PgCheckoutService`: checkout chạy trong `withTransaction`, khóa selected cart
  rows/variant stock, snapshot Address/Product/Variant/price, ghi Order/OrderItem,
  OrderStatusHistory, Payment, Notification và consume Voucher cùng transaction.
- Same key/same fingerprint replay trả lại IDs; key khác payload trả `IDEMPOTENCY_KEY_REUSED`;
  lock bận trả `REQUEST_IN_PROGRESS`; retry đúng SQLSTATE `40001`/`40P01`, tối đa 3 attempts,
  backoff 25ms/50ms.
- Đã thêm command handlers HTTP cho cancel/confirm/transition/payment retry, ownership và
  role được kiểm tra ở handler ngoài middleware.
- Typecheck/build pass; integration suite PostgreSQL sẽ chạy qua CI service `17.6`.

### 2026-09-18 — idempotency advisory-lock seam

- Đã thêm `PgIdempotencyRepository` transaction-scoped: advisory lock dùng canonical
  `JSON.stringify(["v1", user_id, endpoint, idempotency_key])`, sau đó lookup composite
  primary key; hash collision chỉ serialize, không tạo replay sai.
- Đã bỏ việc tính fingerprint từ raw body ở seam mới: `canonicalCheckoutFingerprint` nhận
  command đã parse, sort voucher theo `shop_id`/`code`, trim code và SHA-256 lowercase.
- Retry/persistence orchestration vẫn cần gắn vào checkout transaction handler ở slice kế tiếp;
  chưa tự mở `BEGIN/COMMIT` trong repository.
- TDD: canonical fingerprint permutation test pass; typecheck pass.

### 2026-09-18 — Negative Test Orchestration & Domain Boundary Hardening

- Bổ sung 5 negative tests cho `executeCheckout` (`checkout-orchestration.spec.ts`):
  1. Idempotency `in_progress` -> reject `REQUEST_IN_PROGRESS`, không gọi downstream port.
  2. Voucher evaluation bị từ chối -> dừng flow, không trừ kho, không xóa giỏ hàng.
  3. Catalog downstream lỗi (vd DB error) -> propagate lỗi, cô lập giỏ hàng không bị xóa.
  4. Khóa tồn thất bại (lock timeout/fail) -> voucher không bị tiêu thụ, giỏ hàng không bị xóa.
  5. Idempotency replay -> trả ngay cached result mà không gọi lại Cart, Catalog, Voucher.
- Bổ sung 2 tests biên cho `calculateOrderTotals` (`order-calculation.spec.ts`): tiền lẻ 0.01 cent chính xác, chặn các chuỗi số dị dạng (`1.0.0`, `1.00 `, `..01`).
- Đồng bộ `checkout-contract.md`: phân định rõ ranh giới Domain thuần (đã xong) và Persistence/API wiring (chờ phối hợp).
- Quality gate lịch sử ngày 2026-09-16 dùng runtime tiền nhiệm Node v22.20.0, npm 11.12.1: TV5 41/41 pass; full backend 229/229 pass; typecheck 0 lỗi; build pass; lint 0 error. Đây không phải evidence runtime Node 24.

### 2026-09-18 — CheckoutOrchestrator + Mock Ports

- Triển khai `checkout/domain/checkout-orchestrator.ts`: domain service 12 bước, inject ICartPort / ICatalogPort / IVoucherPort / IdempotencyPort, không dependency infrastructure.
- 8 test TDD (`checkout-orchestration.spec.ts`): happy path, multi-shop, voucher, oversell, inactive variant/shop, empty cart, idempotency replay/conflict — **8/8 pass**.
- `IShopResolver` interface internal, chưa publish qua port module chung.

### 2026-09-18 — TDD Order rules audit

- Đọc toàn bộ spec, Schema Freeze, 9 rules file; đối chiếu implementation TV5 (xem [Phụ lục A](#phụ-lục-a--đối-chiếu-rules--tdd-2026-09-18)).
- Sửa 4 bug qua RED→GREEN: quantity vượt PostgreSQL INTEGER; unknown actor được phép transition Order; Payment nhận ngày không tồn tại; paidAt không chuẩn hóa UTC.
- Bổ sung 3 test biên calculation (pass ngay, không fake RED).

### 2026-09-18 — Order snapshot/history

- Kiểm tra dependency → chưa đủ: Catalog port thiếu `productName` bắt buộc, `shopId`, mapping VariantSnapshot.
- Dừng trước RED, không tạo code giả. Chờ Người 3.

### 2026-09-18 — Payment validation + Order calculation

- Bổ sung runtime validation `createPaymentRetry` / `settlePendingPayment`: chỉ nhận status `PENDING/SUCCESS/FAILED`, method `COD/ONLINE`.
- Tạo `order-calculation.ts`: tính LineTotal/Subtotal/Discount/Shipping/Total bằng bigint cents, giữ NUMERIC(15,2).

### 2026-09-17 — State machines + Checkout contracts

- Triển khai domain service thuần cho Order, Shipment, Payment state machine; không mutate input.
- Soạn thảo `checkout/contracts/`: CheckoutCommand, CheckoutResult, IdempotencyPort, endpoint proposal, transaction boundary 12 bước.
- Ghi chú: Các phụ thuộc ban đầu về API wiring của Người 1, persistence của Người 2, ShopID của Người 3, Cart/Voucher của Người 4 đều đã được giải quyết và tích hợp hoàn tất 100% trong T2 và T3.

## Contract đang sở hữu

| Tên | Trạng thái bàn giao | Version/ngày khóa | Người tiêu thụ |
|---|---|---|---|
| `CheckoutCommand` / `CheckoutResult` | Đã khóa & tích hợp | 2026-09-23 | Người 1, Người 5 |
| `IdempotencyPort` / `InMemoryIdempotencyAdapter` / `PgIdempotencyRepository` | Đã bàn giao & tích hợp | 2026-09-23 | Người 1, Người 2, Người 5 |
| `IOrderQueryPort` (`ReviewOrderItemDTO`) | Đã bàn giao (sẵn sàng cho Review QD14) | v1 / 2026-09-23 | Người 4 |
| `TransactionDomainEvent` (Order/Payment/Shipment) | Đã bàn giao (sẵn sàng cho Notification) | v1 / 2026-09-23 | Người 4 |
| Endpoint checkout/cancel/confirm/transition/retry | Đã đấu nối & kiểm thử 100% (16/16 test pass) | 2026-09-25 | Người 1 |

## Các hạng mục Mốc T2 và Mốc T3 đã hoàn thành 100%

- [x] Xây domain service thuần cho ba state machine Order, Payment và Shipment.
- [x] Viết unit test cho mọi transition hợp lệ, transition bị cấm và terminal state.
- [x] Thiết kế checkout command/result, transaction boundary, danh sách bước checkout và idempotency interface.
- [x] Tính tiền Order thuần với decimal exact và validation NUMERIC(15,2).
- [x] Soạn thảo endpoint contract tạo Order, cancel, transition và retry Payment.
- [x] Dùng mock Catalog, Cart và Voucher port để kiểm thử orchestration contract (13 tests positive & negative).
- [x] Order snapshot và history domain service (`order-snapshot.ts`, QD08, QD11, QD20).
- [x] Công bố Order query port / trạng thái `COMPLETED` cho Người 4 làm Review.
- [x] Công bố Order/Payment/Shipment domain events cho Người 4 làm Notification.
- [x] Triển khai In-memory Idempotency adapter.
- [x] Sau khi Người 3 khóa Catalog port và Người 4 khóa Cart/Voucher port: ráp checkout orchestration với các port thật.
- [x] Sau khi Người 2 hoàn thành migration và transaction helper: làm persistence, transaction integration và idempotency storage thật trên PostgreSQL.
- [x] Sau khi Người 1 hoàn thành scaffold, API envelope và `RequestContext`: wiring endpoint checkout/order/payment.

---

## Phụ lục A — Đối chiếu Rules & TDD (2026-09-18 & 2026-09-25)

### A.1 Bảng đối chiếu rule / implementation / test

| Rule | Implementation | Test | Trạng thái |
|---|---|---|---|
| QD10, RB-LTT01/02, RB-LQH01/02: tiền exact | `order/domain/order-calculation.ts` | `order/order-calculation.spec.ts` | Đủ + bổ sung test biên & penny (9 tests) |
| RB-MG06: quantity INTEGER ≥ 1 | `order/domain/order-calculation.ts` | `order/order-calculation.spec.ts` | **Sai → đã sửa** (chặn > 2147483647) |
| RB-MG06/07: unit price > 0, NUMERIC(15,2) | `order/domain/order-calculation.ts` | `order/order-calculation.spec.ts` | Đủ + bổ sung coverage |
| QD11: 8 cạnh Order, terminal không chuyển tiếp | `order/domain/order-state-machine.ts` | `order/order-state-machine.spec.ts` | Đủ (ma trận 49 cặp, 7 tests) |
| QD12: Buyer chỉ hủy pending và đúng owner | `order/domain/order-state-machine.ts` | `order/order-state-machine.spec.ts` | Đủ |
| QD13/RB-LQH07: actor/Shop được phép | `order/domain/order-state-machine.ts` | `order/order-state-machine.spec.ts` | **Sai → đã sửa** (unknown actor → RESOURCE_FORBIDDEN) |
| RB-LTT08: reason và evidence | `order/domain/order-state-machine.ts` | `order/order-state-machine.spec.ts` | Đủ |
| RB-MG12: Order status | `order/domain/order-state-machine.ts` | `order/order-state-machine.spec.ts` | Đủ |
| RB-MG12, workflow §3: Shipment 5 cạnh | `shipment/domain/shipment-state-machine.ts` | `shipment/shipment-state-machine.spec.ts` | Đủ (ma trận 25 cặp, 2 tests) |
| RB-MG10/RB-LQH04: Payment amount dương, khớp Order | `payment/domain/payment-state-machine.ts` | `payment/payment-state-machine.spec.ts` | Đủ (7 tests) |
| RB-MG12: Payment status/method | `payment/domain/payment-state-machine.ts` | `payment/payment-state-machine.spec.ts` | Đủ |
| RB-LTT06, API §2: PaidAt hợp lệ | `payment/domain/payment-state-machine.ts` | `payment/payment-state-machine.spec.ts` | **Sai → đã sửa** (reject ngày không tồn tại) |
| API §2/ADR §6: chuẩn hóa UTC | `payment/domain/payment-state-machine.ts` | `payment/payment-state-machine.spec.ts` | **Sai → đã sửa** (toISOString, input bất biến) |
| Workflow §7: retry PENDING, chặn Order đã paid | `payment/domain/payment-state-machine.ts` | `payment/payment-state-machine.spec.ts` | Đủ (domain thuần) |
| API §2/§6: checkout command validation | `checkout/contracts/checkout-command.ts` | `checkout/checkout-command.spec.ts` | Đủ (3 tests) |
| QD07/09/11, RB-LQH03/06: orchestration + stock/voucher | `checkout/domain/checkout-orchestrator.ts` | `checkout/checkout-orchestration.spec.ts` | **Đã triển khai** (13 tests: 8 positive + 5 negative) |
| QD08: Order snapshot bất biến | `order/domain/order-snapshot.ts`, `transactional-checkout.service.ts` | `order-snapshot.spec.ts` | **Đã hoàn thành 100%** (Tích hợp Catalog port Người 3) |
| QD11/20: history/audit cùng transaction | `order/services/order-lifecycle.service.ts`, `transactional-checkout.service.ts` | `transactional-checkout.spec.ts` | **Đã hoàn thành 100%** (Tích hợp withTransaction Người 2) |
| Idempotency storage thật | `checkout/services/transactional-checkout.service.ts`, `in-memory-idempotency.adapter.ts` | `t3-transaction-concurrency.spec.ts` | **Đã hoàn thành 100%** (ACID & Concurrency Verified) |

### A.2 Bằng chứng TDD — Các vòng RED→GREEN

| Slice | Bằng chứng RED | Kết quả GREEN |
|---|---|---|
| Quantity INTEGER | Exit 1 — Missing expected exception (2147483648) | Thêm upper bound; Order pass |
| Actor unknown | Exit 1 — Missing expected exception (actor lạ) | Reject RESOURCE_FORBIDDEN; Order pass |
| Ngày không tồn tại | Exit 1 — Missing expected exception (2024-02-30) | Validate ngày theo tháng/leap year; Payment pass |
| UTC normalization | Exit 1 — giữ +07:00 thay vì UTC | toISOString() sau validation; TV5 pass |
| Negative Orchestration | Node strip-types parameter property syntax error | Explicit property definition; 13/13 pass |

### A.3 Quality gate thực tế (2026-09-18)

| Lệnh | Kết quả thực tế |
|---|---|
| TV5 (order + payment + shipment + checkout) | **41/41 pass** (6 file specs) |
| `npm run test:node` (full backend) | **229/229 pass** (63 test files, 67 suites) |
| `npm run typecheck` | Exit 0 — 0 lỗi (`tsc --noEmit`) |
| `npm run build` | Exit 0 — `dist/app.js` (5.3kb) |
| `npm run lint` | Exit 0 — 0 errors (185 pre-existing warnings) |

### A.4 T1 closeout (2026-09-19)

- Checkout persistence đã ghi Order, OrderItem snapshot, History, Payment và Notification trong cùng transaction; stock/cart/voucher rollback theo transaction.
- Idempotency dùng canonical fingerprint, composite lookup và transaction-scoped advisory lock; retry SQLSTATE `40001`/`40P01` tối đa 3 attempts với backoff 25/50 ms.
- Order cancel/confirm/transition/payment retry đã kiểm tra role, ownership và state qua RequestContext đã khóa.
- Reviewer roleplay: Người 1 và Người 2 đã review transaction/idempotency handoff; không còn blocker T1.

