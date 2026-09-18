# Thành viên 5 — Đối chiếu rules và TDD phần độc lập

Ngày: 2026-09-18. Branch: `dev`. Trạng thái: đã sửa các lỗi độc lập bên dưới; **chưa đạt full backend quality gate**, chưa Done T1.

## 1. Nguồn đã đọc và phạm vi

- `docs/architecture/backend-work-plan.md`: ownership, T1/T2/T3 và dependency.
- `docs/spec/00-original-spec.md`: quy trình mua/bán, tính toán §1.2.3, checkout/Order/Payment/Shipment §2.1, use case §3.4, dữ liệu/ràng buộc và transaction §5.
- `docs/spec/schema-freeze-v1.md`: đặc biệt Order, OrderItem, OrderStatusHistory, Payment, Shipment, QD/RB.
- Toàn bộ 9 file trong `docs/architecture/rules/`: `README.md`, `architecture-decisions.md`, `api-conventions.md`, `auth-rbac-rls.md`, `business-rules.md`, `db-schema-rules.md`, `error-observability.md`, `order-workflow-transactions.md`, `testing-quality-gates.md`.
- `docs/architecture/tech-stack.md`, `docs/progress/nguoi-5-transaction.md`; mẫu nhật ký trong `docs/progress/README.md` đã đọc ở lượt cập nhật blocker.
- Skill `tdd/SKILL.md`, `tests.md`, `mocking.md`. Không tìm thấy CONTEXT.md; AGENTS.md tìm thấy chỉ thuộc frontend, không áp dụng backend.
- Code/test liệt kê tại bảng §4, cùng các file `types.ts`/`errors.ts` của Order/Payment/Shipment và `checkout-result.ts`, `idempotency.port.ts`, `checkout-contract.md`.
- Đọc Catalog port/service chỉ để xác nhận blocker; đọc `backend/package.json`, `tsconfig.json`, `vitest.config.ts` để xác định lệnh và giới hạn runner.

Chỉ sửa domain/test TV5 và tài liệu TV5. Không triển khai snapshot builder, history, checkout orchestration, DB persistence; không sửa contract owner khác, Schema Freeze, config chung; không commit/push.

## 2. Kế hoạch theo phase và task kiểm tra độc lập

| Phase | Task | Tiêu chí kiểm tra | Kết quả |
|---|---|---|---|
| 1 | 1.1 Ghi branch/status và thay đổi có sẵn | Danh sách file trước khi sửa | Đã ghi §3 |
| 1 | 1.2 Xác định code/test TV5 | Mapping public interface → implementation/test | §4 |
| 1 | 1.3 Chạy baseline mới | Exit code và số test thực chạy | §3 |
| 2 | 2.1 Đối chiếu rules | Tách lỗi code, thiếu test, dependency, quyết định chưa khóa | §4 |
| 3 | 3.1 Quantity trong INTEGER | Test biên tối đa và vượt một đơn vị | RED → GREEN |
| 3 | 3.2 Actor Order không hợp lệ | Unknown actor không được xác nhận Order | RED → GREEN |
| 3 | 3.3 Ngày thanh toán hợp lệ | Ngày không tồn tại bị từ chối, leap year hợp lệ được nhận | RED → GREEN |
| 3 | 3.4 Timestamp UTC | Offset qua ngày được đổi đúng UTC; input không mutate | RED → GREEN |
| 3 | 3.5 Bổ sung coverage tiền | Zero/max, overflow subtotal/total, miền input | Pass ngay; không sửa code để tạo RED giả |
| 3 | 3.6 Rà soát refactor | Interface nhỏ, không mở rộng module hoặc trừu tượng hóa không cần thiết | Không cần refactor thêm |
| 4 | 4.1 Order và regression TV5 | Không fail/skip | 14/14 và 26/26 |
| 4 | 4.2 Full backend test | Runner chuẩn hoàn tất cả hai suite | BLOCKED bởi tsx/OS |
| 4 | 4.3 Typecheck/build/lint | Exit 0 | Pass; lint có 151 warning |
| 5 | 5.1 Báo cáo và nhật ký | Ghi lệnh, RED/GREEN, blocker, phạm vi hoàn thành | Tài liệu này và nhật ký TV5 |

Seam đã được người dùng chỉ định: `calculateOrderTotals`, `transitionOrder`, `settlePendingPayment`, `createPaymentRetry`, `transitionShipment`, `parseCheckoutCommand`. Test chỉ quan sát kết quả/lỗi public, không mock private collaborator. Các domain function không chứng minh transaction/DB atomicity.

## 3. Baseline mới và bảo toàn working tree

Node `22.20.0`, npm `11.12.1`; không đổi branch. Trước lượt này đã có:

| Git status | File |
|---|---|
| M | `backend/src/modules/payment/domain/payment-state-machine.ts` |
| M | `backend/test/modules/payment/payment-state-machine.spec.ts` |
| M | `docs/progress/nguoi-5-transaction.md` |
| ?? | `backend/src/modules/order/domain/order-calculation.ts` |
| ?? | `backend/test/modules/order/order-calculation.spec.ts` |

Đã đọc diff và ghi nhận hash trước khi sửa. Giữ runtime validation Payment, calculation, test và nhật ký có sẵn; chỉ bổ sung bản vá. Không reset/checkout/revert/stash, không stage.

Baseline thực chạy trong lượt này:

- Regression TV5 trực tiếp Node: **19 pass, 0 fail, 0 skip** (Order 9, Payment 5, Shipment 2, Checkout 3).
- `npm.cmd --logs-max=0 run typecheck`: exit 0.
- `npm.cmd --logs-max=0 run build`: exit 0.
- `npm.cmd --logs-max=0 test`: exit 1 trước khi test được chạy. `tsx` gọi `node:os.userInfo`, lỗi `uv_os_get_passwd returned ENOMEM`; chạy lại tuần tự vẫn cùng lỗi. Không có số test pass/fail hợp lệ cho lệnh này.
- Chạy Vitest riêng: **12 file / 64 tests pass, 0 fail**. Đây là một phần của full backend test, không thay thế native suite.

## 4. Bảng đối chiếu rule / implementation / test

Đường dẫn viết tắt: implementation dưới `backend/src/modules/`; test dưới `backend/test/modules/`. “Đủ” chỉ trong seam thuần được kiểm tra, không có nghĩa rule đã được enforce xuyên suốt API/DB.

| Rule | Implementation | Test | Trạng thái ban đầu → hiện tại | Phân loại / hành động |
|---|---|---|---|---|
| QD10, RB-LTT01/02, RB-LQH01/02: công thức tiền exact | `order/domain/order-calculation.ts` | `order/order-calculation.spec.ts` | Đủ phép tính; thiếu test biên → đã bổ sung | Zero/max, overflow subtotal/total, không dùng floating point |
| RB-MG06: quantity INTEGER >= 1 | `order/domain/order-calculation.ts` | `order/order-calculation.spec.ts` | Sai → đã sửa | Chặn 2147483648; nhận 2147483647 |
| RB-MG06/07: unit price > 0, tiền không âm, NUMERIC(15,2) | `order/domain/order-calculation.ts` | `order/order-calculation.spec.ts` | Có validation; thiếu coverage từng input → đã bổ sung | Negative/zero price, fraction quantity, NaN/Infinity, exponent, scale, overflow |
| QD11: 8 cạnh Order, terminal không chuyển tiếp | `order/domain/order-state-machine.ts` | `order/order-state-machine.spec.ts` | Đủ domain | Giữ ma trận 49 cặp; không đổi state machine |
| QD12: Buyer chỉ hủy pending và đúng owner | `order/domain/order-state-machine.ts` | `order/order-state-machine.spec.ts` | Đủ các ca domain hiện có | Giữ positive/negative ownership và trạng thái |
| QD13/RB-LQH07, workflow §2: actor/Shop được phép | `order/domain/order-state-machine.ts` | `order/order-state-machine.spec.ts` | Sai với actor unknown → đã sửa | Trước đây actor lạ lọt qua nhánh quyền; nay RESOURCE_FORBIDDEN |
| RB-LTT08, workflow §2/8: reason và evidence | `order/domain/order-state-machine.ts` | `order/order-state-machine.spec.ts` | Đủ domain | Trim reason, confirmation eligibility, exceptional cancellation, Shipment evidence |
| RB-MG12: Order status | `order/domain/order-state-machine.ts` | `order/order-state-machine.spec.ts` | Đủ domain | Giữ reject unknown/null/prototype names |
| RB-MG12, workflow §3: Shipment 5 cạnh/terminal | `shipment/domain/shipment-state-machine.ts` | `shipment/shipment-state-machine.spec.ts` | Đủ domain | Ma trận 25 cặp và invalid status; không sửa |
| RB-MG10/RB-LQH04: Payment dương, bằng toàn bộ Order | `payment/domain/payment-state-machine.ts` | `payment/payment-state-machine.spec.ts` | Đủ kiểm tra amount của domain hiện có | Giữ bigint cents, positive/mismatch/decimal validation |
| RB-MG12: Payment status/method | `payment/domain/payment-state-machine.ts` | `payment/payment-state-machine.spec.ts` | Đủ các ca runtime hiện có | Bảo toàn validation đã có trước lượt này |
| RB-LTT06, API §2: PaidAt là thời điểm hợp lệ | `payment/domain/payment-state-machine.ts` | `payment/payment-state-machine.spec.ts` | Sai → đã sửa | Date.parse tự rollover ngày không tồn tại; thêm kiểm tra lịch |
| API §2, architecture-decisions §6: chuẩn hóa UTC | `payment/domain/payment-state-machine.ts` | `payment/payment-state-machine.spec.ts` | Sai → đã sửa | toISOString sau validation, giữ input bất biến |
| Workflow §7: retry ID mới/PENDING, không retry Order đã paid | `payment/domain/payment-state-machine.ts` | `payment/payment-state-machine.spec.ts` | Đủ decision thuần | Chống hai SUCCESS đồng thời vẫn thiếu integration/DB |
| API §2/6: key 16–128, UUID, method, unknown field | `checkout/contracts/checkout-command.ts` | `checkout/checkout-command.spec.ts` | Đủ validation hiện có | Giữ test giá client/Buyer ID không được nhận, duplicate voucher per shop |
| QD08: snapshot bất biến | Chưa có builder | Chưa có snapshot test | Thiếu, BLOCKED | TV3: productName, shopId, mapping VariantSnapshot; không triển khai |
| QD07/09, RB-LQH03/06: stock/voucher/atomic checkout | Chưa có orchestration | Chưa có test checkout transaction | Thiếu, dependency và ngoài phạm vi | TV2/3/4 bàn giao adapter/transaction; không mock thêm field để né blocker |
| QD11/20: history/audit cùng transaction; hủy hoàn tồn một lần | Chỉ có transition decision | Unit không chứng minh atomicity | Thiếu, ngoài phạm vi | Không triển khai history/persistence lượt này |
| RB-LB07/08/10; API idempotency replay | Parser/retry/port đề xuất mới bao phủ một phần | Chưa có concurrency/replay test thật | Thiếu, dependency | Storage/transaction binding, callback và orchestration còn chờ |
| QD18: từ chối card data và redaction | Chưa có Payment request handler thuộc TV5 | Chưa có test handler TV5 | Thiếu, ngoài phạm vi | Phối hợp API/logging TV1; không dùng domain unit để tuyên bố QD18 hoàn tất |
| QD19/RB-LQH08: reporting completed | Chưa có reporting | Chưa có | Thiếu, ngoài phạm vi | Không mở task mới |
| Discount <= subtotal | `order/domain/order-calculation.ts` | Test hiện có chỉ chứng minh tổng âm bị chặn | Chưa được tài liệu khóa rõ | Giữ code; cần TV4/nhóm trưởng xác nhận có được giảm vào shipping không |
| RB-MG06 error mapping ở calculation | Calculation trả ORDER_TOTAL_INVALID; rules ghi ORDER_SNAPSHOT_INVALID cho OrderItem | Test calculation theo code hiện có | Cần làm rõ boundary | Chưa có snapshot builder; không tự đổi mapping của phép tính thành lỗi snapshot 500 |
| Order total = 0 vs Payment amount > 0; callback success sau FAILED | Calculation/Payment enforce miền riêng | Chưa có checkout/callback policy test | Chưa khóa quyết định | Chờ nhóm trưởng/owner xác nhận; không tự mở transition hoặc payment policy |

Các rule identity/catalog/buyer, FK/UNIQUE/RLS và HTTP envelope nằm ở owner/boundary khác không được sửa ở lượt này. Việc suite DB có pass không chứng minh checkout TV5 đã tích hợp.

## 5. Bằng chứng TDD và regression

Các lệnh chạy từ `backend/`, dùng Node trực tiếp do tsx baseline bị lỗi:

| Slice | Lệnh RED | Bằng chứng RED | GREEN / regression |
|---|---|---|---|
| Quantity INTEGER | `node --experimental-strip-types --test --test-name-pattern='Quantity fits' test/modules/order/order-calculation.spec.ts` | Exit 1, 0 pass/1 fail: Missing expected exception | Thêm upper bound; Order 10/10 pass |
| Actor unknown | `node --experimental-strip-types --test --test-name-pattern='unknown runtime actor' test/modules/order/order-state-machine.spec.ts` | Exit 1, 0 pass/1 fail: Missing expected exception | Chỉ nhánh ADMIN được đi tiếp sau các actor đã xử lý; Order 11/11 pass |
| Ngày không tồn tại | `node --experimental-strip-types --test --test-name-pattern='impossible calendar' test/modules/payment/payment-state-machine.spec.ts` | Exit 1, 0 pass/1 fail: Missing expected exception | Validate số ngày theo tháng/leap year; Payment 6/6 pass |
| UTC | `node --experimental-strip-types --test --test-name-pattern='normalizes paidAt' test/modules/payment/payment-state-machine.spec.ts` | Exit 1, 0 pass/1 fail: giữ +07:00 thay vì UTC mong đợi | Chuẩn hóa UTC; regression TV5 23/23 pass |

Sau đó bổ sung 3 test coverage calculation: zero/max total; subtotal/final overflow; invalid money/quantity domains. Calculation 7/7 pass ngay, không tạo RED giả hoặc sửa implementation đúng. Không có refactor riêng vì chưa có lặp cần loại bỏ; interface public không mở rộng. Quality gate sau cùng chạy trên code cuối.

## 6. Quality gate cuối

Mọi lệnh dưới chạy từ `backend/` bằng Node/npm chuẩn nêu trên:

| Lệnh | Kết quả thực tế |
|---|---|
| `node --experimental-strip-types --test test/modules/order/*.spec.ts` | Exit 0; 14 pass, 0 fail, 0 skip |
| `node --experimental-strip-types --test test/modules/order/*.spec.ts test/modules/payment/*.spec.ts test/modules/shipment/*.spec.ts test/modules/checkout/*.spec.ts` | Exit 0; 26 pass, 0 fail, 0 skip (Order 14, Payment 7, Shipment 2, Checkout 3) |
| `npm.cmd --logs-max=0 test` | Exit 1; tsx/OS ENOMEM trước khi test chạy; full gate BLOCKED |
| `npm.cmd --logs-max=0 run test:vitest` | Exit 0; 12 files, 64 pass, 0 fail |
| `npm.cmd --logs-max=0 run typecheck` | Exit 0 |
| `npm.cmd --logs-max=0 run build` | Exit 0; build app hiện tại, không phải bằng chứng endpoint Order đã wiring |
| `npm.cmd --logs-max=0 run lint` | Exit 0; 0 error, 151 warning |

Thử fallback toàn native suite bằng `node --experimental-strip-types --test "test/**/*.spec.ts" "tests/modules/buyer/*.test.ts"`: exit 1, 73 pass/14 fail, 0 skip; lỗi resolve import không có extension tại các file không dùng trực tiếp được với native strip-types. Đây không phải kết quả full runner chuẩn, không sửa imports/config của owner khác để né lỗi. Không cộng các lượt chạy chồng lặp thành một tổng test.

## 7. File thay đổi trong lượt này

- `backend/src/modules/order/domain/order-calculation.ts`: giới hạn quantity theo INTEGER; file đã tồn tại untracked trước lượt này.
- `backend/test/modules/order/order-calculation.spec.ts`: 4 test mới; file đã tồn tại untracked trước lượt này.
- `backend/src/modules/order/domain/order-state-machine.ts`: reject unknown actor.
- `backend/test/modules/order/order-state-machine.spec.ts`: 1 regression test mới.
- `backend/src/modules/payment/domain/payment-state-machine.ts`: calendar validation và UTC, giữ nguyên runtime validation có sẵn.
- `backend/test/modules/payment/payment-state-machine.spec.ts`: 2 regression tests mới, giữ nguyên test có sẵn.
- `docs/progress/nguoi-5-order-rules-audit.md`: báo cáo mới này.
- `docs/progress/nguoi-5-transaction.md`: cập nhật trạng thái và nhật ký; giữ lịch sử.

## 8. Blocker và mức hoàn thành

- **Catalog / TV3:** productName bắt buộc và implementation trả về; shopId qua port; mapping variantName/variantValue → VariantSnapshot chưa bàn giao. Snapshot/history vẫn chưa hoàn thành; không có test RED/builder/GREEN cho snapshot.
- **Tooling / TV1 hoặc môi trường chạy:** cần khắc phục `uv_os_get_passwd returned ENOMEM` khi tsx khởi động, rồi chạy lại `npm test` đúng runner. Không sửa cấu hình hoặc dependency của TV1.
- **Policy / TV4 và nhóm trưởng:** xác nhận giới hạn discount đối với subtotal/shipping; policy total=0; callback success tới muộn sau FAILED; phân biệt error mapping calculation với snapshot. Giữ nguyên hành vi chưa được chốt.
- **Tích hợp / TV1/2/3/4:** API, storage/idempotency, transaction adapters và persistence còn thiếu; không xử lý trong lượt này.

Đã hoàn thành phần sửa 4 hành vi độc lập và bổ sung 3 test coverage, chạy kiểm tra domain/typecheck/build/lint. Order/Shipment decisions, Payment pending/retry, calculation, checkout validation có code/test; contract checkout/idempotency vẫn là đề xuất. Chưa hoàn thành full quality gate, T1, snapshot/history, orchestration, persistence, callbacks, reporting hoặc E2E.
