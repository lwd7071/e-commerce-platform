# Nhật ký tiến độ — Người 4 (Buyer supporting domain)

## Trạng thái hiện tại

- Mốc: T2
- Cập nhật lần cuối: 2026-09-23
- Đang làm: Đã hoàn tất 100% các hạng mục T2 của Người 4 bao gồm cả các hạng mục phụ thuộc: Đấu nối ReviewService với IOrderQueryPort chính thức từ Người 5 (thực thi QD14, QD15, RB-LB09, RB-LQH05, RB-MG08); Tích hợp Event Bus thật cho NotificationService lắng nghe TransactionDomainEvent (ORDER_COMPLETED, PAYMENT_SUCCESS, SHIPMENT_DELIVERED) kèm null-safety và deduplication; Triển khai ReviewImageEntity (RB-MG11) và ReviewMediaService theo cấu trúc storage path canonical users/{userId}/reviews/{reviewId}/{imageId}.{ext} tương thích với Storage RLS policy của Người 2; Dọn sạch 100% cảnh báo ESLint (0 errors, 0 warnings); Đạt 451/451 tests native node PASS 100%, 123/123 tests vitest PASS 100%, 0 lỗi typecheck.
- Bị block bởi: Không còn blocker. Đã hoàn tất toàn bộ tích hợp domain phụ thuộc vào Người 2 và Người 5.

## Nhật ký theo ngày

### 2026-09-23 (Mốc T2 — Đấu nối Order Query thật, Event Bus thật và Review Image Upload theo chuẩn TDD & Storage RLS)

- **Đã làm:**
  - **Phase 1: Đấu nối `ReviewService` với `IOrderQueryPort` chính thức từ Người 5:**
    - Thay thế stub port nội bộ bằng re-export `IOrderQueryPort`, `ReviewOrderItemDTO`, `OrderSummaryDTO` từ `backend/src/modules/order/contracts/order-query.contract.ts` tại `src/modules/buyer/ports/order-query.port.ts`.
    - Đấu nối `ReviewService.createReview` trực tiếp vào `getOrderItemForReview(orderItemId, buyerId)`.
    - Thực thi triệt để `[QD14]` (chỉ buyer sở hữu đơn `COMPLETED` mới được đánh giá, `REVIEW_NOT_ELIGIBLE`), `[RB-LQH05]` (`Review.ProductID === OrderItem.ProductID`, `VALIDATION_FAILED`), `[RB-LB09]` (chống duplicate review trên cùng OrderItem, `REVIEW_ALREADY_EXISTS`), `[QD15, RB-MG08]` (rating 1..5 nguyên, `VALIDATION_FAILED`).
    - Cập nhật bộ unit test `review.service.spec.ts` đạt 11/11 tests pass.
  - **Phase 2: Tích hợp Event Bus thật cho `NotificationService` với `TransactionDomainEvent`:**
    - Cập nhật `src/modules/buyer/ports/buyer-event.port.ts` định nghĩa `ITransactionEventPort` nhận các sự kiện `TransactionDomainEvent` từ Người 5.
    - Cập nhật `NotificationService` tự động phân loại sự kiện:
      - `ORDER_STATUS_CHANGED` + `newStatus === 'COMPLETED'` $\rightarrow$ tạo notification loại `ORDER` cho `event.buyerId`.
      - `PAYMENT_STATUS_CHANGED` + `status === 'SUCCESS'` $\rightarrow$ tra cứu `buyerId` qua `orderQueryPort.getOrderSummary(event.orderId)`, tạo notification loại `PAYMENT`.
      - `SHIPMENT_STATUS_CHANGED` + `status === 'DELIVERED'` $\rightarrow$ tra cứu `buyerId` qua `orderQueryPort.getOrderSummary(event.orderId)`, tạo notification loại `SHIPPING`.
      - Xử lý **Null-safe**: Khi `getOrderSummary` trả `null` (order không tồn tại/bị xóa), ghi nhận `eventId` vào `processedEventIds` và return an toàn, tuyệt đối không throw lỗi crash event loop.
      - Duy trì cơ chế in-memory deduplication `processedEventIds` bảo đảm tính idempotent khi replay events.
    - Cập nhật bộ unit test `notification.service.spec.ts` đạt 14/14 tests pass.
  - **Phase 3: Triển khai `ReviewImageEntity` + `ReviewMediaService` chuẩn Storage RLS:**
    - Tạo `src/modules/buyer/domain/media.ts` triển khai `ReviewImageEntity` thực thi `[RB-MG11]` (`sortOrder >= 0` số nguyên không âm).
    - Tạo `src/modules/buyer/services/review-media.service.ts` sinh và kiểm tra đường dẫn canonical `users/{userId}/reviews/{reviewId}/{imageId}.{ext}` theo đúng Storage RLS policy của Người 2 (`backend/db/storage.ts` & `backend/db/storage-policies.sql`).
    - Xác thực quyền sở hữu ảnh của caller (`auth-rbac-rls.md` §3 & §4): Chặn đứng việc tạo review với storage path thuộc user khác (`VALIDATION_FAILED`).
    - Đấu nối `ReviewMediaService` vào `ReviewService.createReview`.
    - Viết mới bộ unit test `review-media.service.spec.ts` đạt 18/18 tests pass.
  - **Phase 4: Integration Test xuyên domain & Quality Gates:**
    - Viết `test/modules/buyer/integration/order-query-review.integration.spec.ts` đấu nối thật giữa `ReviewService` và `OrderQueryService` + `InMemoryOrderRepository` của Người 5 (5/5 tests pass).
    - Dọn sạch 5 warning ESLint còn sót lại trong `pg-buyer.repository.ts`, đạt chuẩn **0 errors, 0 warnings** trên toàn bộ module buyer.
    - **Quality Gates:**
      - `npm run typecheck` (`tsc --noEmit`): Exit code 0, sạch 100% lỗi type.
      - `npm run test:node`: **451/451 tests PASS 100%** (0 fail, 0 skipped).
      - `npx vitest run`: **123/123 tests PASS 100%** (21/21 test files).
      - `npx eslint src/modules/buyer test/modules/buyer`: **0 errors, 0 warnings**.


- **Đã làm:**
  - **Dọn sạch 100% cảnh báo `@typescript-eslint/no-explicit-any` (0 errors, 0 warnings):**
    - Sửa toàn bộ 108 warnings trong 5 file integration test (`cart`, `notification`, `review`, `user-profile-address`, `voucher`) và mã nguồn Buyer.
    - Chuẩn hóa `MockDbClient` dùng typed rows và `unknown[]`. Chuyển đổi toàn bộ assertions `(err: any)` sang `(err: unknown)`.
    - Chuẩn hóa `buyer.dto.ts` nhận `snake_case`, bổ sung validation chặn `null` object để tránh TypeError 500 runtime.
  - **Thiết kế Stub Port nội bộ (Chuẩn bị điểm nối cho Người 5):**
    - Tạo `IOrderQueryPort` (`backend/src/modules/buyer/ports/order-query.port.ts`): Cung cấp `getOrderItemContext` (tái dùng `ReviewOrderItemContext`) để kiểm tra điều kiện đánh giá.
    - Tạo `IBuyerEventPort` (`backend/src/modules/buyer/ports/buyer-event.port.ts`): Cung cấp `publish`/`subscribe` cho các sự kiện `ORDER_COMPLETED`, `PAYMENT_SUCCESS`, `SHIPMENT_DELIVERED`.
    - *Ghi chú rõ ràng:* Đây là stub port nội bộ tạm thời cho T2, sẽ được thay thế hoàn toàn khi Người 5 bàn giao contract chính thức.
  - **Triển khai toàn diện 5 Application Services theo chuẩn TDD (Red $\rightarrow$ Green $\rightarrow$ Refactor):**
    - **`ProfileService` (`profile.service.ts`):** Quản lý hồ sơ người mua, ném `RESOURCE_NOT_FOUND` (404) khi không tìm thấy hồ sơ theo `auth-rbac-rls.md` §3.
    - **`AddressService` (`address.service.ts`):**
      - Bảo vệ quyền sở hữu riêng tư nghiêm ngặt theo `auth-rbac-rls.md` §3: Trả về 404 `RESOURCE_NOT_FOUND` (không trả 403) khi truy cập, sửa, xoá, hoặc đặt default địa chỉ của user khác.
      - Thực thi quy tắc nghiệp vụ `[RB-LB05]`: Tối đa 10 địa chỉ/User (`VALIDATION_FAILED`), tối đa 1 địa chỉ `isDefault = TRUE`.
      - Áp dụng heuristic UX: Tự động gán `isDefault = true` cho địa chỉ đầu tiên của user nếu danh sách đang rỗng.
    - **`CartService` (`cart.service.ts`):**
      - Inject `ICatalogPort`, gọi `getVariantPriceAndStock` kiểm tra `status === 'ACTIVE'` (`VALIDATION_FAILED` nếu không active) và kiểm tra tồn kho `quantity <= stockQuantity` (ném `409 INVENTORY_INSUFFICIENT` theo `error-observability.md`).
      - Bảo vệ quyền sở hữu theo `auth-rbac-rls.md` §3: Trả về 404 `RESOURCE_NOT_FOUND` khi `cartItemId` không thuộc giỏ của caller.
      - Cộng dồn số lượng sản phẩm khi trùng variant và tự động khởi tạo giỏ hàng nếu buyer chưa có giỏ.
    - **`VoucherService` (`voucher.service.ts`):**
      - `listActiveVouchers`: Liệt kê và lọc voucher theo scope (`PLATFORM` / `SHOP`), `shopId` và khoảng thời gian hiệu lực `[startAt, endAt]`.
      - `getVoucherByCode`: Trả về 404 `RESOURCE_NOT_FOUND` khi mã voucher không tồn tại.
      - `previewVoucher`: Ủy thác cho domain `evaluateVoucher` (thực thi `QD09`, `RB-LTT05`, `RB-MG09`, `RB-LTT03`, `RB-LTT04`), tính toán chính xác tiền giảm giá và áp dụng cap `maxDiscount`.
    - **`ReviewService` (`review.service.ts`):**
      - Kiểm tra điều kiện đánh giá qua `IOrderQueryPort` (`[QD14]`): Đơn hàng phải ở trạng thái `COMPLETED` và thuộc quyền sở hữu của buyer đang đăng nhập (`REVIEW_NOT_ELIGIBLE`).
      - Thực thi quy tắc tính nhất quán sản phẩm `[RB-LQH05]`: `Review.ProductID === OrderItem.ProductID`, ném `VALIDATION_FAILED` nếu sản phẩm không khớp.
      - Thực thi `[RB-LB09 / QD15 / RB-MG08]`: Mỗi `OrderItem` chỉ được đánh giá tối đa 1 lần (`REVIEW_ALREADY_EXISTS`), rating bắt buộc là số nguyên trong khoảng 1..5.
    - **`NotificationService` (`notification.service.ts`):**
      - Thực thi quy tắc `[RB-LTT07]`: `isRead = TRUE => readAt != null`, idempotent khi gọi lại `markAsRead`.
      - Bảo vệ quyền sở hữu theo `auth-rbac-rls.md` §3: Trả về 404 `RESOURCE_NOT_FOUND` khi caller không sở hữu thông báo.
      - Kiến trúc Dual-path: Lắng nghe và xử lý domain events (`PAYMENT_SUCCESS`, `SHIPMENT_DELIVERED`, `ORDER_COMPLETED`) tự động tạo notification tương ứng.
      - Cơ chế Idempotency & Replay: Áp dụng in-memory deduplication `processedEventIds` để bỏ qua các event trùng lặp `eventId`.
  - **Mã ticket phụ thuộc phát sinh gửi Người 2:**
    - `DEP-P4-P2-01`: Đề xuất Người 2 bổ sung cột `event_id VARCHAR(100) UNIQUE` vào bảng `notifications` trong Schema v2 để bảo đảm tính idempotent ở tầng CSDL khi nhiều instance chạy phân tán.
  - **Chỉ số kiểm thử & Quality Gates:**
    - `npm run typecheck` (`tsc --noEmit`): Exit code 0, sạch 100% lỗi type.
    - `npx eslint src/modules/buyer test/modules/buyer`: 0 errors, 0 warnings.
    - `npm test`: **243/243 tests PASS 100% (0 fail)**.
    - Bộ test riêng Buyer Domain: **181/181 tests PASS 100%** (69 domain unit tests + 41 integration tests + 71 services tests).


### 2026-09-17 (Mốc T2 — Triển khai PostgreSQL Repositories theo chuẩn SOLID & Bàn giao Query Patterns)

- **Đã làm:**
  - **Triển khai kiến trúc SOLID toàn diện cho tầng Infrastructure:**
    - **Single Responsibility (S):** Tách biệt tầng Row Mapping (`row-mappers.ts`) phụ trách chuyển đổi giữa `snake_case` (PostgreSQL DB rows) và `camelCase` (Domain models) cho toàn bộ 9 bảng CSDL.
    - **Open/Closed (O):** Thiết kế cấu trúc truy vấn mở rộng, tường minh, không thay đổi core domain types khi mở rộng storage driver.
    - **Liskov Substitution (L):** Cả 6 PostgreSQL Repositories tuân thủ 100% contracts của 6 Domain Interfaces trong `domain/repositories.ts`, hoán đổi hoàn hảo với `InMemoryRepository` mà không làm thay đổi hành vi tầng Domain/Service.
    - **Interface Segregation (I):** 6 Interfaces chuyên biệt cho 6 Aggregate (`IUserProfileRepository`, `IAddressRepository`, `ICartRepository`, `IVoucherRepository`, `IReviewRepository`, `INotificationRepository`).
    - **Dependency Inversion (D):** Định nghĩa contract trừu tượng `IDbClient` (`infrastructure/db-client.ts`). Repositories phụ thuộc vào abstraction này thông qua Constructor Injection, tương thích tuyệt đối với `pg.Pool`, `pg.PoolClient`, hoặc transaction client của Người 2 mà không bị coupled chặt vào low-level driver.
  - **Khắc phục lỗi Web API Name Collision:** Sửa `repositories.ts` để import tường minh `Notification` từ `./types`, loại bỏ hoàn toàn cảnh báo xung đột kiểu với `window.Notification` của DOM.
  - **Triển khai 6 PostgreSQL Repositories thật:**
    - `PostgresUserProfileRepository`: `findByUserId`, `upsert` (ON CONFLICT DO UPDATE).
    - `PostgresAddressRepository`: `findById`, `findByUserId` (ORDER BY is_default DESC, created_at DESC), `create`, `update`, `delete`, `setDefault` (nguyên tử trong 2 lệnh tuần tự/transaction).
    - `PostgresCartRepository`: `findByBuyerId`, `createCart`, `getItems`, `addItem` (ON CONFLICT (cart_id, variant_id) DO UPDATE quantity = quantity + EXCLUDED.quantity), `updateItem`, `removeItem`, `clearCheckedOutItems` (bảo vệ quyền sở hữu của buyer).
    - `PostgresVoucherRepository`: `findById`, `findByCode`, `listActive` (lọc đa điều kiện status, time range, quantity, scope/shopId), `create`, atomic `decrementQuantity` (quantity > 0), compensating `incrementQuantity` (RB-LQH03), `recordUsage` (bảo vệ uq_voucher_usages__order_id).
    - `PostgresReviewRepository`: `findById`, `findByOrderItemId`, `findByProductId` (status = VISIBLE), `create` (kèm lưu danh sách review_images liên kết).
    - `PostgresNotificationRepository`: `findById`, `findByRecipientId` (lọc isRead), `create`, `markAsRead` (idempotent, cập nhật is_read = TRUE và read_at).
  - **Áp dụng triệt để /tdd Skill cho toàn bộ 5 Phase Integration Tests:**
    - Viết Red tests trước cho từng Phase $\rightarrow$ Chạy xác nhận fail (`ERR_MODULE_NOT_FOUND`) $\rightarrow$ Implement repository $\rightarrow$ Chạy xác nhận Green.
    - `user-profile-address.integration.test.ts`: 8/8 tests pass.
    - `cart.integration.test.ts`: 9/9 tests pass.
    - `voucher.integration.test.ts`: 10/10 tests pass.
    - `review.integration.test.ts`: 8/8 tests pass.
    - `notification.integration.test.ts`: 6/6 tests pass.
  - **Chu kỳ Chẩn đoán Sâu (Deep Diagnosis Loop theo backend-task-workflow.md Bước 7 & Bước 8):**
    - **Phát hiện & Sửa lỗi Runner Lệch Thư Mục:** Runner chính thức của dự án quy định tại `package.json` là `test/**/*.spec.ts`. Đã đồng bộ toàn bộ 5 bộ integration test sang đúng vị trí chuẩn `test/modules/buyer/integration/*.integration.spec.ts` và bổ sung mock data đầy đủ vào `test/modules/buyer/fixtures.ts`.
    - **Phát hiện & Sửa lỗi Type Casting:** Khắc phục 32 vị trí ép kiểu thừa `as unknown as PoolClient` sang `as IDbClient` theo chuẩn SOLID: D, giải quyết triệt để lỗi `TS2304`.
    - **Dọn dẹp cảnh báo Linter:** Loại bỏ hoàn toàn các unused imports (`ReviewImage`, `CartItem`, `ValidationError`).
  - **Soạn thảo và bàn giao tài liệu Query Patterns:**
    - Tạo `docs/architecture/buyer-query-patterns.md` mô tả chi tiết từng query pattern trên 9 bảng, tần suất thực thi và đề xuất composite/partial indexes cho Người 2 (`idx_cart_items__cart_id__created_at`, `idx_vouchers__active_listing`, `idx_reviews__product_visible`, `idx_addresses__user_id__default`).
  - **Kiểm tra chất lượng kiểm thử & Quality Gates:**
    - `npm run typecheck` (`tsc --noEmit`): Exit code 0, sạch 100% lỗi type.
    - `npm run build` (`esbuild`): Biên dịch `dist/app.js` (1.1MB) thành công không lỗi.
    - `npx eslint src/modules/buyer`: 0 errors.
    - `npm test` (Lệnh test toàn hệ thống): **172/172 tests PASS 100% (0 fail)**.
    - Test riêng Buyer domain: **110/110 tests PASS 100%** (69 unit tests + 41 integration tests).

### 2026-09-17 (Sửa lỗi sau chẩn đoán Diagnose chuyên sâu theo TDD & bổ sung test suite)

- **Đã làm:**
  - **Khắc phục lỗi kiểm tra định dạng số tiền giảm giá rác:** Bổ sung kiểm tra định dạng số thập phân nghiêm ngặt `DECIMAL_REGEX = /^\d+(\.\d+)?$/` tại `validateDiscountRange` (`backend/src/modules/buyer/domain/voucher.ts`). Chặn đứng hoàn toàn việc chấp nhận các chuỗi số chứa ký tự rác (như `'10garbage'`, `'20garbage'`, `'abc'`) vốn lọt qua do cơ chế `parseFloat` trước đây (`RB-MG09`, `RB-LTT04`).
  - **Khắc phục lỗi kiểm tra thời điểm voucher không hợp lệ:** Bổ sung kiểm tra `isNaN(now)` tại `validateVoucherTime`. Từ chối dứt khoát các giá trị thời điểm rác như `'not-a-date'` hoặc chuỗi ISO hỏng với mã lỗi `VALIDATION_FAILED` (`RB-LTT03`, `QD09`).
  - **Khắc phục lỗi kiểm tra `orderSubtotal` và chặn discount giả mạo:** Bổ sung validate nghiêm ngặt `DECIMAL_REGEX` và giá trị không âm cho `subtotalStr` trong `calculateDiscountAmount` và `orderSubtotal` trong `evaluateVoucher`. Chặn đứng nguy cơ tạo ra discount amount giả khi đầu vào là chuỗi không hợp lệ (`RB-MG09`, `QD09`).
  - **Triển khai cơ chế Compensating Transaction Rollback cho `consumeVoucher`:**
    - Bổ sung phương thức `incrementQuantity?(voucherId: UUID): Promise<boolean>` vào `IVoucherRepository` (`domain/repositories.ts`).
    - Cài đặt `incrementQuantity` cho `InMemoryVoucherRepository` (`in-memory-repos.ts`).
    - Cập nhật `VoucherPortService.consumeVoucher`: bọc khối `recordUsage` trong `try/catch`. Khi `recordUsage` thất bại (ví dụ: DB error, conflict Order), tự động gọi `incrementQuantity` để phục hồi số lượt của voucher về nguyên vẹn, đảm bảo tính nguyên tử theo `order-workflow-transactions.md` §6 và `RB-LQH03`.
  - **Chuẩn hóa Module Imports:** Loại bỏ phần mở rộng `.ts` ở toàn bộ 13 file nguồn trong `backend/src/modules/buyer/` và các file test. Chuyển sang sử dụng `crypto.randomUUID()` Web Crypto API chuẩn. Kết quả: Vượt qua cổng kiểm tra `tsc --noEmit` đạt **Exit code 0, sạch 100% lỗi `TS5097`**.
  - **Bổ sung các test cases biên & idempotent theo bảng plan:**
    - `[RB-LB05] ADDR-03`: Gọi lại trên địa chỉ vốn đã là default -> giữ nguyên `isDefault=true` (idempotent) — Pass.
    - `[RB-LB05] ADDR-04`: `targetAddressId` không tồn tại trong danh sách -> reject `VALIDATION_FAILED` — Pass.
    - `[RB-MG05] CART-03`: `quantity = 1.5` (số thập phân) -> reject `VALIDATION_FAILED` — Pass.
    - `[RB-LB04] CART-08`: Thêm variant khác vào cart -> tách thành 2 dòng riêng biệt — Pass.
  - **Đồng bộ hóa cấu trúc thư mục kiểm thử:** Thiết lập thư mục `backend/tests/modules/buyer/*.test.ts` chuẩn dự án (đồng bộ với Người 2 Database và Người 3 Catalog) đồng thời duy trì tương thích hoàn hảo cho `backend/test/modules/buyer/*.spec.ts`.
- **Test bổ sung (TDD Red → Green):**
  - `[RB-MG09]` type=FIXED, value="10garbage" có ký tự rác -> reject VALIDATION_FAILED — Pass.
  - `[RB-MG09]` type=FIXED, value="abc" không phải số -> reject VALIDATION_FAILED — Pass.
  - `[RB-LTT04]` type=PERCENT, value="20garbage" có ký tự rác -> reject VALIDATION_FAILED — Pass.
  - `[RB-MG09]` type=FIXED, value="0.00" -> reject VALIDATION_FAILED — Pass.
  - `[RB-MG09]` calculateDiscountAmount với subtotal="not-a-number" -> reject VALIDATION_FAILED — Pass.
  - `[RB-MG09]` evaluateVoucher với orderSubtotal="abc" -> reject VALIDATION_FAILED — Pass.
  - `[RB-MG09]` evaluateVoucher với orderSubtotal="100000garbage" -> reject VALIDATION_FAILED — Pass.
  - `[RB-MG09]` evaluateVoucher với orderSubtotal="-50000" -> reject VALIDATION_FAILED — Pass.
  - `[RB-LTT03, QD09]` now = "not-a-date" không hợp lệ -> reject VALIDATION_FAILED — Pass.
  - `[RB-LTT03, QD09]` now = "invalid-iso-string" -> reject VALIDATION_FAILED — Pass.
  - `[QD09, RB-LTT03]` evaluateVoucher với now="not-a-date" -> reject VALIDATION_FAILED — Pass.
  - `[RB-LQH03, Concurrency]` consumeVoucher: khi recordUsage thất bại -> kích hoạt rollback incrementQuantity và bảo toàn quantity — Pass.
- **Tổng số test cases nâng lên:** **69/69 tests PASS 100%** trên cả hai bộ runner (`backend/tests/modules/buyer/*.test.ts` và `backend/test/modules/buyer/*.spec.ts`).

### 2026-09-16
- Áp dụng triệt để phương pháp TDD (`/tdd` skill), thực hiện đầy đủ các vertical slices (Red → Green), không bỏ qua test nào.
- **Phase 1 (Khóa hợp đồng & Types):**
  - Tạo `src/modules/buyer/domain/types.ts`: Định nghĩa types cho 6 thực thể theo Schema Freeze v1 (`UserProfile`, `Address`, `Cart`, `CartItem`, `Voucher`, `VoucherUsage`, `Review`, `ReviewImage`, `Notification`).
  - Tạo `src/modules/buyer/domain/errors.ts`: Định nghĩa error codes chuẩn (`VALIDATION_FAILED`, `VOUCHER_NOT_APPLICABLE`, `CART_CONFLICT`, `CART_ITEM_CONFLICT`, `DEFAULT_ADDRESS_CONFLICT`, `REVIEW_NOT_ELIGIBLE`, `REVIEW_ALREADY_EXISTS`, v.v.).
  - Tạo `src/modules/buyer/ports/cart.port.ts`: Đóng băng hợp đồng `ICartPort` (`getSelectedItems`, `clearCheckedOutItems`).
  - Tạo `src/modules/buyer/ports/voucher.port.ts`: Đóng băng hợp đồng `IVoucherPort` (`evaluateVoucher`, `consumeVoucher`), làm rõ `discountAmount` là input cho QD10/RB-LQH03 ở Order của Người 5.
  - Tạo `test/modules/buyer/fixtures.ts`: Mock data dùng chung cho unit tests.
- **Phase 2 (TDD Voucher & Cart Rules):**
  - Viết `test/modules/buyer/voucher.spec.ts` và triển khai `src/modules/buyer/domain/voucher.ts`:
    - Slice 1 (Thời gian, RB-LTT03, QD09): StartAt < EndAt, chặn hết hạn hoặc chưa tới hạn.
    - Slice 2 (Loại giảm giá & miền giá trị, RB-LTT04, RB-MG09): PERCENT trong (0, 100], FIXED > 0.
    - Slice 3 (Tính tiền giảm & Cap, RB-MG09): Tính discountAmount chính xác, cap theo MaxDiscount và Subtotal.
    - Slice 4 (Scope, lượt dùng, min order, QD09, RB-LTT05): PLATFORM shopId null, SHOP shopId not null, trùng shopId, quantity > 0, subtotal >= minOrderValue.
  - Viết `test/modules/buyer/cart.spec.ts` và triển khai `src/modules/buyer/domain/cart.ts`:
    - Slice 1 (RB-MG05): Cart quantity >= 1.
    - Slice 2 (RB-LB04): UNIQUE(cartId, variantId), cộng dồn quantity khi thêm trùng variant thay vì tạo dòng mới.
    - Slice 3 (RB-LB03): 1 cart / buyer (chặn `CART_CONFLICT` khi đã có giỏ).
- **Phase 3 (TDD Address, Review & Notification Rules):**
  - Viết `test/modules/buyer/address.spec.ts` và triển khai `src/modules/buyer/domain/address.ts`:
    - Slice 1 (RB-LB05): Duy nhất 1 địa chỉ mặc định, tự động chuyển các địa chỉ cũ thành `isDefault = false`.
  - Viết `test/modules/buyer/review.spec.ts` và triển khai `src/modules/buyer/domain/review.ts`:
    - Slice 1 (QD15, RB-MG08): Rating integer từ 1 đến 5.
    - Slice 2 (QD14, RB-LB09): Review eligibility (đúng buyer sở hữu, đơn COMPLETED, chặn duplicate review `REVIEW_ALREADY_EXISTS`).
  - Viết `test/modules/buyer/notification.spec.ts` và triển khai `src/modules/buyer/domain/notification.ts`:
    - Slice 1 (RB-LTT07): Đánh dấu đã đọc tự động set `readAt = now()`, xử lý idempotent khi gọi lặp.
- **Phase 4 & Phase 5 (DTOs, Repository Interfaces, Services & Endpoint Contracts):**
  - Triển khai `src/modules/buyer/contracts/buyer.dto.ts` kèm hàm validate reject unknown fields với `422 VALIDATION_FAILED` theo `api-conventions.md` §2.
  - Triển khai `src/modules/buyer/domain/repositories.ts`: Interface độc lập cho 6 repositories.
  - Triển khai `src/modules/buyer/services/cart-port.service.ts` và `src/modules/buyer/services/voucher-port.service.ts`.
  - Viết `test/modules/buyer/ports.spec.ts`: Xác nhận 100% các case của `ICartPort` và `IVoucherPort` pass xanh.
  - Viết `test/modules/buyer/dto-validation.spec.ts`: Xác nhận validation DTOs pass xanh.
  - Soạn tài liệu bàn giao `src/modules/buyer/contracts/endpoint-contracts.md` đầy đủ format `/api/v1` và Envelope chuẩn, ghi rõ PATCH notification resource-based theo đúng `api-conventions.md` §1.
- **Kết quả kiểm thử toàn diện:**
  - Chạy `node --test backend/test/modules/buyer/*.spec.ts`: Đạt **53/53 tests PASS (100% xanh)**, không có test nào bị skip hay lỗi.

## Contract đang sở hữu

| Tên | Trạng thái bàn giao | Version/ngày khóa | Người tiêu thụ |
|---|---|---|---|
| `ICartPort` | Sẵn sàng bàn giao (đã có implementation + tests) | v1 / 2026-09-16 | Người 5 (Transaction Core), Người 1 |
| `IVoucherPort` | Sẵn sàng bàn giao (đã có implementation + compensating rollback + tests) | v2 / 2026-09-17 | Người 5 (Transaction Core), Người 1 |
| Buyer Supporting REST Contracts | Đã công bố tại `endpoint-contracts.md` | v1 / 2026-09-16 | Người 1 (Platform Lead) |

## Việc còn lại trong mốc hiện tại

### 2026-09-18 — PostgreSQL Buyer persistence

- Đã thêm `PgAddressRepository`, `PgCartRepository` và `PgVoucherRepository` với mapper
  snake_case → domain camelCase, ownership filter cho Address và `ON CONFLICT (cart_id,variant_id)`
  để cộng dồn CartItem, không tạo duplicate.
- Cart add chạy trong `PoolClient` transaction; Voucher decrement dùng điều kiện `quantity > 0`
  để hai transaction tranh lượt cuối chỉ một transaction thành công.
- Đã thêm `PgBuyerHttpService` cho Address/Cart/Voucher T1 routes; Address update/delete/set-default
  vẫn ngoài scope T1.
- Typecheck và lint pass.

### 2026-09-19 — T1 buyer closeout

- Đã bàn giao hai route Address tối thiểu (`GET`/`POST /api/v1/addresses`) và Cart/Voucher route handlers cho Người 1 wiring.
- Đã xác nhận `PoolClient` được truyền xuyên suốt checkout adapter; ownership Address/Cart và điều kiện decrement Voucher được thực thi ở PostgreSQL.
- Rollback và cạnh tranh lượt Voucher giữ cùng transaction boundary; update/delete/set-default Address tiếp tục ngoài scope T1.

- [x] Thiết kế model, DTO, validation và repository interface cho Profile, Address, Cart, Voucher, Review và Notification.
- [x] Định nghĩa, công bố Cart port và Voucher port cho Người 5.
- [x] Soạn endpoint contract cho Buyer supporting domain và mock fixture theo Schema Freeze.
- [x] Viết unit test thuần cho cart quantity, voucher rule, rating và default address.
- [x] Sửa triệt để các lỗi chẩn đoán (decimal rác, date không hợp lệ, subtotal rác, rollback cho voucher consumption, chuẩn hóa imports sạch không có đuôi `.ts`).
- [x] Sau khi Người 1 hoàn thành scaffold và cấu trúc module: đặt Buyer modules vào backend (`src/modules/buyer/` và `test/modules/buyer/`).
- [x] Sau khi Người 2 hoàn thành migration các bảng liên quan và database client: hoàn thành 6 PostgreSQL Repositories và 41 integration tests.
- [x] Soạn thảo và bàn giao tài liệu Query Patterns cho Người 2 (`docs/architecture/buyer-query-patterns.md`).
- [x] Dọn sạch 100% cảnh báo `@typescript-eslint/no-explicit-any` trong mã nguồn và integration tests của Buyer (0 errors, 0 warnings).
- [x] Triển khai toàn bộ 5 Application Services (`ProfileService`, `AddressService`, `CartService`, `VoucherService`, `ReviewService`, `NotificationService`) theo TDD với quyền sở hữu 404 riêng tư (`auth-rbac-rls.md` §3), ràng buộc QD/RB và kiểm tra tồn kho Catalog.
- [x] Định nghĩa stub ports `IOrderQueryPort` và `IBuyerEventPort` sẵn sàng điểm nối khi Người 5 bàn giao.
- [x] Sau khi Người 1 mở shared contract structure: đưa Cart/Voucher port vào `src/contracts` qua owner.
- [x] Sau khi Người 5 khóa Order query/state contract: tích hợp Review với Order thật (`IOrderQueryPort`).
- [x] Sau khi Người 5 công bố Order/Payment/Shipment events: tích hợp Notification với events thật (`ITransactionEventPort`).
- [x] Sau khi Người 2 mở Storage RLS policy: tích hợp Review Image Upload với path canonical `users/{userId}/reviews/{reviewId}/{imageId}.{ext}` (`ReviewMediaService`).
- [ ] Sau khi Người 1 khóa `RequestContext` và router: wiring endpoints Buyer Supporting Domain.

