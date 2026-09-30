# Tiến độ FE — Người 5 (Orders, Review và Admin)

## Trạng thái hiện tại

- Phase/ticket: Phase 5 & Phase 6 — Orders, Review, Admin & Buyer Confirm-Received (UI/routes và nhiều unit tests đã có; acceptance live/E2E tổng thể chưa hoàn tất)
- Cập nhật lần cuối: 2026-09-30
- Đang làm: Có implementation cho các cụm Orders/Review/Admin và Buyer confirm-received; không coi các luồng dùng fallback mock là live-complete. Các acceptance C-206/C-406 và critical Playwright path vẫn cần evidence:
  1. **Cụm 1 & 2 (Buyer Orders `/orders` & Seller Orders `/seller/orders`):**
     - Kênh đọc đơn (`getOrders`, `getOrderById`): Backend hiện có PostgreSQL `GET /orders` và `GET /orders/:id` (`OrderQueryService`), nhưng `hybridOrderRepository` phía frontend vẫn trỏ `getOrders` sang mock store. Vì vậy GAP-01 hiện là integration gap ở consumer FE, không phải route backend còn thiếu. Đơn mới tạo sau checkout được đồng bộ vào in-memory store qua `registerCreatedOrder`.
     - Kênh thao tác đơn (`cancelOrder`, `confirmOrder`, `confirmReceived`, `transitionOrder`): Gọi API Backend live khi có kết nối, đồng bộ trạng thái vào in-memory store; lan truyền chính xác mã lỗi 409 Conflict / 400 / 403 để UI cảnh báo; tự động fallback sang mock khi offline / môi trường test / API lỗi kết nối.
  2. **Cụm 3 (Review Form UI `/orders/[id]/review` & Media Upload):**
     - Giao diện O-507 (1..5 sao, nhận xét 10-500 ký tự, điều kiện QD14, chống trùng RB-LB09) và P-607c (upload xem trước tối đa 5 ảnh 5MB).
     - Data layer: `ApiReviewRepository` gọi `POST /reviews` và `GET /orders/:id/reviews`, tự động fallback sang `MockReviewRepository` khi gặp lỗi mạng (`NETWORK_ERROR`), lỗi xác thực (`UNAUTHORIZED`, 401) hoặc mock mode.
  3. **Cụm 4 (Admin Dashboard `/admin`, Moderation, Categories `/admin/categories`, Seller Dashboard `/seller`):**
     - Giao diện A-704, A-705 (khóa/mở kèm lý do bắt buộc RB-LTT08 & audit log), A-708 (Seller KPI tuân thủ QD19 chỉ tính đơn COMPLETED), A-709 (cây danh mục 2 cấp RB-KN04), Q-805 (RBAC route guard).
     - Data layer: `apiAdminRepository` kết nối live API khi sẵn sàng và fallback sang `mockAdminRepository` khi gặp lỗi.
  4. **Triển khai P0-08 / C-103, C-104 (Buyer `confirm-received`):**
     - Backend: Bổ sung route `POST /orders/:order_id/confirm-received` trong `order-routes.ts`, `t1-routes.ts`, `PgCheckoutService.confirmReceived` và `OrderLifecycleService.confirmReceived`, cập nhật `order-state-machine.ts` cho phép Buyer chuyển đơn từ `SHIPPING` $\rightarrow$ `COMPLETED`.
     - Frontend: Bổ sung `confirmReceived` vào `orderApi`, `IOrderRepository`, `hybridOrderRepository`, `mockOrderRepository`; gắn nút **"Đã nhận được hàng"** vào thẻ đơn `SHIPPING` trên trang `/orders`; hiển thị thông báo thành công và mở khóa nút viết đánh giá Review (QD14).
  5. **Quality Gates (snapshot lịch sử trong log 2026-09-30):** 217/217 Vitest pass tại lượt chạy ghi nhận của Người 5; đây không phải số test hiện hành toàn repo (các progress khác ghi 242). Test xanh không thay cho E2E live acceptance.
- Nhánh/PR: thanh-vien-5 (Đã đồng bộ toàn bộ code mới từ `dev`)
- Bị block bởi: Không
- Việc tiếp theo: Bổ sung evidence cho Buyer order→confirm-received→review (C-206), Admin RBAC E2E (C-406), xác minh các repository không fallback mock trong môi trường acceptance; sau đó mới đóng checklist tổng thể.

## Nhật ký theo ngày

### 2026-09-30 (Triển khai Buyer confirm-received P0-08/C-103 & Đối soát trung thực Code vs Docs)

- **Đã làm:**
  - **1. Triển khai trọn gói Buyer `confirm-received` (Plan 08 / P0-08 / C-103, C-104):**
    - **Backend Domain & Persistence:**
      - Cập nhật `order-state-machine.ts`: Cho phép `actor.kind === 'BUYER'` chuyển đơn hàng sở hữu từ `SHIPPING` $\rightarrow$ `COMPLETED`.
      - Cập nhật `order-lifecycle.service.ts`: Thêm `confirmReceived(orderId, actor, reason)` ghi lịch sử trạng thái `COMPLETED` và cập nhật cơ sở dữ liệu.
      - Cập nhật `pg-checkout.service.ts`: Thêm `confirmReceived(context, orderId)` xử lý khóa dòng đơn hàng `FOR UPDATE`, bảo đảm chỉ đơn `SHIPPING` mới được xác nhận và ghi `order_status_history`.
      - Cập nhật routing: Đấu nối route `POST /orders/:order_id/confirm-received` trong cả `order-routes.ts` và `t1-routes.ts` với guard phân quyền `BUYER` và `ADMIN`.
      - Viết unit test trong `order-state-machine.spec.ts`: Kiểm tra happy path Buyer confirm-received, chặn buyer không sở hữu đơn (RESOURCE_NOT_FOUND), và chặn xác nhận khi đơn không ở trạng thái SHIPPING (8/8 PASS).
    - **Frontend API, Repositories & UI:**
      - Cập nhật `order.api.ts`: Thêm `confirmReceived(id)` gọi `POST /orders/:id/confirm-received`.
      - Cập nhật `types.ts` & `repository-factory.ts`: Thêm `confirmReceived` cho `apiOrderRepository`, `mockOrderRepository` và `hybridOrderRepository` (gọi live API + sync store + fallback mock).
      - Cập nhật `order-card.tsx`: Khi đơn hàng ở trạng thái `SHIPPING`, hiển thị nút hành động **"Đã nhận được hàng"** với token chuẩn `var(--success)`.
      - Cập nhật `orders-screen.tsx`: Thêm handler `handleConfirmReceived`, cập nhật trạng thái đơn sang `COMPLETED`, kích hoạt toast thông báo thành công và lập tức hiển thị nút **"Đánh giá sản phẩm"** (khớp trọn vẹn luồng Buyer Lifecycle QD14).
      - Bổ sung unit tests trong `frontend/test/orders.spec.ts`: Kiểm tra xác nhận nhận hàng chuyển trạng thái sang COMPLETED và chặn xác nhận trên đơn non-SHIPPING (7/7 tests PASS).
  - **2. Đối soát hiện trạng Code vs Docs:**
    - Làm rõ cơ chế Hybrid/Mock của Orders (FE read path chưa dùng API dù backend route đã có), Review và Admin trong tài liệu; không mô tả GAP-01 là backend thiếu route.
    - Vitest frontend: **217/217 tests PASS (100%)**.
    - Typecheck (`tsc --noEmit`): **0 errors**.

### 2026-09-29 (Hoàn thành 100% Cụm 4: A-704, A-705, A-708, A-709, Q-805)

- **Đã làm:**
  - **1. Triển khai A-704 — Admin Dashboard Screen (`/admin` & `frontend/src/features/admin/admin-dashboard-screen.tsx`):**
    - Trang trung tâm kiểm duyệt và quản trị toàn diện hệ thống sàn.
    - 4 thẻ KPI chỉ số chính: Tổng người dùng, Tổng gian hàng đối tác, Tổng sản phẩm kiểm duyệt, Tổng doanh số GMV thực tế sàn (tuân thủ **QD19**: chỉ tính từ đơn hàng `COMPLETED`).
    - Hệ thống chuyển Tab mượt mà: Người dùng (`users`), Gian hàng (`shops`), Sản phẩm kiểm duyệt (`products`), Nhật ký kiểm toán (`logs`).
    - Thanh tìm kiếm từ khóa thời gian thực lọc danh sách theo tên, email, sản phẩm.
    - Điều hướng nhanh đến trang Quản lý danh mục ngành hàng `/admin/categories`.
  - **2. Triển khai A-705 — User/Shop Moderation & Audit Logging:**
    - Khóa tài khoản người dùng / gian hàng vi phạm với modal `<Dialog>` yêu cầu **bắt buộc nhập lý do** theo quy tắc **RB-LTT08**.
    - Chặn hoàn toàn việc khóa tài khoản quản trị viên tối cao (`ADMIN`).
    - Ghi nhận mọi hoạt động kiểm duyệt vào bảng `AdminAuditLog` (hành động, đối tượng mục tiêu, lý do, quản trị viên thực hiện, thời gian chi tiết).
    - Thao tác mở khóa khôi phục tài khoản tức thì kèm log audit tương ứng.
    - Kiểm duyệt ẩn/khôi phục sản phẩm vi phạm với lý do kiểm duyệt rõ ràng.
  - **3. Triển khai A-708 — Seller Dashboard & KPI UI (`/seller` & `frontend/src/features/seller/seller-dashboard-screen.tsx`):**
    - Trang dashboard tổng quan dành cho người bán và quản trị viên (`<ProtectedPage allowedRoles={["SELLER", "ADMIN"]}>`).
    - **Tuân thủ nghiêm ngặt quy tắc QD19**: Doanh thu hiển thị trên Dashboard chỉ tổng hợp từ các đơn hàng có trạng thái `COMPLETED`. Tuyệt đối không tạm tính đơn đang giao (`SHIPPING`), đang chuẩn bị (`PREPARING`) hoặc đã hủy (`CANCELLED`).
    - Thẻ KPI: Doanh thu thực nhận (QD19), Số lượng đơn hoàn tất, Số đơn chờ xác nhận (có cảnh báo đỏ và CTA xử lý ngay), Số sản phẩm đang bán, Đánh giá chất lượng shop (sao).
    - Banner công khai chính sách doanh thu theo chuẩn QD19 giải thích minh bạch quy tắc kế toán cho chủ gian hàng.
    - Hàng đợi đơn hàng gần đây cần xử lý (Action Queue) với link trực tiếp đến `/seller/orders`.
    - Bảng cảnh báo tồn kho thấp (Low Stock Inventory) phát hiện sản phẩm có tồn kho $\le 20$ và liên kết cập nhật nhanh tại `/seller/products`.
  - **4. Triển khai A-709 — Admin Categories Management (`/admin/categories` & `frontend/src/features/admin/admin-categories-screen.tsx`):**
    - Tiêu thụ `CategoryAdapter` (`A-700`) từ Người 3.
    - Hiển thị cây danh mục phân cấp 2 cấp trực quan (Accordion disclosure, icon, số lượng danh mục con, trạng thái `ACTIVE` / `INACTIVE`).
    - Thực thi quy tắc **RB-KN04**: Cây danh mục giới hạn **tối đa 2 cấp**. Khi thêm danh mục con, hệ thống chỉ cho phép chọn cha là danh mục gốc cấp 1; từ chối tạo cấp 3.
    - Bật/tắt trạng thái hoạt động danh mục (`ACTIVE` $\leftrightarrow$ `INACTIVE`) tức thì.
    - Xóa danh mục với hộp thoại xác nhận; từ chối xóa danh mục cha nếu vẫn còn danh mục con trực thuộc.
  - **5. Triển khai Q-805 — Route Protection & RBAC:**
    - Cấu hình phân quyền nghiêm ngặt trong `route-guards.ts`:
      - `/admin` và `/admin/*`: chỉ cho phép vai trò `ADMIN`.
      - `/seller` và `/seller/*`: cho phép vai trò `SELLER` và `ADMIN`.
    - Tích hợp `<ProtectedPage>` ở tất cả các trang đích, chuyển hướng an toàn về `/login` với `returnTo` đã được làm sạch chống open-redirect.
  - **6. Design System & Token Compliance:**
    - 100% màu sắc và giao diện tuân thủ biến token CSS (`var(--background)`, `var(--foreground)`, `var(--card)`, `var(--border)`, `var(--primary)`, `var(--success-*)`, `var(--warning-*)`, `var(--danger-*)`, `var(--info-*)`).
    - **0 hardcoded hex colors** trong toàn bộ code mới.
  - **7. Quality Gates:**
    - Viết mới `frontend/test/admin.spec.ts` với 16 ca kiểm thử bao phủ toàn bộ QD19, A-705, A-708, A-709, RB-KN04, RB-LTT08, Q-805.
    - Toàn bộ Vitest test suite: **60/60 tests PASS (100%)**.
    - Typecheck (`tsc --noEmit`): **0 errors**.
    - Next.js Production Build (`next build`): **100% SUCCESS** (17/17 routes tĩnh và động biên dịch trơn tru).

### 2026-09-29 (Hoàn thành Cụm 3: O-507 Review Form UI & P-607c Review Media Upload)

- **Đã làm:**
  - **1. Triển khai O-507 — Review Form UI (`frontend/src/app/orders/[id]/review/page.tsx` & `frontend/src/features/review/review-screen.tsx`):**
    - Cấu hình trang dynamic Next.js App Router `/orders/[id]/review` với metadata chuẩn SEO.
    - Bảo vệ phân quyền nghiêm ngặt bằng `<ProtectedPage allowedRoles={["BUYER"]}>`.
    - Kiểm tra điều kiện tiên quyết theo quy tắc nghiệp vụ **QD14**: Chỉ cho phép đánh giá đơn hàng ở trạng thái `COMPLETED`. Nếu đơn chưa hoàn thành (PENDING, CONFIRMED, SHIPPING, CANCELLED), giao diện hiển thị thông báo giải thích rõ ràng và nút điều hướng về trang đơn hàng.
    - Phòng ngừa đánh giá trùng lặp theo quy tắc **RB-LB09**: Nếu đơn hàng đã được đánh giá trước đó, hiển thị màn hình thông báo cùng nội dung phản hồi đã gửi.
    - Thiết kế giao diện biểu mẫu đánh giá chi tiết theo từng sản phẩm trong đơn:
      - Header sản phẩm: hình ảnh, tên sản phẩm, phân loại, giá bán.
      - Chấm điểm số sao trực quan từ 1 đến 5 sao: hỗ trợ hover preview, click chọn sao, badge nhãn cảm xúc ("Rất tệ", "Chưa tốt", "Bình thường", "Hài lòng", "Tuyệt vời"), chuẩn accessibility (role `radiogroup`, `aria-checked`, `aria-label`).
      - Khung nhập nhận xét chi tiết: giới hạn 10-500 ký tự, hiển thị realtime số lượng ký tự, cảnh báo lỗi cụ thể nếu nhập dưới 10 ký tự.
      - Tùy chọn "Đánh giá ẩn danh" (hiển thị dạng `n***n`).
      - Màn hình phản hồi thành công: card thông báo chúc mừng kèm hiệu ứng và tự động quay về `/orders` sau 2.5 giây.
  - **2. Triển khai P-607c — Review Media Upload & Preview UI (`frontend/src/features/review/review-media-upload.tsx`):**
    - Component tải lên và xem trước hình ảnh đính kèm:
      - Hỗ trợ tải các định dạng phổ biến: JPG, PNG, WEBP.
      - Kiểm soát số lượng: tối đa 5 ảnh trên mỗi sản phẩm (theo F-607).
      - Kiểm soát dung lượng: tối đa 5MB mỗi ảnh, cảnh báo rõ ràng nếu vượt giới hạn.
      - Xem trước ảnh tức thì (instant thumbnail preview).
      - Thao tác xóa từng ảnh thuận tiện với nút icon đóng kèm `aria-label="Xóa ảnh {i + 1}"`.
      - Thanh trạng thái tiến trình xử lý tải ảnh (Progress Bar).
      - Cơ chế thử lại (Retry) khi chọn phải file không hợp lệ hoặc lỗi đọc file.
      - Thông báo ngữ cảnh về media API (GAP-09): ảnh được lưu trữ an toàn trong phiên đánh giá.
  - **3. Xây dựng Review Repository & Data Layer (`frontend/src/features/review/review.repository.ts`):**
    - Định nghĩa contract `IReviewRepository`: `submitReview(payload)`, `getOrderReviews(orderId)`, `isOrderReviewed(orderId)`.
    - Triển khai `MockReviewRepository`: lưu trữ phiên làm việc an toàn, kiểm tra tính toàn vẹn dữ liệu (rating 1..5, comment 10..500, max 5 ảnh, chặn trùng lặp mã 409 `REVIEW_ALREADY_EXISTS`).
    - Triển khai `ApiReviewRepository`: kết nối live API khi sẵn sàng và fallback mượt mà về mock khi offline.
    - Bổ sung icon `star`, `camera`, `trash` vào design system icon registry (`frontend/src/components/ui/icon.tsx`).
  - **4. Kiểm thử chất lượng (Quality Gates):**
    - Viết mới `frontend/test/review.spec.ts` kiểm tra 7 kịch bản: nhãn rating, validate comment tối thiểu 10 ký tự, validate số sao 1..5, giới hạn tối đa 5 ảnh P-607c, gửi đánh giá hợp lệ và lưu trữ, chặn đánh giá trùng 409 RB-LB09, kiểm tra bất biến QD14 (7/7 PASS).
    - Toàn bộ Vitest frontend: **44/44 tests PASS (100%)**.
    - Typecheck frontend: **0 errors** (`tsc --noEmit`).
    - Next.js Production Build: **100% SUCCESS** (toàn bộ 14 routes tĩnh/động prerender thành công).
- **Quyết định kỹ thuật:**
  - Thiết kế cấu trúc form độc lập theo từng sản phẩm trong đơn (`order_item_id`), phản ánh chính xác cấu trúc dữ liệu review của hệ thống e-commerce.
  - Sử dụng semantic tokens 100%, không sử dụng mã màu hex tự do trong `src/features/review`.
- **Contract/port thay đổi:**
  - Bổ sung contract `IReviewRepository`, `ReviewItemInput`, `CreateReviewPayload`, `ReviewRecord`, `ReviewResult`.
- **Blocker phát sinh:**
  - Không.
- **Test đã viết:**
  - `frontend/test/review.spec.ts` — Kiểm thử Review Form UI & Media Upload (O-507 & P-607c) — Kết quả: 7/7 PASS.

### 2026-09-29 (Hoàn thành Token Design System Refactor & Transaction Core Checkout/Orders Lifecycle)

- **Đã làm:**
  - **1. Chuẩn hóa Token Design System (Người 5 — Orders & Seller orders):**
    - Bổ sung biến token semantic `--success-border: #a7f3d0;` vào `:root` trong `frontend/src/app/globals.css`.
    - Thay thế toàn bộ mã màu hex tự do trong thẻ thống kê hàng đợi seller (`seller-orders-screen.tsx`):
      - "Chờ xác nhận": Chuyển từ `#f3dfb6`, `#794600`, `#fff7e8` sang `border-l-[var(--warning-border)]`, `text-[var(--warning)]`, `bg-[var(--warning-surface)]`.
      - "Đang chuẩn bị hàng": Chuyển từ `#d7c7f2`, `#50377e`, `#f6f0ff` sang `border-l-[var(--info-border)]`, `text-[var(--info)]`, `bg-[var(--info-surface)]`.
      - "Đang vận chuyển": Chuyển từ `#b2e8e0`, `#075f53`, `#eafaf7` sang `border-l-[var(--success-border)]`, `text-[var(--success)]`, `bg-[var(--success-surface)]`.
    - Thay thế mã màu hex tự do trong thông báo đơn hàng thành công (`orders-screen.tsx`): Chuyển `#b2e5c8`, `#126239` sang `border-[var(--success-border)]`, `text-[var(--success)]`.
    - Thay thế mã màu hex tự do trong chi tiết lý do hủy đơn (`order-card.tsx`): Chuyển `#8e2638` sang `text-[var(--danger)]`.
    - Kiểm tra regex toàn bộ `src/features/orders` và `src/features/seller`: **100% không còn mã hex hardcoded**.
  - **2. Hoàn thiện Transaction Core (Checkout -> Order Lifecycle & GAP-01 Mitigation):**
    - Hoàn thiện FE checkout theo `POST /checkout` với header `Idempotency-Key` thông qua `getOrCreateIdempotencyKey(payload)` và `ApiCheckoutRepository`.
    - Triển khai `registerCreatedOrder`: Khi đặt hàng thành công từ checkout, các order được tự động đăng ký vào store bộ nhớ chung, cho phép người mua và người bán nhìn thấy và thao tác ngay lập tức.
    - Triển khai mô hình `hybridOrderRepository` trong `repository-factory.ts`:
      - Đọc dữ liệu (`getOrders`, `getOrderById`): Frontend hybrid repository hiện vẫn dùng mock store dù backend đã có PostgreSQL order query routes; cần nối consumer và nghiệm thu thay vì chờ backend route.
      - Thao tác đơn hàng (`cancelOrder`, `confirmOrder`, `transitionOrder`): Khi có order ID hợp lệ, hệ thống gọi API thực tế tới Backend (`/orders/:id/cancel`, `/orders/:id/confirm`, `/orders/:id/transition`).
      - Xử lý xung đột Concurrency 409: Bắt và lan truyền chính xác mã lỗi 409 để giao diện hiển thị thông báo lỗi xung đột trạng thái và tự động làm mới dữ liệu.
      - Cơ chế Fallback an toàn: Tự động fallback sang mock state update khi offline hoặc chạy trong môi trường kiểm thử unit test.
    - Cập nhật điều hướng thành công tại `checkout-screen.tsx`: Chuyển hướng tới `/orders?created=${ids}` để hiển thị banner chúc mừng đặt hàng thành công tương ứng.
  - **3. Kiểm thử chất lượng (Quality Gates):**
    - Bổ sung unit tests trong `frontend/test/orders.spec.ts` và `frontend/test/seller-orders.spec.ts` kiểm thử toàn trình từ checkout tạo order ID đến hủy đơn buyer và fulfill seller.
    - Vitest: **37/37 tests PASS (100%)**.
    - Typecheck: **0 errors** (`tsc --noEmit`).
    - Next.js Production Build: **100% SUCCESS** (13/13 routes).
- **Quyết định kỹ thuật:**
    - Áp dụng Hybrid Repository Pattern: Kênh đọc hiện dùng mock trong FE trong khi backend query API có sẵn; kênh ghi gọi live mutation + sync store + 409 propagation. Cần xử lý read integration gap trước khi coi Buyer Orders live.
- **Contract/port thay đổi:**
  - `ICheckoutRepository.submitCheckout(payload, idempotencyKey)`: Bắt buộc truyền `idempotencyKey`.
  - Xuất helper `registerCreatedOrder` từ `repository-factory.ts`.
- **Blocker phát sinh:**
  - Không.

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
| Buyer `confirm-received` (P0-08 / C-103) | Người 1, 5 | `POST /orders/:id/confirm-received` | Đã hoàn tất (BE route & FE UI/Action) | [docs/frontend-spec/08-implementation-plan.md](../08-implementation-plan.md) |

## Việc được giao

- [x] O-502 — Buyer order center UI (`/orders`), tabs 7 trạng thái, order card, loading/empty/error states. Acceptance live read chưa xong: frontend hybrid `getOrders` vẫn dùng mock dù backend PostgreSQL query routes đã có.
- [x] O-503 — Cancel order dialog, bắt buộc nhập lý do (RB-LTT08), gọi live API + fallback mock khi offline/mạng lỗi, xử lý 409 conflict tự động làm mới.
- [x] O-504 & O-505 — Seller orders table (`/seller/orders`) & quy trình xử lý đơn tuần tự (gọi live API mutation + fallback mock khi offline).
- [x] O-507 — Review form UI (`/orders/[id]/review`), điều kiện hoàn thành QD14, chống đánh giá trùng RB-LB09 (gọi live API + fallback mock khi offline/chưa có auth).
- [x] A-704/A-705/A-708 — admin dashboard, user lock/unlock, seller KPI khi API sẵn (tuân thủ nghiêm ngặt quy tắc QD19 doanh thu chỉ tính đơn COMPLETED, fallback mock khi API chưa sẵn sàng).
- [x] A-709 — admin categories page, tiêu thụ category adapter A-700 của Người 3 (RB-KN04 cây danh mục tối đa 2 cấp).
- [x] P-607c — review media UI khi P-606/GAP-09 đóng (xem trước tức thì, tối đa 5 ảnh, 5MB).
- [x] Q-805 — RBAC/security gate cho direct URL/API (`/admin`, `/admin/categories`, `/seller`).
- [x] P0-08 / C-103, C-104 — Buyer `confirm-received` (`POST /orders/:id/confirm-received` chuyển đơn từ `SHIPPING` sang `COMPLETED`, cập nhật history và mở khóa nút Đánh giá Review).
