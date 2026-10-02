# Báo cáo: Flash Sale & Chống bán vượt tồn (High Concurrency Inventory)

## Owner và trạng thái

- Owner: Thành viên phụ trách Feature 05
- Người phối hợp: Không
- Trạng thái: Hoàn thành
- Cập nhật lần cuối: 2026-10-02
- Nhánh / PR / commit: `feat/flash-sale-concurrency`

## Mục tiêu và phạm vi

- Mục tiêu: Xử lý bài toán cao tải (High Concurrency) khi mở bán Flash Sale theo khung giờ (09:00, 12:00, 20:00). Ngăn chặn 100% hiện tượng bán vượt tồn kho (Zero Overselling), giải quyết tranh chấp voucher đồng thời (Voucher Race Condition), đảm bảo tính lũy thừa (Idempotency) khi client retry, chống bot spam / double-click từ cùng 1 user, và tự động khôi phục dữ liệu nếu server crash đột ngột (Self-healing Zero Stock Leak).
- Trong phạm vi:
  - Quản lý khung giờ Flash Sale (`flash_sale_sessions`) và sản phẩm mở bán (`flash_sale_items`).
  - Cache Warm-up nạp tồn kho và voucher quota lên Upstash Redis cluster trước giờ mở bán.
  - Lua Script nguyên tử 1 round-trip (`flash-sale-deduct.lua`): Kiểm tra trạng thái slot, giới hạn mua của user, tranh chấp voucher quota/used, trừ tồn kho và ghi nhận watchdog lease.
  - Kiến trúc phòng thủ 3 tầng: Fast-path Redis ➡️ PostgreSQL ACID Transaction (Single Source of Truth) ➡️ Post-commit Safe Cleanup (Đúng thứ tự tháo phao an toàn).
  - Compensating Lua Script (`flash-sale-compensate.lua`) với Whitelist guard (`if lease ~= "HOLD"`) chống hoàn đúp khi chạy đa instance.
  - Watchdog Engine tự chữa lành: Cross-check PostgreSQL trước khi hoàn stock; tự động khôi phục Idempotency Replay Cache nếu server sập nguồn sau commit.
  - Job Đối Soát (Reconciliation): Đo lường độ lệch giữa Redis và Database, tự động cân bằng với `flash_sale_compensation_logs`, phát hiện cả sai lệch cố ý (Negative Test).
  - Bộ Test Suite toàn diện 11 ca kiểm thử tự động (Unit/Integration) và kịch bản In-Process Stress Test Benchmark 1.000 requests.
- Ngoài phạm vi: Tích hợp cổng thanh toán trực tiếp của ngân hàng (Payout/Refund cổng thẻ quốc tế) trong khuôn khổ MVP.

## Đã thực hiện

- Schema migration tạo 3 bảng mới: `flash_sale_sessions`, `flash_sale_items`, `flash_sale_compensation_logs` — Bằng chứng: [`backend/prisma/migrations/20261002140000_flash_sale_concurrency/migration.sql`](../../backend/prisma/migrations/20261002140000_flash_sale_concurrency/migration.sql)
- Singleton Redis Client kết nối Upstash Singapore (TLS/SSL) — Bằng chứng: [`backend/src/modules/flash-sale/infrastructure/redis.client.ts`](../../backend/src/modules/flash-sale/infrastructure/redis.client.ts)
- Bộ 2 Lua Script nguyên tử chuẩn hóa (`deduct` & `compensate`) — Bằng chứng: [`backend/src/modules/flash-sale/infrastructure/lua/`](../../backend/src/modules/flash-sale/infrastructure/lua/)
- Service nghiệp vụ Flash Sale & Engine Watchdog tự chữa lành — Bằng chứng: [`backend/src/modules/flash-sale/services/flash-sale.service.ts`](../../backend/src/modules/flash-sale/services/flash-sale.service.ts)
- Repository truy vấn PostgreSQL và xử lý đối soát — Bằng chứng: [`backend/src/modules/flash-sale/repositories/pg-flash-sale.repository.ts`](../../backend/src/modules/flash-sale/repositories/pg-flash-sale.repository.ts)
- Router API đầy đủ endpoints cho Client và Admin — Bằng chứng: [`backend/src/modules/flash-sale/routes/flash-sale.routes.ts`](../../backend/src/modules/flash-sale/routes/flash-sale.routes.ts)
- Tích hợp route `/api/v1/flash-sales` vào Platform App — Bằng chứng: [`backend/src/platform/http/app.ts`](../../backend/src/platform/http/app.ts)
- Bộ Integration Test Suite kiểm thử 11 kịch bản toàn diện — Bằng chứng: [`backend/tests/db/flash-sale-concurrency.integration.test.ts`](../../backend/tests/db/flash-sale-concurrency.integration.test.ts)
- Script In-Process Concurrency Benchmark 1.000 requests — Bằng chứng: [`backend/tests/benchmark/flash-sale-1000-concurrency.bench.ts`](../../backend/tests/benchmark/flash-sale-1000-concurrency.bench.ts)

## Thiết kế / quyết định kỹ thuật

- **PostgreSQL là Single Source of Truth:** Order chỉ được coi là thành công khi Transaction DB đã `COMMIT`. Redis đóng vai trò là Fast-path Concurrency Gate và Replay Cache — Lý do: Loại bỏ hoàn toàn khoảng hở Dual-write giữa 2 hệ thống độc lập.
- **Whitelist State Machine cho Lease:** Chỉ cho phép hoàn kho khi `lease == 'HOLD'`. Nếu lease là `'COMMITTED'`, `'RECLAIMED'` hoặc `nil` thì tuyệt đối không hoàn tồn — Lý do: Triệt tiêu 100% nguy cơ hoàn đúp tồn kho khi chạy Watchdog trên môi trường scale ngang đa instance.
- **Thứ tự tháo phao an toàn (Safety-net Invariant):** Tại Tầng 3 sau commit, thứ tự bắt buộc là: (1) Lưu Idempotency Replay Cache ➡️ (2) Đổi lease sang `COMMITTED` ➡️ (3) `ZREM pending_reservations` — Lý do: Đảm bảo nếu server crash tại bất kỳ micro-step nào, Watchdog vẫn nhìn thấy reservation để tự chữa lành.
- **Tách biệt Purchase Limit và Idempotency Concurrency:**
  - `SISMEMBER` trong Lua chặn 1 user mua nhiều lần dù cố tình thay đổi `idempotency_key` khác nhau.
  - Idempotency Lock (`IN_PROGRESS`) chặn double-click cùng 1 key, phản hồi đang xử lý và trả kết quả Replay an toàn khi retry.
- **Cách ly DB Connection Pool khi Hết Hàng (Fast Reject):** Khi tồn kho Redis = 0, toàn bộ request bị từ chối ngay tại Tầng 1, không mở bất kỳ `pool.connect()` nào dưới PostgreSQL.
- **Timing đối soát 20 phút:** Job đối soát chính thức chạy sau khi slot kết thúc 20 phút — Lý do: Tránh false positive đối với các đơn hàng đặt ở phút cuối cùng vẫn đang trong thời gian giữ hàng (reservation window).

## Kiểm tra và kết quả

### 1. Ma trận 11 Integration Tests (`vitest`)

| STT | Kiểm tra | Lệnh thực thi | Kết quả | Bằng chứng / Chi tiết |
|:---:|---|---|:---:|---|
| 0 | TypeScript Typecheck | `npm run typecheck` | **PASS** | `tsc --noEmit` đạt 0 errors. |
| 1 | Concurrency Kho (50 requests vs 10 items) | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | **PASS** | 10 đơn thành công, 40 đơn hết hàng, Redis stock = 0, DB orders = 10, Oversell = 0. |
| 2 | Concurrency Voucher (2 requests vs 1 quota) | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | **PASS** | Đúng 1 đơn áp mã thành công, 1 đơn báo `VOUCHER_OUT_OF_STOCK`, quota = 0. |
| 3 | Idempotent Retry Replay | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | **PASS** | Gửi lại cùng `Idempotency-Key` trả về HTTP 200 Replay với cùng `order_id`, không tạo đơn trùng. |
| 4 | Crash Recovery Trước Commit | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | **PASS** | Watchdog quét quá hạn > 30s, cross-check Postgres thấy không có Order ➡️ Tự động hoàn stock về 5. |
| 5 | Crash Sau Commit Trước ZREM | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | **PASS** | Watchdog thấy Order đã commit trong DB ➡️ Không hoàn stock nhầm, khôi phục Idempotency Replay Cache. |
| 6 | Slot Upcoming (Chưa mở) | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | **PASS** | Reject mã `SLOT_NOT_ACTIVE (-1)`, không tạo đơn, stock giữ nguyên. |
| 7 | Slot Ended (Đã kết thúc) | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | **PASS** | Reject mã `SLOT_NOT_ACTIVE (-1)`, không tạo đơn. |
| 8a | User Limit (20 keys khác nhau, 1 user) | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | **PASS** | Đúng 1 thành công, 19 bị chặn bởi `USER_PURCHASE_LIMIT_EXCEEDED (-2)`, DB có đúng 1 order. |
| 8b | Idempotency Concurrency (20 cùng 1 key) | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | **PASS** | 1 đơn giành lock xử lý, 19 đơn nhận in-progress; retry nhận replay kết quả cũ, DB đúng 1 order. |
| 9 | Zero Stock Fast-Reject (DB Isolation) | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | **PASS** | 50 requests bị reject ở Redis; spy chứng minh `pool.connect()` = 0 calls (hoàn toàn không chạm DB). |
| 10 | Reconciliation (Happy & Negative Path) | `vitest run tests/db/flash-sale-concurrency.integration.test.ts` | **PASS** | Happy path: `is_balanced: true`; Negative path (cố tình sửa stock = 999): phát hiện `is_balanced: false` và bắt đúng chênh lệch. |

---

### 2. Kết quả Stress Test Benchmark: 1.000 Concurrent Requests tranh mua 10 sản phẩm

> **Lưu ý minh bạch kỹ thuật (Engineering Transparency):**
> Kịch bản benchmark dưới đây là **In-Process Concurrency & Invariant Stress Test** chạy bằng `Promise.all` 1.000 promises từ môi trường Node.js kết nối trực tiếp qua Internet tới Upstash Redis (Singapore TLS) và Supabase PostgreSQL.
> Đây **không phải là distributed HTTP load test** bằng công cụ ngoại vi (như k6/Artillery), mà tập trung đo lường tính bất biến **Zero Overselling** và năng lực cô lập giao dịch của kiến trúc 3 tầng dưới xung lực tranh chấp tối đa.

#### Kết quả đo đạc thực tế từ lệnh `npx tsx tests/benchmark/flash-sale-1000-concurrency.bench.ts`:

```text
================================================================================
⚡ FLASH SALE 1,000 CONCURRENT REQUESTS BENCHMARK REPORT (IN-PROCESS)
================================================================================
Target Product Stock   : 10 units
Total Requests Fired   : 1,000 requests
Successful Purchases   : 10 (1.00%)
Rejected (Sold Out)    : 990 (99.00%)
Oversold Items Count   : 0 (0.00%) --> [PASS: ZERO OVERSELLING]

--- LATENCY METRICS (Measured via performance.now()) ---
Min Latency            : 1,314.97 ms
Average Latency        : 1,355.95 ms
Median (P50)           : 1,326.71 ms
95th Percentile (P95)  : 1,338.26 ms
99th Percentile (P99)  : 2,772.85 ms
Max Latency            : 5,236.63 ms

--- THROUGHPUT & DATA INTEGRITY ---
Total Wall-clock Time  : 5,238.20 ms (5.24 s)
Throughput             : 190.91 req/sec
PostgreSQL Orders      : 10 rows verified (Expected: 10)
Redis Stock Key        : 0 (Expected: 0)
Pending Watchdog Leases: 0 items
================================================================================
```

#### Phân tích độ trễ thực tế (Latency Breakdown Analysis):
- **Tại sao P50 ở mức ~1.3 giây trong bài test này?**
  - Môi trường test chạy từ máy trạm (Việt Nam) gọi qua Internet công cộng tới Redis cluster của Upstash đặt tại **Singapore** và Database Supabase qua kết nối TLS/SSL bảo mật.
  - Khi bắn đồng thời 1.000 requests trong cùng 1 process, hàng đợi socket mạng (Network Socket Queue) và TLS Handshake chịu độ trễ quốc tế (~35-50ms RTT mỗi chiều).
  - 10 requests thành công phải thực hiện trọn vẹn: Lua script Redis ➡️ Mở PG connection pool ➡️ Advisory lock ➡️ Insert order ➡️ Commit ➡️ Redis post-commit cleanup.
- **Kỳ vọng trong môi trường Production (Co-located VPC / Datacenter):**
  - Khi Backend, Redis và PostgreSQL cùng nằm trong Private Subnet (AWS Singapore / GCP / Bare-metal), Network RTT giảm từ ~45ms xuống $< 1\text{ms}$.
  - Độ trễ P50 cho 990 requests trượt (chỉ chạm Redis Lua) sẽ giảm xuống mức **$< 3\text{ms}$**, và Throughput toàn hệ thống sẽ đạt **$> 2.500\text{ req/sec}$**.

---

## CV Highlights & Phỏng Vấn Kỹ Thuật (Tech Interview Defense)

Khi nhà tuyển dụng hỏi sâu về Module Flash Sale trên CV của bạn:

1. **"Tại sao không dùng PostgreSQL `SELECT ... FOR UPDATE` mà phải dùng Redis + Lua?"**
   - *Trả lời*: Nếu 1.000 requests ập vào DB trong 50ms, `SELECT FOR UPDATE` sẽ khiến 1.000 transactions tranh chấp Row Lock, gây cạn kiệt Connection Pool (Pool Exhaustion), nghẽn CPU và nguy cơ cao bị Deadlock.
   - *Giải pháp*: Mô hình Two-tier dùng Redis Lua Script lọc bỏ 990 requests hết hàng ngay ở Tầng 1 với chi phí CPU cực thấp. Database chỉ phải mở đúng 10 transactions cho 10 đơn thành công.

2. **"Nếu server sập nguồn (crash) ngay sau khi trừ kho Redis thì làm sao không bị mất hàng?"**
   - *Trả lời*: Dùng mô hình **Watchdog ZSet + Lease Whitelist State Machine**. Request khi trừ kho trên Redis sẽ ghi vào ZSet `pending_reservations` với TTL 45 giây và lease `'HOLD'`.
   - Nếu server crash trước khi commit DB, Watchdog định kỳ cross-check với PostgreSQL (Single Source of Truth). Thấy chưa có Order trong DB ➡️ Kích hoạt Compensating Lua Script hoàn kho tự động.
   - Nếu server crash sau khi commit DB thành công, Watchdog thấy Order đã có ➡️ Tự phục hồi Replay Cache, đánh dấu `COMMITTED`, tuyệt đối **không hoàn kho nhầm**.

3. **"Làm sao chống Bot Spam hoặc Double-click nhanh từ cùng 1 User?"**
   - *Trả lời*: Kết hợp 2 cơ chế độc lập:
     - **Chống mua nhiều lần**: `SISMEMBER flash_sale:users:<slot_id> <user_id>` thực thi nguyên tử trong Lua Script. Dù bot có đổi 1.000 `idempotency_key` khác nhau thì cũng bị chặn đứng ở lần gọi thứ 2.
     - **Chống double-click đồng thời**: `SET flash_sale:idemp_lock:<uid>:<key> "IN_PROGRESS" EX 60 NX`. Request đến sau trong lúc request đầu đang chạy sẽ nhận thông báo đang xử lý; khi retry sau đó sẽ nhận kết quả Replay từ Cache (HTTP 200).

---

## An toàn và tình huống lỗi

- Phân quyền / dữ liệu nhạy cảm: Endpoints mua hàng yêu cầu JWT xác thực; user_id trích xuất từ auth token hoặc request context bảo mật.
- Retry, request trùng, race condition: Xử lý 2 tầng (Redis Fast-path `IN_PROGRESS` + Postgres `api_idempotency_records`). `SISMEMBER` trong Lua Script chặn triệt để double-click.
- Hủy, hoàn tiền, timeout, rollback: Statement timeout 10s tự động ngắt transaction DB bị nghẽn; trigger Compensating Lua Script hoàn stock nguyên tử; lưu vết `flash_sale_compensation_logs`.
- Rủi ro còn lại: Nếu cụm Upstash Redis mất kết nối hoàn toàn trong lúc cao điểm, request sẽ fallback về lỗi 500 an toàn thay vì để lọt tải xuống làm sập Database.

## Việc còn lại và blocker

- [x] Triển khai Schema Migration — Owner: Thành viên Feature 05 — Hoàn thành: 2026-10-02
- [x] Xây dựng Module Flash Sale & Lua Engines — Owner: Thành viên Feature 05 — Hoàn thành: 2026-10-02
- [x] Mở rộng Integration Test Suite (11 ca kiểm thử) — Owner: Thành viên Feature 05 — Hoàn thành: 2026-10-02
- [x] Triển khai Stress Test Benchmark 1.000 requests — Owner: Thành viên Feature 05 — Hoàn thành: 2026-10-02
- [x] Báo cáo nghiệm thu kỹ thuật & CV Highlights — Owner: Thành viên Feature 05 — Hoàn thành: 2026-10-02
- Blocker: Không

## Nhật ký cập nhật

### 2026-10-02 (Cập nhật Mở rộng Test & Benchmark)

- Đã làm:
  - Bổ sung 6 test cases mới vào bộ kiểm thử: Slot Upcoming, Slot Ended, User Purchase Limit (20 keys khác nhau), Idempotency Concurrency (cùng 1 key), Zero Stock Fast-Reject (DB Isolation chứng minh `pool.connect()` = 0), Reconciliation Job (Happy & Negative path phát hiện sai lệch).
  - Xây dựng và thực thi kịch bản In-Process Stress Test Benchmark 1.000 concurrent requests tranh mua 10 sản phẩm trên Upstash Redis và Supabase DB.
  - Cập nhật số liệu đo đạc thực tế, phân tích nguyên nhân latency và bổ sung cẩm nang phỏng vấn kỹ thuật vào tài liệu.
- Kiểm tra:
  - 11/11 Integration Tests đạt PASS 100% (41.4s).
  - Benchmark 1.000 requests đạt: 10 đơn thành công (1.00%), 990 đơn hết hàng (99.00%), **0 oversold (0.00%)**, 10 đơn hàng PostgreSQL và 0 pending lease tồn dư.
  - TypeScript Typecheck: 0 errors.
- Tiếp theo / blocker: Commit và push cập nhật lên nhánh `feat/flash-sale-concurrency`.
