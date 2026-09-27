# T3 — Người 5: PostgreSQL transaction regression gate

Ngày cập nhật: 2026-09-27.

## Phạm vi sửa

| Mục | Thay đổi | Bằng chứng hồi quy |
|---|---|---|
| T3-P5-01 | `cancelOrder()` khóa Order, OrderItems và các variant theo thứ tự UUID; hoàn kho, đổi status và ghi history bằng cùng client trong `withTransaction`. | Bốn request hủy đồng thời chỉ một request thành công; retry không hoàn kho lần hai; lỗi ghi history rollback cả status và stock. |
| T3-P5-02 | `retryPayment()` khóa Order trước, rồi khóa Payment; kiểm tra ownership, trạng thái và method trước khi insert attempt mới. | Từ chối terminal Order, Payment SUCCESS/PENDING và method sai; ba retry đồng thời chỉ tạo một PENDING; chờ lock rồi đọc lại cancellation/payment success vừa commit. |
| T3-P5-03 | `confirmOrder()` và `transitionOrder()` dùng cùng helper ghi status/history trong transaction, có khóa Order và expected-state check. Nhánh transition sang CANCELLED cũng hoàn kho. | Confirm ghi đúng history; confirm/transition đồng thời không ghi trùng; lỗi history rollback. |
| T3-P5-04 | Thêm `backend/tests/db/pg-checkout.integration.test.ts`, gọi `PgCheckoutService` thật trên PostgreSQL đa kết nối. | Overselling, duplicate key/replay/conflict, rollback từng bước, checkout hai shop/voucher, deadlock thật, serialization và retry exhaustion. |

Quy tắc retry: Order không ở `CANCELLED`, `COMPLETED`, `DELIVERY_FAILED`; phải có attempt cũ, không có SUCCESS hoặc PENDING. SUCCESS trả `PAYMENT_ALREADY_COMPLETED`; các trạng thái không cho retry trả `PAYMENT_STATE_INVALID`. Attempt FAILED được giữ nguyên và attempt mới lấy toàn bộ `Order.total_amount` từ DB.

Voucher không tự hoàn lượt khi hủy, theo policy MVP hiện hành.

## Chạy release gate

Tại thư mục `backend`:

```sh
npm run test:transaction:pg
```

Windows PowerShell chặn npm.ps1 có thể dùng `npm.cmd run test:transaction:pg`.

Runner bắt buộc `RUN_REMOTE_DB_TESTS=true`, nên thiếu cấu hình/kết nối DB sẽ fail thay vì pass do skip. Cần `SUPABASE_URL`, `DATABASE_URL`, `DIRECT_URL` như cấu hình DB hiện hành. CI hiện có PostgreSQL 17.6 và chạy toàn bộ Vitest với `RUN_REMOTE_DB_TESTS=true`, tự bao gồm file test mới.

Suite tạo schema UUID riêng, dùng DDL/index/constraint từ migration thật, chỉ chuyển FK `auth.users` sang bảng fixture trong schema đó. Suite không sửa bảng public hoặc tài khoản auth; cleanup drop đúng schema được tạo. Cần quyền tạo schema/table/function/trigger và quan sát lock của các session test. `search_path` chỉ chứa schema test để tránh fallback sang public.

## Phân biệt các bằng chứng concurrency

- Overselling/idempotency chạy service thật qua pool tối đa tám kết nối; không dùng mutex giả lập tồn kho hay repository in-memory.
- Deadlock thật: checkout giữ variant rồi chờ bảng probe; kết nối thứ hai giữ probe rồi chờ variant. PostgreSQL phát sinh `40P01`; vòng retry thật của service rollback rồi tạo đúng một Order/Payment/history.
- Serialization thật: dùng `runConcurrentTransactions` của Người 2 với hai transaction `SERIALIZABLE` cùng đọc rồi cập nhật variant; một transaction nhận `40001`.
- Retry serialization của service: trigger PostgreSQL phát `40001` sau khi đã ghi Payment, kiểm tra rollback và giới hạn ba attempts/backoff 25–50 ms. Đây là fault injection tại DB; không gọi nhầm nó là xung đột serialization tự nhiên, vì checkout production dùng `READ COMMITTED`.
- Chỉ thay hàm sleep để ghi nhận backoff; không mock vòng retry, transaction helper, query hoặc repository.
- Lỗi sau từng thao tác ghi Order, stock, OrderItem, CartItem, history, Payment, Notification, voucher và idempotency được gây bằng trigger trong schema test. Sau rollback, cùng idempotency key phải dùng lại được.

## Bằng chứng trước sửa

Lần chạy đầu trên PostgreSQL 17.6: **12 failed / 10 passed**. Test xác nhận stock không được hoàn, status vẫn đổi khi history lỗi, confirm thiếu history, transition trùng và retry tạo PENDING trên terminal Order hoặc khi đã có SUCCESS/PENDING.

Các test in-memory/E2E cũ vẫn hữu ích cho domain/API, nhưng không được dùng riêng để kết luận đã kiểm chứng lock/ACID trên PostgreSQL.

## Kiểm tra bổ sung

- Gate cuối `npm run test:transaction:pg -- --reporter=verbose`: **32/32 pass, 0 skipped**, PostgreSQL 17.6, 401.89 giây. Bốn finding T3-P5-01/02/03/04 đã hoàn tất trong phạm vi nêu trên.
- Typecheck và build: pass.
- Lint backend: 0 error, 219 warning tồn tại ngoài các file sửa; lint riêng service/test/runner mới: 0 error, 0 warning.
- Toàn bộ 533 test Node: pass, không skip. `tsx` trên môi trường Windows hiện tại lỗi `uv_os_get_passwd ENOMEM` trước khi chạy test; lần xác minh này dùng esbuild có sẵn để biên dịch chính 65 file test (giữ dependencies external), rồi chạy bằng `node --test --test-concurrency=2`. Không sửa test assertion hoặc dependency để né lỗi.
- Vitest ngoài suite mới, với `RUN_REMOTE_DB_TESTS=false`: 89 pass, 59 integration test khác được skip theo cấu hình. Đây không phải kết quả chạy toàn bộ remote DB suite.

Phạm vi xác nhận là bốn finding T3-P5 và các regression test đã chạy; không phải cam kết toàn bộ hệ thống không còn lỗi.
