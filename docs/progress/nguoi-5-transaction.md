# Nhật ký tiến độ — Người 5 (Transaction core)

## Trạng thái hiện tại

- Mốc: T1
- Cập nhật lần cuối: 2026-09-17
- Đang làm: Đã có Order/Shipment thuần, Payment pending/retry và checkout contract đề xuất; 15/15 unit tests pass. Chưa đạt quality gate, chưa Done T1.
- Bị block bởi: Người 1 — scaffold/lint/typecheck/build; Người 2 — transaction/DB; Người 3/4 — dữ liệu và transaction port cho orchestration; các chính sách Payment/checkout còn chưa khóa (chi tiết dưới).

## Nhật ký theo ngày

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
  - Dùng `node:test` và import `.ts` trong file mới để chạy trực tiếp Node v24.20.0; không sửa cấu hình do Người 1 sở hữu.
  - Shipment trả domain decision, chưa công bố mã lỗi HTTP mới. Callback FAILED -> SUCCESS của Payment và policy tổng Order bằng 0 còn chờ chốt; không tự thay luật.
  - Theo yêu cầu mới của người thực hiện: tiếp tục phần độc lập và ghi tiến độ/blocker thực tế dù gate scaffold chưa sẵn sàng. Không đánh dấu Done/checkbox vì chưa đạt quality gate.
- Contract/port thay đổi:
  - CheckoutCommand/CheckoutResult/IdempotencyPort và endpoint proposal — Trạng thái: Đề xuất — Ảnh hưởng: Người 1/2/3/4. Chi tiết: `backend/src/modules/checkout/contracts/checkout-contract.md`.
  - Không thay đổi ICatalogPort, ICartPort, IVoucherPort hoặc RequestContext chung.
- Blocker phát sinh/đã xác minh:
  - Người 1: thiếu `backend/package.json`, lint/typecheck/build/test discovery và RequestContext/envelope/auth/Audit integration — ghi nhận 2026-09-17.
  - Người 2: thiếu migrations, DB client, transaction helper, test DB và idempotency storage — cần test PostgreSQL thật cho rollback/concurrency.
  - Người 3: chưa đủ ShopID/ProductName/Product status cho checkout; CatalogPortService dùng Map và lockVariant trừ kho ngay; cần chốt lock/decrement/transaction. Code salePrice/effectivePrice chưa có CR Approved tương ứng Schema Freeze trong repository.
  - Người 4: cần Cart/Voucher transaction binding, address ownership/snapshot và Notification transactional contract.
  - Cần chốt callback success đến muộn sau FAILED, chính sách Order.TotalAmount=0 nhưng Payment.Amount>0, nguồn shipping fee, mapping Shipment errors và endpoint đề xuất.
- Test đã viết và thực sự chạy:
  - QD11/QD12/QD13, RB-LTT08, RB-MG12 — Order unit: 6/6 pass; gồm ma trận 49 cặp trạng thái và guards.
  - RB-MG12, order-workflow-transactions §3 — Shipment unit: 2/2 pass; gồm ma trận 25 cặp và trạng thái ngoài miền.
  - RB-MG10/RB-MG12/RB-LTT06/RB-LB10/RB-LQH04 — Payment unit: 4/4 pass; chỉ pending settlement và retry.
  - api-conventions §2/§6, RB-LB07 — Checkout validation unit: 3/3 pass; key boundary, UUID, method, unknown field, voucher theo Shop.
  - TDD: test đầu mỗi module mới fail ERR_MODULE_NOT_FOUND, retry fail missing export; các lát cắt validation/guard tiếp theo fail vì thiếu hành vi, sau implementation chạy lại pass. Không skip test.
  - Lệnh tổng: `node --test backend/test/modules/order/order-state-machine.spec.ts backend/test/modules/shipment/shipment-state-machine.spec.ts backend/test/modules/payment/payment-state-machine.spec.ts backend/test/modules/checkout/checkout-command.spec.ts` — exit 0; 15 tests, 15 pass, 0 fail, 0 skipped.
  - `npm.cmd --logs-max=0 --prefix backend run lint`, `npm.cmd --logs-max=0 --prefix backend run typecheck`, `npm.cmd --logs-max=0 --prefix backend run build` — cả ba exit 1; BLOCKED, chưa chạy được công cụ kiểm tra vì không có package.json. Không gọi đây là lỗi lint/type của code.
  - Output lỗi chung nguyên văn: `npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open 'D:\UTE\Nam_3_2026_2027_1\nam3\CNPM\e-commerce-platform\backend\package.json'`.
  - Acceptance check chỉ đọc: 16 file mới không có trailing whitespace; tài liệu có 12 bước checkout và 5 mục dependency — pass. Đây là kiểm tra cấu trúc tài liệu, không thay runtime test.
  - `git diff --check` — exit 0; cảnh báo Git còn nguyên: `warning: in the working copy of 'docs/progress/nguoi-5-transaction.md', LF will be replaced by CRLF the next time Git touches it`. Chưa sửa cấu hình line ending chung.
  - Plan Approved: phản hồi rõ ràng “Plan Approved” trong cuộc trao đổi với người thực hiện; sau đó người thực hiện yêu cầu tiếp tục “hoàn tất tất cả công việc ... có thể làm ... ghi tiến độ”. Chưa có tham chiếu review Claude bên ngoài; không tuyên bố đã có.

## Contract đang sở hữu

| Tên | Trạng thái bàn giao | Version/ngày khóa | Người tiêu thụ |
|---|---|---|---|
| CheckoutCommand / CheckoutResult | Đề xuất, chưa khóa | Bản đề xuất 2026-09-17 | Người 1, Người 5 |
| IdempotencyPort | Đề xuất, chưa có storage adapter | Bản đề xuất 2026-09-17 | Người 1, Người 2, Người 5 |
| Endpoint checkout/cancel/transition/retry | Đề xuất trong checkout-contract.md | Bản đề xuất 2026-09-17 | Người 1 |

Chưa có contract nào được xác nhận bàn giao/khóa trong đợt này. Các checkbox dưới
giữ nguyên vì gate chưa đạt hoặc đầu việc tổng còn thiếu phần bị block.

## Việc còn lại trong mốc hiện tại

- [ ] Xây domain service thuần cho ba state machine Order, Payment và Shipment.
- [ ] Viết unit test cho mọi transition hợp lệ, transition bị cấm và terminal state.
- [ ] Thiết kế checkout command/result, transaction boundary, danh sách bước checkout và idempotency interface.
- [ ] Khóa endpoint contract tạo Order, cancel, transition và retry Payment.
- [ ] Dùng mock Catalog, Cart và Voucher port để kiểm thử orchestration contract.
- [ ] Sau khi Người 3 khóa Catalog port và Người 4 khóa Cart/Voucher port: ráp checkout orchestration với các port thật.
- [ ] Sau khi Người 2 hoàn thành migration và transaction helper: làm persistence, transaction integration và idempotency storage thật.
- [ ] Sau khi Người 1 hoàn thành scaffold, API envelope và `RequestContext`: wiring endpoint.
