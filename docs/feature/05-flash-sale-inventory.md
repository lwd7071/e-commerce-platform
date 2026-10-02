# Báo cáo: Flash Sale & Chống bán vượt tồn (High Concurrency Inventory)

## Owner và trạng thái

- Owner: Thành viên phụ trách Feature 05
- Người phối hợp: Không
- Trạng thái: Hoàn thành
- Cập nhật lần cuối: 2026-10-02
- Nhánh / PR / commit: `feat/flash-sale-concurrency`

## Mục tiêu và phạm vi

- Mục tiêu: Xử lý bài toán cao tải (High Concurrency) khi mở bán Flash Sale theo khung giờ (09:00, 12:00, 20:00). Ngăn chặn 100% hiện tượng bán vượt tồn kho (Overselling), giải quyết tranh chấp voucher đồng thời (Voucher Race Condition), đảm bảo tính lũy thừa (Idempotency) khi client retry và tự động khôi phục dữ liệu nếu server crash đột ngột (Self-healing Zero Stock Leak).
- Trong phạm vi:
  - Quản lý khung giờ Flash Sale (`flash_sale_sessions`) và sản phẩm mở bán (`flash_sale_items`).
  - Cache Warm-up nạp tồn kho và voucher quota lên Upstash Redis cluster trước giờ mở bán.
  - Lua Script nguyên tử 1 round-trip (`flash-sale-deduct.lua`): Kiểm tra trạng thái slot, giới hạn mua của user, tranh chấp voucher quota/used, trừ tồn kho và ghi nhận watchdog lease.
  - Kiến trúc phòng thủ 3 tầng: Fast-path Redis ➡️ PostgreSQL ACID Transaction (Single Source of Truth) ➡️ Post-commit Safe Cleanup (Đúng thứ tự tháo phao an toàn).
  - Compensating Lua Script (`flash-sale-compensate.lua`) với Whitelist guard (`if lease ~= "HOLD"`) chống hoàn đúp.
  - Watchdog Engine tự chữa lành: Cross-check PostgreSQL trước khi hoàn stock; tự động khôi phục Idempotency Replay Cache nếu server sập nguồn sau commit.
  - Job Đối Soát (Reconciliation): Đo lường độ lệch giữa Redis và Database, tự động cân bằng với `flash_sale_compensation_logs`.
- Ngoài phạm vi: Tích hợp cổng thanh toán trực tiếp của ngân hàng (Payout/Refund cổng thẻ quốc tế) trong khuôn khổ MVP.

## Đã thực hiện

- Schema migration tạo 3 bảng mới: `flash_sale_sessions`, `flash_sale_items`, `flash_sale_compensation_logs` — Bằng chứng: [`backend/prisma/migrations/20261002140000_flash_sale_concurrency/migration.sql`](../../backend/prisma/migrations/20261002140000_flash_sale_concurrency/migration.sql)
- Singleton Redis Client kết nối Upstash Singapore (TLS/SSL) — Bằng chứng: [`backend/src/modules/flash-sale/infrastructure/redis.client.ts`](../../backend/src/modules/flash-sale/infrastructure/redis.client.ts)
- Bộ 2 Lua Script nguyên tử chuẩn hóa (`deduct` & `compensate`) — Bằng chứng: [`backend/src/modules/flash-sale/infrastructure/lua/`](../../backend/src/modules/flash-sale/infrastructure/lua/)
- Service nghiệp vụ Flash Sale & Engine Watchdog tự chữa lành — Bằng chứng: [`backend/src/modules/flash-sale/services/flash-sale.service.ts`](../../backend/src/modules/flash-sale/services/flash-sale.service.ts)
- Repository truy vấn PostgreSQL và xử lý đối soát — Bằng chứng: [`backend/src/modules/flash-sale/repositories/pg-flash-sale.repository.ts`](../../backend/src/modules/flash-sale/repositories/pg-flash-sale.repository.ts)
- Router Express API đầy đủ endpoints cho Client và Admin — Bằng chứng: [`backend/src/modules/flash-sale/routes/flash-sale.routes.ts`](../../backend/src/modules/flash-sale/routes/flash-sale.routes.ts)
- Tích hợp route `/api/v1/flash-sales` vào Platform App — Bằng chứng: [`backend/src/platform/http/app.ts`](../../backend/src/platform/http/app.ts)
- Bộ Integration Test Suite kiểm thử 5 kịch bản tải và crash recovery — Bằng chứng: [`backend/tests/db/flash-sale-concurrency.integration.test.ts`](../../backend/tests/db/flash-sale-concurrency.integration.test.ts)

## Thiết kế / quyết định kỹ thuật

- **PostgreSQL là Single Source of Truth:** Order chỉ được coi là thành công khi Transaction DB đã `COMMIT`. Redis đóng vai trò là Fast-path Concurrency Gate và Replay Cache — Lý do: Loại bỏ hoàn toàn khoảng hở Dual-write giữa 2 hệ thống độc lập.
- **Whitelist State Machine cho Lease:** Chỉ cho phép hoàn kho khi `lease == 'HOLD'`. Nếu lease là `'COMMITTED'`, `'RECLAIMED'` hoặc `nil` thì tuyệt đối không hoàn tồn — Lý do: Triệt tiêu 100% nguy cơ hoàn đúp tồn kho khi chạy Watchdog trên môi trường scale ngang đa instance.
- **Thứ tự tháo phao an toàn (Safety-net Invariant):** Tại Tầng 3 sau commit, thứ tự bắt buộc là: (1) Lưu Idempotency Replay Cache ➡️ (2) Đổi lease sang `COMMITTED` ➡️ (3) `ZREM pending_reservations` — Lý do: Đảm bảo nếu server crash tại bất kỳ micro-step nào, Watchdog vẫn nhìn thấy reservation để tự chữa lành.
- **Timing đối soát 20 phút:** Job đối soát chính thức chạy sau khi slot kết thúc 20 phút — Lý do: Tránh false positive đối với các đơn hàng đặt ở phút cuối cùng vẫn đang trong thời gian giữ hàng (reservation window).

## Kiểm tra và kết quả

| Kiểm tra | Lệnh / CI job | Kết quả | Bằng chứng / ghi chú |
|---|---|---|---|
| TypeScript Typecheck | `npm run typecheck` | PASS | `tsc --noEmit` hoàn thành không lỗi. |
| Test 1: Concurrency Kho (50 requests vs 10 items) | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | PASS | 10 đơn thành công, 40 đơn hết hàng, Redis stock = 0, DB orders = 10, Oversell = 0. |
| Test 2: Concurrency Voucher (2 requests vs 1 quota) | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | PASS | Đúng 1 đơn áp mã thành công, 1 đơn báo `VOUCHER_OUT_OF_STOCK`, quota = 0. |
| Test 3: Idempotent Retry | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | PASS | Gửi lại cùng `Idempotency-Key` trả về HTTP 200 Replay với cùng `order_id`, không tạo đơn trùng. |
| Test 4: Crash Recovery Trước Commit | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | PASS | Watchdog quét quá hạn > 30s, đối chiếu Postgres thấy không có Order ➡️ Tự động hoàn stock về 5. |
| Test 5: Crash Sau Commit Trước ZREM | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | PASS | Watchdog quét thấy Order đã commit trong DB ➡️ Không hoàn stock nhầm, khôi phục Idempotency Replay Cache. |

## An toàn và tình huống lỗi

- Phân quyền / dữ liệu nhạy cảm: Endpoints mua hàng yêu cầu JWT xác thực; user_id trích xuất từ auth token hoặc request context bảo mật.
- Retry, request trùng, race condition: Xử lý 2 tầng (Redis Fast-path `IN_PROGRESS` + Postgres `api_idempotency_records`). SISMEMBER trong Lua Script chặn triệt để double-click.
- Hủy, hoàn tiền, timeout, rollback: Statement timeout 10s tự động ngắt transaction DB bị nghẽn; trigger Compensating Lua Script hoàn stock nguyên tử; lưu vết `flash_sale_compensation_logs`.
- Rủi ro còn lại: Nếu cụm Upstash Redis mất kết nối hoàn toàn trong lúc cao điểm, request sẽ fallback về lỗi 500 an toàn thay vì để lọt tải xuống làm sập Database.

## Việc còn lại và blocker

- [x] Triển khai Schema Migration — Owner: Thành viên Feature 05 — Hoàn thành: 2026-10-02
- [x] Xây dựng Module Flash Sale & Lua Engines — Owner: Thành viên Feature 05 — Hoàn thành: 2026-10-02
- [x] Kiểm thử tự động Concurrency & Crash Recovery — Owner: Thành viên Feature 05 — Hoàn thành: 2026-10-02
- [x] Báo cáo nghiệm thu kỹ thuật — Owner: Thành viên Feature 05 — Hoàn thành: 2026-10-02
- Blocker: Không

## Nhật ký cập nhật

### 2026-10-02

- Đã làm: Hoàn tất 100% toàn bộ module Flash Sale & High Concurrency: tạo migration DB, viết 2 Lua script nguyên tử (`deduct` và `compensate`), cài đặt service 3 tầng, router API, engine Watchdog tự chữa lành và bộ test tự động 5 ca kiểm thử.
- Kiểm tra: Toàn bộ 5 test cases tích hợp chạy trực tiếp trên Supabase PostgreSQL và Upstash Redis đạt 100% PASS (22.2s execution time). `tsc --noEmit` đạt PASS.
- Tiếp theo / blocker: Sẵn sàng bàn giao và tạo Pull Request vào nhánh `dev`.
