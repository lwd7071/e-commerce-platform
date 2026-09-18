# Nhật ký tiến độ — Người 5 (Transaction core)

## Trạng thái hiện tại

- Mốc: T1
- Cập nhật lần cuối: 2026-09-18
- Đang làm: Đã hoàn thành toàn bộ phần Domain thuần độc lập của mốc T1 (3 state machine, Order calculation, checkout command validation, CheckoutOrchestrator 12 bước với 13 tests mock port và boundary tests). TV5 suite 41/41 pass; full backend 229/229 pass; typecheck 0 lỗi; build pass.
- Bị block bởi: Order snapshot/history chờ Người 3 bảo đảm productName, cung cấp shopId và xác nhận mapping VariantSnapshot từ ngày 2026-09-18. Các dependency tích hợp T1 còn lại: transaction/DB persistence và idempotency storage của Người 2; transaction-compatible Cart/Voucher/Catalog adapters thật của Người 3/4; API wiring/envelope/auth integration của Người 1.

## Nhật ký theo ngày

### 2026-09-18 — Negative Test Orchestration & Domain Boundary Hardening

- Bổ sung 5 negative tests cho `executeCheckout` (`checkout-orchestration.spec.ts`):
  1. Idempotency `in_progress` -> reject `REQUEST_IN_PROGRESS`, không gọi downstream port.
  2. Voucher evaluation bị từ chối -> dừng flow, không trừ kho, không xóa giỏ hàng.
  3. Catalog downstream lỗi (vd DB error) -> propagate lỗi, cô lập giỏ hàng không bị xóa.
  4. Khóa tồn thất bại (lock timeout/fail) -> voucher không bị tiêu thụ, giỏ hàng không bị xóa.
  5. Idempotency replay -> trả ngay cached result mà không gọi lại Cart, Catalog, Voucher.
- Bổ sung 2 tests biên cho `calculateOrderTotals` (`order-calculation.spec.ts`): tiền lẻ 0.01 cent chính xác, chặn các chuỗi số dị dạng (`1.0.0`, `1.00 `, `..01`).
- Đồng bộ `checkout-contract.md`: phân định rõ ranh giới Domain thuần (đã xong) và Persistence/API wiring (chờ phối hợp).
- Quality gate Node v22.20.0, npm 11.12.1: TV5 41/41 pass; full backend 229/229 pass; typecheck 0 lỗi; build pass; lint 0 error.

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
- Blocker xác minh: Người 1 (API wiring), Người 2 (persistence/idempotency), Người 3 (ShopID/ProductName), Người 4 (Cart/Voucher binding).

## Contract đang sở hữu

| Tên | Trạng thái bàn giao | Version/ngày khóa | Người tiêu thụ |
|---|---|---|---|
| CheckoutCommand / CheckoutResult | Đề xuất, chưa khóa | Bản cập nhật 2026-09-18 | Người 1, Người 5 |
| IdempotencyPort | Đề xuất, đã có interface & mock | Bản cập nhật 2026-09-18 | Người 1, Người 2, Người 5 |
| Endpoint checkout/cancel/transition/retry | Đề xuất trong checkout-contract.md | Bản cập nhật 2026-09-18 | Người 1 |

Chưa có contract nào được xác nhận bàn giao/khóa trong đợt này do cần phối hợp với Người 1 và Người 2.

## Việc còn lại trong mốc hiện tại

### 2026-09-18 — idempotency advisory-lock seam

- Đã thêm `PgIdempotencyRepository` transaction-scoped: advisory lock dùng canonical
  `JSON.stringify(["v1", user_id, endpoint, idempotency_key])`, sau đó lookup composite
  primary key; hash collision chỉ serialize, không tạo replay sai.
- Đã bỏ việc tính fingerprint từ raw body ở seam mới: `canonicalCheckoutFingerprint` nhận
  command đã parse, sort voucher theo `shop_id`/`code`, trim code và SHA-256 lowercase.
- Retry/persistence orchestration vẫn cần gắn vào checkout transaction handler ở slice kế tiếp;
  chưa tự mở `BEGIN/COMMIT` trong repository.
- TDD: canonical fingerprint permutation test pass; typecheck pass.

- [ ] Order snapshot/history — Chưa hoàn thành; chờ Người 3 từ 2026-09-18: productName bắt buộc và được trả về, shopId qua Catalog port, quy tắc mapping VariantSnapshot. Chưa viết test RED, chưa tạo snapshot builder, chưa chạy GREEN.
- [x] Xây domain service thuần cho ba state machine Order, Payment và Shipment.
- [x] Viết unit test cho mọi transition hợp lệ, transition bị cấm và terminal state.
- [x] Thiết kế checkout command/result, transaction boundary, danh sách bước checkout và idempotency interface.
- [x] Tính tiền Order thuần với decimal exact và validation NUMERIC(15,2).
- [x] Soạn thảo endpoint contract tạo Order, cancel, transition và retry Payment.
- [ ] Khóa endpoint contract sau khi Người 1 review và thống nhất.
- [x] Dùng mock Catalog, Cart và Voucher port để kiểm thử orchestration contract (13 tests positive & negative).
- [ ] Sau khi Người 3 khóa Catalog port và Người 4 khóa Cart/Voucher port: ráp checkout orchestration với các port thật.
- [ ] Sau khi Người 2 hoàn thành migration và transaction helper: làm persistence, transaction integration và idempotency storage thật.
- [ ] Sau khi Người 1 hoàn thành scaffold, API envelope và `RequestContext`: wiring endpoint.

---

## Phụ lục A — Đối chiếu Rules & TDD (2026-09-18)

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
| QD08: Order snapshot bất biến | — | — | Thiếu, **blocked** Người 3 |
| QD11/20: history/audit cùng transaction | — | — | Thiếu, ngoài phạm vi (chờ Người 2) |
| Idempotency storage thật | — | — | Thiếu, chờ Người 2 |

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

