# Nhật ký tiến độ — Người 5 (Transaction core)

## Trạng thái hiện tại

- Mốc: T1
- Cập nhật lần cuối: 2026-09-18
- Đang làm: Đã đối chiếu rules và sửa 4 hành vi độc lập bằng TDD; regression TV5 26/26 pass, typecheck/build pass. Chưa đạt full backend quality gate do lỗi khởi động tsx. Order snapshot/history vẫn chưa hoàn thành, chờ Người 3; chưa RED/builder/GREEN cho snapshot; chưa Done T1.
- Bị block bởi: Order snapshot/history chờ Người 3 bảo đảm productName, cung cấp shopId và xác nhận mapping VariantSnapshot từ ngày 2026-09-18. Full npm test bị lỗi tsx/OS ENOMEM; cần Người 1 hoặc môi trường chạy xử lý. Cần Người 4/nhóm trưởng xác nhận giới hạn discount với shipping và các policy chưa khóa. Các dependency T1 còn lại: transaction/DB persistence và idempotency storage của Người 2; transaction-compatible Cart/Voucher/Catalog adapters của Người 3/4; API wiring/envelope/auth integration của Người 1.

## Nhật ký theo ngày

### 2026-09-18 — TDD phần Order transaction độc lập

- Đã làm:
  - Đọc kế hoạch, đặc tả gốc phần liên quan, Schema Freeze, toàn bộ architecture rules và code/test TV5; lập kế hoạch 5 phase và bảng rule/implementation/test trong [báo cáo kiểm tra](nguoi-5-order-rules-audit.md).
  - Ghi nhận branch `dev` và 5 file thay đổi có sẵn; bảo toàn nội dung trước lượt này, không reset/stash/ghi đè công việc cũ.
  - Sửa 4 hành vi qua từng vòng RED → GREEN: quantity vượt PostgreSQL INTEGER; actor Order unknown được phép transition; Payment nhận ngày không tồn tại; paidAt chưa chuẩn hóa UTC.
  - Bổ sung 3 test biên calculation đã pass ngay; không sửa implementation đúng để tạo RED giả. Không cần refactor thêm.
- Quyết định kỹ thuật:
  - Test tại public seam calculation, Order/Payment/Shipment state machine và checkout validation do người dùng chỉ định; giữ bigint cents và interface hiện có.
  - Dùng `node --experimental-strip-types --test` cho test TV5 khi runner tsx lỗi; không coi runner thay thế này là full backend gate.
  - Không triển khai snapshot/history, orchestration hoặc persistence; không sửa code/contract owner khác hay Schema Freeze; không commit/push.
- Contract/port thay đổi:
  - Không.
- Blocker phát sinh:
  - Full backend test: `npm.cmd --logs-max=0 test` exit 1 trước khi chạy test vì `uv_os_get_passwd returned ENOMEM` trong tsx — Cần: Người 1 hoặc môi trường chạy khắc phục runner, chạy lại full npm test — Từ ngày: 2026-09-18.
  - Calculation đang giới hạn discount <= subtotal; tài liệu đã đọc chỉ khóa công thức tổng và total >= 0, chưa rõ discount có được bao gồm shipping. Error mapping RB-MG06 cũng cần phân biệt calculation với snapshot — Cần: Người 4/nhóm trưởng xác nhận policy và boundary; giữ nguyên code đang chờ — Từ ngày: 2026-09-18.
  - Catalog vẫn thiếu productName bắt buộc/được trả về, shopId và mapping VariantSnapshot — Cần: Người 3 bàn giao theo mục blocker snapshot/history dưới đây — Từ ngày: 2026-09-18.
- Test đã viết:
  - 7 test mới: 4 test có RED đúng nguyên nhân trước implementation, 3 test bổ sung coverage pass ngay. Lệnh và số liệu từng vòng nằm trong báo cáo.
  - Baseline mới: TV5 19/19 pass; typecheck/build pass; Vitest 64/64 pass; full npm test BLOCKED, không dùng kết quả cũ.
  - Gate cuối: Order 14/14, TV5 26/26, Vitest 12 files/64 tests pass; typecheck/build exit 0; lint exit 0 với 0 error/151 warning.
  - Full npm test vẫn BLOCKED; thử native fallback toàn suite được 73 pass/14 fail do import resolution, không phải kết quả runner chuẩn. Không tuyên bố hoàn thành full quality gate hoặc T1.

### 2026-09-18 — Order snapshot/history (cập nhật blocker)

- Đã làm:
  - Kiểm tra dependency của Order snapshot/history; task chưa hoàn thành, đang chờ Người 3. Chỉ ghi nhật ký, không triển khai các task phía sau.
- Quyết định kỹ thuật:
  - Dừng trước RED vì Catalog contract chưa đủ dữ liệu; không tạo code giả, không tự thêm field hoặc suy đoán cách ghép VariantSnapshot; giữ nguyên Schema Freeze.
- Contract/port thay đổi:
  - Không.
- Blocker phát sinh:
  - Order snapshot/history: `VariantPriceAndStockDTO.productName` trong `backend/src/modules/catalog/ports/catalog.port.ts` đang optional; `backend/src/modules/catalog/services/catalog-port.service.ts` chưa bảo đảm trả về field này — Cần: Người 3 bảo đảm tên sản phẩm bắt buộc trong contract và implementation trả đúng tên sản phẩm của variant — Từ ngày: 2026-09-18.
  - Order snapshot/history: DTO trả về của Catalog port phục vụ Order trong `backend/src/modules/catalog/ports/catalog.port.ts` chưa cung cấp `shopId` — Cần: Người 3 bổ sung nguồn `shopId: UUID` bắt buộc qua contract và implementation, xác định đúng shop sở hữu sản phẩm của variant — Từ ngày: 2026-09-18.
  - Order snapshot/history: đã có `variantName`/`variantValue` trong Catalog port nhưng chưa có quy tắc chính thức ánh xạ sang `VariantSnapshot` — Cần: Người 3 xác nhận định dạng, default variant, trường hợp null và xử lý giới hạn `VARCHAR(255)` theo Schema Freeze; Người 5 không tự suy đoán cách ghép — Từ ngày: 2026-09-18.
- Test đã viết:
  - Không: chưa viết test RED cho Order snapshot/history, chưa tạo snapshot builder và chưa chạy GREEN. Chưa chạy test mục tiêu, typecheck/build hoặc full backend test cho task này; kết quả quality gate ở các nhật ký trước không phải bằng chứng hoàn thành task.

### 2026-09-17

- Đã làm:
  - `backend/src/modules/order/domain/`: quyết định chuyển trạng thái thuần, quyền Buyer/Seller/Admin/integration, reason, bằng chứng Shipment, điều kiện xác nhận/hủy ngoại lệ; không mutate input.
  - `backend/src/modules/shipment/domain/`: 5 cạnh hợp lệ, terminal DELIVERED/FAILED và từ chối trạng thái ngoài miền.
  - `backend/src/modules/payment/domain/`: settle attempt PENDING sang SUCCESS/FAILED, amount dương và khớp toàn bộ Order, paid_at có timezone; retry tạo attempt mới, chặn Order đã có SUCCESS. Chưa có provider callback handler hoặc state machine Payment đầy đủ.
  - `backend/src/modules/checkout/contracts/`: command parser, result, idempotency port đề xuất; tài liệu endpoint tạo/hủy/transition/retry, transaction boundary 12 bước, error mapping và acceptance cases chưa chạy.
  - Chưa triển khai orchestration consumer/mock success đầy đủ vì port chưa đủ dữ liệu và chưa chốt transaction binding. Không tự thêm field/method vào port của người khác.
  - Không sửa migration, Schema Freeze, shared contracts, code owner khác; không commit/push.
- Quyết định kỹ thuật:
  - Domain service thuần; kết quả là decision/snapshot, caller phải tự bảo đảm transaction/history/audit. Không coi unit test là bằng chứng concurrency hoặc rollback thật.
  - So sánh amount Payment bằng bigint đơn vị cent, không dùng floating-point; giới hạn NUMERIC(15,2).
  - Dùng `node:test` và import `.ts` trong file mới; quality gate chuẩn dùng Node 22.20.0 và npm 11.12.1.
  - Shipment trả domain decision, chưa công bố mã lỗi HTTP mới. Callback FAILED -> SUCCESS của Payment và policy tổng Order bằng 0 còn chờ chốt; không tự thay luật.
  - Theo yêu cầu mới của người thực hiện: tiếp tục phần độc lập và ghi tiến độ/blocker thực tế dù gate scaffold chưa sẵn sàng. Không đánh dấu Done/checkbox vì chưa đạt quality gate.
- Contract/port thay đổi:
  - CheckoutCommand/CheckoutResult/IdempotencyPort và endpoint proposal — Trạng thái: Đề xuất — Ảnh hưởng: Người 1/2/3/4. Chi tiết: `backend/src/modules/checkout/contracts/checkout-contract.md`.
  - Không thay đổi ICatalogPort, ICartPort, IVoucherPort hoặc RequestContext chung.
- Blocker phát sinh/đã xác minh:
  - Người 1: còn API wiring/envelope/auth/Audit integration; scaffold, package, test discovery, typecheck và build hiện đã có.
  - Người 2: còn persistence binding và idempotency storage thật; migration, DB client, transaction helper và test DB cơ bản hiện đã tồn tại. Cần test PostgreSQL thật cho rollback/concurrency.
  - Người 3: chưa đủ ShopID/ProductName/Product status cho checkout; CatalogPortService dùng Map và lockVariant trừ kho ngay; cần chốt lock/decrement/transaction. Code salePrice/effectivePrice chưa có CR Approved tương ứng Schema Freeze trong repository.
  - Người 4: cần Cart/Voucher transaction binding, address ownership/snapshot và Notification transactional contract.
  - Cần chốt callback success đến muộn sau FAILED, chính sách Order.TotalAmount=0 nhưng Payment.Amount>0, nguồn shipping fee, mapping Shipment errors và endpoint đề xuất.
- Test đã viết và thực sự chạy:
  - QD11/QD12/QD13, RB-LTT08, RB-MG12 — Order unit: 6/6 pass; gồm ma trận 49 cặp trạng thái và guards.
  - RB-MG12, order-workflow-transactions §3 — Shipment unit: 2/2 pass; gồm ma trận 25 cặp và trạng thái ngoài miền.
  - RB-MG10/RB-MG12/RB-LTT06/RB-LB10/RB-LQH04 — Payment unit: 5/5 pass; gồm pending settlement, retry và runtime validation status/method.
  - api-conventions §2/§6, RB-LB07 — Checkout validation unit: 3/3 pass; key boundary, UUID, method, unknown field, voucher theo Shop.
  - TDD: test đầu mỗi module mới fail ERR_MODULE_NOT_FOUND, retry fail missing export; các lát cắt validation/guard tiếp theo fail vì thiếu hành vi, sau implementation chạy lại pass. Không skip test.
  - Focused Payment regression: 5 tests, 5 pass, 0 fail trên Node 22.20.0.
  - Backend full quality gate trên Node 22.20.0/npm 11.12.1: 201 tests pass, 12 Vitest files pass, typecheck pass, build pass; lint pass với 0 error và 151 warning hiện hữu.
  - Acceptance check chỉ đọc: 16 file mới không có trailing whitespace; tài liệu có 12 bước checkout và 5 mục dependency — pass. Đây là kiểm tra cấu trúc tài liệu, không thay runtime test.
  - `git diff --check` — exit 0; cảnh báo Git còn nguyên: `warning: in the working copy of 'docs/progress/nguoi-5-transaction.md', LF will be replaced by CRLF the next time Git touches it`. Chưa sửa cấu hình line ending chung.
  - Plan Approved: phản hồi rõ ràng “Plan Approved” trong cuộc trao đổi với người thực hiện; sau đó người thực hiện yêu cầu tiếp tục “hoàn tất tất cả công việc ... có thể làm ... ghi tiến độ”. Chưa có tham chiếu review Claude bên ngoài; không tuyên bố đã có.

### 2026-09-18

- Đã làm:
  - Bổ sung runtime validation cho cả `createPaymentRetry` và `settlePendingPayment`: chỉ nhận Payment status `PENDING/SUCCESS/FAILED` và method `COD/ONLINE`.
  - Bổ sung regression coverage cho attempt `CORRUPTED`, method `CARD` và settlement với method không hợp lệ; focused Payment suite đạt 5/5.
  - Tạo `backend/src/modules/order/domain/order-calculation.ts` và test `backend/test/modules/order/order-calculation.spec.ts`: tính LineTotal/Subtotal/Discount/Shipping/Total bằng bigint cents, giữ miền NUMERIC(15,2), reject quantity/money/discount không hợp lệ.
  - Order calculation focused suite đạt 3/3; full backend quality gates vẫn pass trên Node 22.20.0/npm 11.12.1.
  - Đồng bộ progress log với package/migration/quality gate hiện có; phân biệt rõ contract đã soạn thảo với contract đã khóa.
- Chưa làm vì dependency chưa đủ:
  - Không tự thêm field vào Cart/Catalog port hoặc tạo transaction adapter thay cho Người 2/3/4.
  - Chưa triển khai checkout orchestration success path, persistence/idempotency thật, provider callback, concurrency/rollback PostgreSQL test hoặc endpoint wiring.

## Contract đang sở hữu

| Tên | Trạng thái bàn giao | Version/ngày khóa | Người tiêu thụ |
|---|---|---|---|
| CheckoutCommand / CheckoutResult | Đề xuất, chưa khóa | Bản đề xuất 2026-09-17 | Người 1, Người 5 |
| IdempotencyPort | Đề xuất, chưa có storage adapter | Bản đề xuất 2026-09-17 | Người 1, Người 2, Người 5 |
| Endpoint checkout/cancel/transition/retry | Đề xuất trong checkout-contract.md | Bản đề xuất 2026-09-17 | Người 1 |

Chưa có contract nào được xác nhận bàn giao/khóa trong đợt này. Các checkbox dưới
giữ nguyên vì gate chưa đạt hoặc đầu việc tổng còn thiếu phần bị block.

## Việc còn lại trong mốc hiện tại

- [ ] Order snapshot/history — Chưa hoàn thành; chờ Người 3 từ 2026-09-18: productName bắt buộc và được trả về, shopId qua Catalog port, quy tắc mapping VariantSnapshot. Chưa viết test RED, chưa tạo snapshot builder, chưa chạy GREEN.
- [x] Xây domain service thuần cho ba state machine Order, Payment và Shipment.
- [x] Viết unit test cho mọi transition hợp lệ, transition bị cấm và terminal state.
- [x] Thiết kế checkout command/result, transaction boundary, danh sách bước checkout và idempotency interface.
- [x] Tính tiền Order thuần với decimal exact và validation NUMERIC(15,2).
- [x] Soạn thảo endpoint contract tạo Order, cancel, transition và retry Payment.
- [ ] Khóa endpoint contract sau khi Người 1 review và thống nhất.
- [ ] Dùng mock Catalog, Cart và Voucher port để kiểm thử orchestration contract.
- [ ] Sau khi Người 3 khóa Catalog port và Người 4 khóa Cart/Voucher port: ráp checkout orchestration với các port thật.
- [ ] Sau khi Người 2 hoàn thành migration và transaction helper: làm persistence, transaction integration và idempotency storage thật.
- [ ] Sau khi Người 1 hoàn thành scaffold, API envelope và `RequestContext`: wiring endpoint.
