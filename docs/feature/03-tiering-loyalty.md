# Báo cáo: Phân cấp Buyer & Shop (Tiering & Loyalty)

## Owner và trạng thái

- Owner: Chưa xác định (Đội Core Platform)
- Người phối hợp: Không
- Trạng thái: Đang triển khai / Nghiệm thu từng phần (Đợt A & Đợt B đã kiểm chứng, Đợt C chưa triển khai)
- Cập nhật lần cuối: 2026-10-02
- Nhánh / PR / commit: `codex/tiering-loyalty` (cập nhật từ `dev` commit `0811358`)
- Link tạo Pull Request trên GitHub (chưa tạo PR): https://github.com/lwd7071/e-commerce-platform/pull/new/codex/tiering-loyalty

## Mục tiêu và phạm vi

- Mục tiêu: Xây dựng hệ thống phân hạng tinh gọn và minh bạch cho Shop (STANDARD / PREFERRED / MALL) và Buyer (STANDARD / VIP) kèm cơ chế tích lũy điểm DinoPoint an toàn khi đơn hàng hoàn tất.
- Trong phạm vi được duyệt (P0-1 đến P0-8, Đợt A và Đợt B):
  - Bước 0: Sửa lỗi nền runtime wiring `confirmReceived` trên `createRuntimeApp` và hoàn thiện kiểm tra điều kiện Shipment (P0-9).
  - Đợt A: Bổ sung `tier` cho Shop (`STANDARD`, `PREFERRED`, `MALL`) do Admin quản lý duyệt thủ công kèm audit log bắt buộc theo QD20; hỗ trợ bộ lọc catalog theo hạng và hiển thị huy hiệu `TierBadge` ở cả `ProductCard` và `ProductDetailScreen`.
  - Đợt B: Phân hạng Buyer (`STANDARD`, `VIP`) tự động dựa trên tổng chi tiêu tích lũy `total_spent` (>= 5.000.000 VNĐ). Tích lũy điểm DinoPoint (10.000 VNĐ = 1 điểm cho Standard, x2 cho VIP) và ghi nhận vào bảng Ledger `loyalty_point_transactions`. Hiển thị thông tin thành viên VIP, số dư điểm và tiến trình chi tiêu trong trang Profile của Buyer qua `BuyerLoyaltyCard`.
- Ngoài phạm vi:
  - Không backfill dữ liệu cũ (P0-6).
  - Đổi điểm trừ tiền khi checkout hoặc voucher đổi thưởng (P0-5: chỉ tích lũy và hiển thị điểm).
  - Xử lý hoàn điểm/thu hồi điểm khi hoàn tiền/trả hàng (P0-7).
  - Đợt C: Không triển khai cron tự động xét PREFERRED hoặc boost MALL trong tìm kiếm (hệ thống sử dụng tìm kiếm PostgreSQL `pg_trgm`/`to_tsvector`, không dùng ElasticSearch).
  - Trợ lý AI, chat realtime, ví tiền thật.

## Đã thực hiện

- Bước 0: Sửa lỗi wiring `confirmReceived` và kiểm tra quyền hoàn tất đơn:
  - Đấu nối `confirmReceived` vào `orderServices` trong `createRuntimeApp` (`backend/src/platform/http/app.ts`).
  - Mở rộng `OrderServices` interface và ủy thác handler trong `backend/src/platform/http/routes/order-routes.ts`.
  - Thực hiện kiểm tra quyền và điều kiện Shipment P0-9 trong `PgCheckoutService.confirmReceived` (`backend/src/modules/checkout/services/pg-checkout.service.ts`).
  - Viết bộ kiểm thử tích hợp 8/8 tests pass qua `createRuntimeApp` tại `backend/test/platform/order-confirm-received.spec.ts`.
- Đợt A: Phân hạng Shop, huy hiệu và lịch sử duyệt của Admin:
  - Tạo migration `20261003100000_shop_tiering` thêm `tier`, `tier_override`, `tier_override_reason`, `tier_overridden_at`, `tier_override_by` vào bảng `shops`.
  - Triển khai endpoint `PATCH /admin/shops/:id/tier` với kiểm tra UUID, validate tier (`STANDARD`, `PREFERRED`, `MALL`), bắt buộc `reason` không rỗng và ghi audit log `SHOP_TIER_UPDATE` nguyên tử.
  - Cập nhật `GET /admin/shops` hỗ trợ query param `tier`, trả về thông tin `tier` của shop.
  - Cập nhật catalog repository & HTTP service: hỗ trợ lọc sản phẩm theo `shop_tier`, trả về `shop_tier` trong danh sách và chi tiết sản phẩm.
  - Cập nhật OpenAPI spec và đồng bộ mã nguồn generated API types frontend (`frontend/src/lib/api/generated/openapi.ts`).
  - Frontend UI:
    - Xây dựng component `TierBadge` hiển thị nhãn MALL và Yêu thích (PREFERRED).
    - Tích hợp `TierBadge` vào `ProductCard` (danh sách catalog) và `ProductDetailScreen` (trang chi tiết sản phẩm cạnh tên sản phẩm).
    - Thêm bộ lọc phân hạng Shop trên màn hình danh mục sản phẩm `CatalogListScreen` (chip "Tất cả shop", "Dino Mall", "Shop Yêu thích") kèm đồng bộ query string `shop_tier`.
    - Màn hình `AdminShopsScreen` hỗ trợ cột Hạng, bộ lọc và dialog "Đổi hạng" có lý do bắt buộc.
- Đợt B: Phân hạng Buyer VIP, Ledger tích điểm DinoPoint và Profile UI:
  - Tạo migration `20261003110000_buyer_loyalty` thêm `buyer_tier`, `total_spent`, `loyalty_points` vào `app_users`, tạo bảng `loyalty_point_transactions` kèm unique index `uq_loyalty_transactions__order_earned` ngăn tích điểm trùng lặp.
  - Thiết lập bảo mật cơ sở dữ liệu: bật RLS (`ENABLE ROW LEVEL SECURITY`) và thu hồi toàn bộ quyền trực tiếp trên bảng ledger (`REVOKE ALL ON TABLE loyalty_point_transactions FROM PUBLIC, anon, authenticated;`).
  - Xây dựng module domain `loyalty.types.ts` với phép tính số học chính xác tuyệt đối qua `BigInt` cents chuẩn repository: loại trừ phí vận chuyển (P0-1), 1 điểm mỗi 10.000 VNĐ (P0-2), hệ số điểm lấy từ hạng cũ dưới khóa (P0-3), ngưỡng VIP 5.000.000 VNĐ.
  - Hiện thực hóa `LoyaltyService` và hook ghi nhận nguyên tử trong `PgCheckoutService.persistTransition`: khóa dòng Buyer `SELECT ... FOR UPDATE`, chèn ledger bằng `INSERT ... ON CONFLICT (reference_order_id) WHERE reason = 'ORDER_COMPLETED' DO NOTHING RETURNING transaction_id`, chỉ cộng chi tiêu/điểm khi chèn ledger thành công (`rowCount === 1`). Đơn dưới 10.000 VNĐ vẫn ghi nhận chi tiêu và tạo ledger với 0 điểm.
  - Triển khai endpoints `GET /api/v1/buyer/loyalty` và `GET /api/v1/buyer/loyalty/history` trong `buyer-routes.ts` và đăng ký trong OpenAPI spec.
  - Frontend: Xây dựng component `BuyerLoyaltyCard` hiển thị huy hiệu VIP/Standard, số dư DinoPoint, thanh tiến trình thăng hạng VIP và bảng lịch sử giao dịch điểm. Tích hợp trực tiếp vào trang `ProfileScreen` cho tài khoản BUYER.
- Bổ sung kiểm thử PostgreSQL thật độc lập & E2E Lifecycle:
  - Tạo bộ kiểm thử tích hợp trên PostgreSQL thật: `backend/tests/db/tiering-loyalty.integration.test.ts` (8/8 tests PASS) chạy trên schema độc lập `p5_loyalty_<uuid>`.
  - Tạo bộ kiểm thử E2E Lifecycle hoàn chỉnh: `frontend/test/e2e-tiering-loyalty-lifecycle.spec.tsx` (7/7 tests PASS) kiểm chứng 2 hành trình:
    1. Admin đổi hạng shop thành MALL/PREFERRED -> `ProductCard` và `ProductDetailScreen` hiển thị đúng badge; `CatalogListScreen` có UI bộ lọc theo phân hạng shop.
    2. Buyer bấm nhận hàng -> đơn chuyển COMPLETED -> Profile hiển thị điểm DinoPoint, hạng thành viên, tiến trình VIP và lịch sử giao dịch.

## Thiết kế / quyết định kỹ thuật

- Quyết định P0-9 (Đã chốt với Chủ dự án 2026-10-02):
  - Order phải ở `SHIPPING`.
  - Shipment bắt buộc phải tồn tại trong bảng `shipments`; nếu thiếu trả về `409 SHIPMENT_REQUIRED`.
  - Admin xác nhận phải có `reason` không rỗng; nếu thiếu trả về `422 REASON_REQUIRED`.
  - Trạng thái Shipment chỉ được chuyển sang `DELIVERED` nếu đang ở trạng thái hợp lệ (`SHIPPING` -> `DELIVERED`, hoặc giữ nguyên nếu đã là `DELIVERED`). Nếu ở trạng thái không thể chuyển (ví dụ `FAILED`), từ chối với `409 SHIPMENT_INVALID_STATE`.
  - Cập nhật Shipment `DELIVERED`, Order `COMPLETED`, `order_status_history`, audit log (`admin_logs`) và thông báo được thực thi nguyên tử trong cùng một database transaction.
- Loại bỏ hoàn toàn Floating Point: Sử dụng số học `BigInt` cents chuẩn repository (`order-calculation.ts`) quy đổi 10.000 VNĐ = `1_000_000n` cents.
- Xử lý Duplicate trong PostgreSQL Transaction: Dùng `INSERT INTO loyalty_point_transactions ... ON CONFLICT (reference_order_id) WHERE reason = 'ORDER_COMPLETED' DO NOTHING RETURNING transaction_id`. Chỉ tăng chi tiêu và điểm khi `rowCount === 1`. Đơn dưới 10.000 VNĐ vẫn ghi Ledger (`points_delta = 0`) để chống duplicate.
- An toàn Concurrency: Khóa dòng Buyer `SELECT ... FROM app_users WHERE user_id = $1 FOR UPDATE` trong transaction sau khi đã khóa Order. Đọc `old_total_spent` và `old_tier` dưới khóa, tính toán `new_total_spent` và `new_tier` bằng domain logic rồi truyền tham số vào câu lệnh UPDATE.
- Phân biệt môi trường kiểm thử Mock vs Database Thật:
  - `backend/test/platform/buyer-loyalty.spec.ts`: Chạy in-memory với mock database client để xác nhận logic nghiệp vụ HTTP và validation nhanh.
  - `backend/tests/db/tiering-loyalty.integration.test.ts`: Chạy trên PostgreSQL thật (Supabase PostgreSQL test database) trên schema cô lập, kiểm chứng khóa dòng `SELECT FOR UPDATE`, cơ chế `ON CONFLICT` duplicate prevention, rollback integrity và bảo mật RLS.
- Metadata Override cho Shop: Bổ sung các cột `tier_override`, `tier_override_reason`, `tier_overridden_at`, `tier_override_by` vào bảng `shops` để phân biệt hạng thủ công do Admin gán và tự động.
- Tương thích dữ liệu cũ / rollback: Toàn bộ cột thêm mới đều có giá trị `DEFAULT` (`'STANDARD'`, `0`, `FALSE`), bảo đảm Zero Breaking Changes.

## Kiểm tra và kết quả

| Kiểm tra | Môi trường | Lệnh / File kiểm thử | Kết quả | Bằng chứng / ghi chú |
|---|---|---|---|---|
| Prisma Schema & Migration Validation | Dev/Local | `cmd /c npx prisma validate` | PASS | `The schema at prisma\schema.prisma is valid 🚀` |
| Prisma Migration Status Check | Supabase Database | `cmd /c npx prisma migrate status` | Ghi nhận | `20261003100000_shop_tiering` và `20261003110000_buyer_loyalty` chưa áp dụng trên `public`. Bổ sung bảo mật RLS được chuyển sang migration forward-only mới `20261003120000_secure_loyalty_ledger`. |
| Real PostgreSQL Tiering & Loyalty Integration | PostgreSQL Thật (Isolated Schema) | `cmd /c npx vitest run tests/db/tiering-loyalty.integration.test.ts` | PASS | 11/11 tests pass (130.9s). Bao gồm: Schema verification, RLS enabled, Role anon & authenticated bị từ chối truy cập (SQLSTATE 42501), backend service role được phép, ON CONFLICT idempotency, đơn < 10k 0-pts, Concurrency SELECT FOR UPDATE (4.9M & 4.8M), Rollback toàn bộ Order + Shipment + Ledger + Balances khi lỗi loyalty qua `PgCheckoutService.confirmReceived`, và Atomic commit khi thành công. |
| Full Backend Vitest Suite | Remote Supabase Pooler | `cmd /c npm run test:vitest` | CHƯA ĐẠT (7/60 files fail) | 53/60 files passed, 334/344 tests passed (1340.9s - 22.3 phút). Ghi rõ blocker thực tế: 3 files catalog fail do query trực tiếp schema `public` thiếu cột `shops.tier` (chưa chạy migration trên public); 2 files regression fail do database dùng chung có 27 bảng thay vì 24 bảng. Riêng suite `tiering-loyalty` đã pass 100%. |
| Frontend Component Integration Test | Vitest + jsdom (Mock Repositories) | `npm --prefix frontend test -- test/e2e-tiering-loyalty-lifecycle.spec.tsx` | PASS | 7/7 tests pass (4.5s): Runner là Vitest + jsdom + Testing Library, mock qua `features.domains` (`useMock: true`), `next/navigation`, `buyerApi.getLoyaltySummary`. Kiểm chứng Admin đổi hạng -> ProductCard & ProductDetail hiện badge; CatalogListScreen lọc hạng; Buyer nhận hàng -> Profile cập nhật DinoPoint/VIP/history. |
| Frontend Live Browser E2E | Playwright Browser (Live Environment) | `cmd /c npx playwright test e2e/tiering-loyalty-live.spec.ts` | ĐÃ TẠO SPEC (2 skipped khi thiếu live env) | Runner là Playwright (`@playwright/test`). Kiểm thử 2 hành trình thực tế qua browser: Admin đổi hạng trên `/admin/shops` -> Catalog hiển thị badge trên `/products` và `/products/[id]`; Buyer nhận hàng -> `/profile` hiển thị DinoPoint, VIP và ledger. Đã cấu hình fallback kênh `msedge` tránh phụ thuộc download Chromium từ CDN. |
| Backend Node Test Suite | In-memory Mock | `npm --prefix backend run test:node` | PASS | 720/720 tests pass (199 test suites, 17.7s). |
| Runtime Wiring & P0-9 Shipment Integration | Mock Runtime | `npx tsx --test test/platform/order-confirm-received.spec.ts` | PASS | 8/8 tests pass (Buyer/Admin/Shipment/Role). |
| Admin Shop Tiering Integration | Mock Runtime | `npx tsx --test test/platform/admin-shop-tier.spec.ts` | PASS | 10/10 tests pass (Admin/Audit/RBAC/Filter/Seller protection). |
| Buyer Loyalty & Concurrency Unit | Mock Runtime | `npx tsx --test test/platform/buyer-loyalty.spec.ts` | PASS | 10/10 tests pass (P0-1..3, Concurrency 4.9M/4.8M logic, 0-pts, Duplicate check, RBAC). |
| Backend Typecheck & Lint | TypeScript / ESLint | `npm --prefix backend run typecheck && npm --prefix backend run lint` | PASS | `tsc --noEmit` 0 errors, ESLint 0 errors, 0 warnings. |
| Backend Build | esbuild | `npm --prefix backend run build` | PASS | esbuild bundle 469.2KB thành công. |
| Frontend Typecheck & Lint | TypeScript / ESLint | `npm --prefix frontend run typecheck && npm --prefix frontend run lint` | PASS | `tsc --noEmit` 0 errors, ESLint 0 errors, 0 warnings. |
| Frontend Contract Check | OpenAPI Spec | `npm --prefix frontend run api:types:check` | PASS | Generated API types match backend OpenAPI. |
| Frontend Production Build | Next.js 16 | `npm --prefix frontend run build` | PASS | Next.js 16 optimized build thành công (31 routes). |

## An toàn và tình huống lỗi

- Phân quyền / dữ liệu nhạy cảm: Áp dụng RBAC nghiêm ngặt (`requireRole`). Seller tuyệt đối không thể tự nâng tier của shop mình qua `PATCH /seller/shop`. Buyer chỉ xem được điểm và lịch sử của chính mình qua `context.user_id`.
- Bảo mật Ledger (Row Level Security & Quyền truy cập): Bảng ledger `loyalty_point_transactions` được bảo vệ bằng migration forward-only `20261003120000_secure_loyalty_ledger`. Đã kiểm chứng thực tế trên PostgreSQL thật:
  - Role `anon` bị từ chối truy cập SELECT và INSERT với SQLSTATE `42501` (`permission denied for table loyalty_point_transactions`).
  - Role `authenticated` bị từ chối truy cập SELECT với SQLSTATE `42501`.
  - Backend mặc định (`postgres` / service role) đọc và ghi thành công.
- Retry, request trùng, race condition: Unique Index `uq_loyalty_transactions__order_earned` và cơ chế `FOR UPDATE` khóa dòng Buyer đảm bảo không mất cập nhật hoặc nhân đôi điểm khi 2 đơn hoàn tất đồng thời, đã kiểm chứng trên PostgreSQL thật (11/11 tests pass).
- Hủy, hoàn tiền, rollback toàn diện luồng Order: Đã kiểm chứng qua `PgCheckoutService.confirmReceived` trên PostgreSQL thật: khi phát sinh lỗi trong quá trình ghi nhận loyalty (mô phỏng sự cố ledger/database), toàn bộ transaction bị hủy (`ROLLBACK`). Trạng thái Order vẫn giữ nguyên `SHIPPING`, Shipment vẫn giữ nguyên `SHIPPING`, không có bản ghi lịch sử COMPLETED, số dư `total_spent` và `loyalty_points` của Buyer không thay đổi, và bảng ledger có 0 bản ghi.

## Việc còn lại, phần chưa kiểm chứng và blocker

- Việc đã hoàn thành:
  - [x] Bước 0: Sửa lỗi nền wiring `confirmReceived` và kiểm tra quyền hoàn tất đơn (P0-9).
  - [x] Đợt A: Triển khai migration `shops.tier` & override metadata, Admin tier API, catalog filter và `TierBadge` UI (ở cả `ProductCard` và `ProductDetailScreen`).
  - [x] Đợt B: Triển khai migration `app_users` + `loyalty_point_transactions`, migration forward-only `20261003120000_secure_loyalty_ledger`, core hook tích điểm, bảo mật RLS ledger, Buyer loyalty API, Profile UI `BuyerLoyaltyCard`.
  - [x] Kiểm thử PostgreSQL thật: Bộ kiểm thử `tests/db/tiering-loyalty.integration.test.ts` đạt 11/11 tests PASS trên remote PostgreSQL thật, kiểm chứng cả rollback Order + Shipment và từ chối quyền anon/authenticated.
  - [x] Kiểm thử tích hợp component frontend `frontend/test/e2e-tiering-loyalty-lifecycle.spec.tsx` đạt 7/7 tests PASS (Vitest jsdom + Testing Library).
  - [x] Tạo kịch bản Playwright Browser E2E `frontend/e2e/tiering-loyalty-live.spec.ts` cho 2 hành trình thực tế.
- Phần chưa kiểm chứng / Blocker thực tế:
  - [ ] **Chưa có database test độc lập chuyên biệt**: Database Supabase hiện tại (`putywqmxtjttfdezlswf`) là môi trường dùng chung giữa dev, demo seed accounts và các nhánh tính năng khác. Các kiểm thử PostgreSQL được chạy trên schema cô lập tạm thời (`p5_loyalty_<uuid>`), **chưa đáp ứng tiêu chí một database/project test độc lập hoàn toàn với production**. Tuyệt đối không tiết lộ credentials trong báo cáo và giữ trạng thái nghiệm thu từng phần.
  - [ ] **Full backend test:vitest chưa chạy pass đầy đủ**: Khi chạy toàn bộ 60 test suites, có 7 suites không đạt (53 passed, 7 failed, 10 tests failed). Blocker cụ thể:
    1. Các test catalog (`catalog-db`, `catalog-benchmark`, `catalog-hardening`) query trực tiếp schema `public` mà chưa có cột `shops.tier` vì migration chưa được áp dụng lên schema chung.
    2. Các test kiểm tra số lượng bảng (`schema-smoke`, `t3-migration-rebuild`) fail vì schema chung đang có 27 bảng do các nhánh khác đã thêm bảng flash sale, khác với mốc 24 bảng của T2.
  - [ ] **Chưa áp dụng migration lên môi trường production**: Các migration `20261003100000_shop_tiering`, `20261003110000_buyer_loyalty`, `20261003120000_secure_loyalty_ledger` chưa được deploy lên production hay schema `public`.
  - [ ] **Đợt C (Ngoài phạm vi)**: Đánh giá tự động PREFERRED và composite cursor search boost — Chưa triển khai theo quyết định phạm vi được duyệt.
  - [ ] **Đổi điểm DinoPoint khi thanh toán** (P0-5: chỉ tích lũy, chưa đổi thưởng).
  - [ ] **Thu hồi điểm khi hoàn tiền / trả hàng** (P0-7).

## Nhật ký cập nhật

### 2026-10-02 (Làm rõ đánh giá nghiệm thu, bổ sung Playwright E2E, Rollback Order thực tế & Forward-only Migration)

- **Làm rõ phân loại runner frontend**:
  - `frontend/test/e2e-tiering-loyalty-lifecycle.spec.tsx` được xác định chính xác là **Kiểm thử tích hợp Component Frontend (React Testing Library + Vitest jsdom)**. Runner: Vitest jsdom; Lệnh chạy: `npm --prefix frontend test -- test/e2e-tiering-loyalty-lifecycle.spec.tsx`; Cách mock: mock feature flags `useMock: () => true`, mock Next.js router/images, mock auth context và mock response `buyerApi.getLoyaltySummary`.
  - Bổ sung kịch bản **Playwright Browser E2E thực tế** tại `frontend/e2e/tiering-loyalty-live.spec.ts` cho 2 hành trình: Admin đổi hạng Shop -> Catalog & ProductDetail hiển thị badge; Buyer nhận hàng -> Profile cập nhật DinoPoint, hạng VIP và lịch sử giao dịch. Hỗ trợ chạy trực tiếp trên browser local (`--channel=msedge`).
- **Báo cáo trung thực kết quả Full Backend test:vitest & Blocker thực tế**:
  - Đã thực thi toàn bộ `npm run test:vitest` qua remote Supabase pooler (thời gian chạy thực tế 1340.9s ~ 22.3 phút).
  - Kết quả: 53 test files PASS, 7 test files FAIL (334 passed, 10 failed).
  - Ghi nhận nguyên nhân gốc rễ (blocker thực tế): Schema `public` trên database dùng chung chưa chạy migration `20261003100000_shop_tiering` khiến các query catalog không tìm thấy cột `s.tier`, và các bảng flash sale từ nhánh khác làm lệch số lượng bảng kiểm tra freeze của T2.
- **Xác minh môi trường Supabase & Tính độc lập**:
  - Database được cấu hình qua project `putywqmxtjttfdezlswf`.
  - Xác nhận rõ trong báo cáo: Việc chạy trên schema cô lập tạm thời (`p5_loyalty_*`) trong cùng một database dùng chung **chưa đáp ứng tiêu chí một project/database test độc lập**. Đánh dấu chưa đạt tiêu chí database test độc lập và giữ nguyên trạng thái nghiệm thu từng phần.
- **Tách Migration Forward-Only & Kiểm chứng bảo mật 2 chiều**:
  - Khôi phục `20261003110000_buyer_loyalty/migration.sql` về trạng thái ban đầu để tránh sai lệch checksum.
  - Tạo migration forward-only mới `backend/prisma/migrations/20261003120000_secure_loyalty_ledger/migration.sql` chứa lệnh bật RLS và thu hồi quyền `REVOKE ALL ON TABLE loyalty_point_transactions FROM PUBLIC, anon, authenticated;`.
  - Bổ sung test kiểm chứng quyền truy cập trên PostgreSQL thật: Role `anon` và `authenticated` bị từ chối (SQLSTATE 42501), trong khi backend service role vẫn truy cập thành công.
- **Chứng minh Rollback nguyên tử luồng Order hoàn chỉnh**:
  - Mở rộng `backend/tests/db/tiering-loyalty.integration.test.ts` (11/11 tests PASS) đi qua trực tiếp `PgCheckoutService.confirmReceived`.
  - Chứng minh khi phát sinh lỗi loyalty: Order (`SHIPPING`), Shipment (`SHIPPING`), số dư chi tiêu/điểm Buyer và bảng ledger cùng rollback đồng thời, không có trạng thái mồ côi nào được lưu vào database.

- Đã làm:
  - **Prisma Validate**: Chạy `npm --prefix backend exec prisma validate` thành công (`The schema at prisma\schema.prisma is valid 🚀`).
  - **Kiểm thử PostgreSQL thật độc lập**: Bổ sung `backend/tests/db/tiering-loyalty.integration.test.ts` chạy trên remote PostgreSQL thật (Supabase test database) với schema cô lập `p5_loyalty_<uuid>`. Kiểm chứng thành công:
    - Verifies shops table has tier and override metadata columns.
    - Verifies app_users table has buyer_tier, total_spent, and loyalty_points.
    - Verifies loyalty_point_transactions table, RLS, and unique partial index.
    - Duplicate prevention & idempotency via `ON CONFLICT DO NOTHING`.
    - Sub-10.000đ order with 0 points while advancing total_spent and preventing duplicate.
    - Concurrency under real PostgreSQL `SELECT FOR UPDATE` serialization (mốc 4.9M: 10pts và 20pts; mốc 4.8M: 10pts và 10pts).
    - Transaction Rollback Integrity (rollback hoàn toàn số dư và ledger khi có lỗi sau).
    - Kết quả: 8/8 tests PASS trong 92.46s.
  - **Bảo mật Ledger Migration**: Bổ sung `ENABLE ROW LEVEL SECURITY` và `REVOKE ALL ON TABLE loyalty_point_transactions FROM PUBLIC, anon, authenticated;` vào migration `20261003110000_buyer_loyalty/migration.sql`.
  - **Catalog Filter UI & ProductDetail Badge**:
    - Bổ sung `TierBadge` hiển thị trên `ProductDetailScreen` (cạnh nhãn Chính hãng Dino).
    - Bổ sung chip lọc theo hạng shop ("Tất cả shop", "Dino Mall", "Shop Yêu thích") trên thanh công cụ của `CatalogListScreen`, đồng bộ query `shop_tier`.
  - **E2E Lifecycle Test**: Bổ sung `frontend/test/e2e-tiering-loyalty-lifecycle.spec.tsx` (7/7 tests PASS):
    - Admin đổi hạng -> ProductCard và ProductDetail hiển thị đúng badge MALL / PREFERRED; ProductCard STANDARD không hiển thị badge.
    - CatalogListScreen hiển thị UI bộ lọc theo hạng và kích hoạt đúng truy vấn khi tương tác.
    - Buyer nhận hàng (`confirmReceived`) -> đơn chuyển COMPLETED -> Profile hiển thị điểm DinoPoint, tiến trình VIP và lịch sử giao dịch.
    - Buyer chi tiêu vượt 5.000.000đ đạt hạng VIP với quyền lợi x2 DinoPoint.
  - **Cập nhật tài liệu**: Cập nhật `docs/feature/03-tiering-loyalty.md` phản ánh đúng bằng chứng thực tế, ghi rõ phân biệt mock vs database thật, sửa cách gọi link tạo PR, bỏ đề cập ElasticSearch.

### 2026-10-02 (Đợt B - Hoàn tất Phân hạng Buyer VIP, Ledger Tích điểm DinoPoint & Bàn giao)

- Đã làm:
  - Tạo migration `20261003110000_buyer_loyalty` bổ sung `buyer_tier`, `total_spent`, `loyalty_points` vào `app_users` và tạo bảng `loyalty_point_transactions`.
  - Tạo unique index `uq_loyalty_transactions__order_earned` cho phép chống duplicate tuyệt đối ở tầng cơ sở dữ liệu.
  - Hiện thực hóa module tính toán `loyalty.types.ts` bằng số học `BigInt` cents, bảo đảm zero floating point.
  - Tích hợp `LoyaltyService` vào `PgCheckoutService.persistTransition`: khóa hàng Buyer `FOR UPDATE`, thực thi nguyên tử cùng transaction chuyển đơn sang `COMPLETED`.
  - Triển khai các API `GET /api/v1/buyer/loyalty` và `GET /api/v1/buyer/loyalty/history`, cập nhật OpenAPI spec và sinh mã types frontend.
  - Xây dựng component `BuyerLoyaltyCard` tích hợp vào màn hình `ProfileScreen` hiển thị hạng thành viên, số dư điểm, thanh tiến trình chi tiêu lên VIP và lịch sử giao dịch điểm.
  - Viết bộ kiểm thử tích hợp backend `backend/test/platform/buyer-loyalty.spec.ts` (10/10 tests pass) bao gồm 2 ca concurrency race condition, đơn < 10k VND 0 điểm, kiểm thử duplicate trực tiếp tại database/service level.
  - Viết kiểm thử frontend `frontend/test/buyer-loyalty-card.spec.tsx` (2/2 tests pass).
  - Toàn bộ 720 tests backend (199 suites) và 326 tests frontend (67 files) đạt 100% PASS; typecheck, lint, build backend/frontend và contract check đều 100% PASS.

### 2026-10-02 (Đợt A - Hoàn tất Phân hạng Shop & Quản lý Admin)

- Đã làm:
  - Tạo migration `20261003100000_shop_tiering` bổ sung `tier`, `tier_override`, `tier_override_reason`, `tier_overridden_at`, `tier_override_by`.
  - Triển khai endpoint `PATCH /admin/shops/:id/tier` (RBAC ADMIN, ghi audit log `SHOP_TIER_UPDATE`).
  - Hỗ trợ lọc shop theo `tier` tại `GET /admin/shops`.
  - Hỗ trợ lọc sản phẩm theo `shop_tier` và trả về `shop_tier` tại public catalog endpoints (`GET /products`, `GET /products/:id`).
  - Cập nhật OpenAPI spec và sinh mã types cho frontend (`npm run api:types`).
  - Tạo component `TierBadge` hiển thị nhãn MALL và Yêu thích (PREFERRED), tích hợp vào `ProductCard` và `AdminShopsScreen`.
  - Thêm cột Hạng, bộ lọc và dialog "Đổi hạng" trên màn hình Admin Quản lý Shop (`AdminShopsScreen`).
  - Viết bộ test tích hợp backend `admin-shop-tier.spec.ts` (10/10 tests pass) và frontend test `admin-portal.spec.ts` (324/324 tests pass).
  - Kiểm tra lint, typecheck, api:types:check, backend build và frontend build đều 100% PASS.
  - Tiếp theo: Triển khai Đợt B (Buyer loyalty VIP, DinoPoint ledger, atomic completion hook và Profile UI).

### 2026-10-02 (Bước 0 - Hoàn tất sửa wiring confirmReceived & P0-9)

- Đã làm:
  - Đấu nối `confirmReceived` trong `createRuntimeApp` (`backend/src/platform/http/app.ts`) và `order-routes.ts`.
  - Chốt quyết định P0-9 với Chủ dự án: Order phải ở `SHIPPING`, Shipment bắt buộc tồn tại (`409 SHIPMENT_REQUIRED`), Admin phải có lý do (`422 REASON_REQUIRED`), chuyển trạng thái Shipment sang `DELIVERED` hợp lệ trong cùng transaction.
  - Hiện thực hóa logic kiểm tra và cập nhật Shipment trong `PgCheckoutService.confirmReceived`.
  - Tạo bộ kiểm thử tích hợp qua `createRuntimeApp` tại `backend/test/platform/order-confirm-received.spec.ts` (8/8 tests pass).
  - Kiểm tra toàn bộ 700 tests backend node, typecheck và lint đạt 100% PASS.
  - Tiếp theo: Triển khai Đợt A (Shop tiering, Admin tier management, catalog filter và UI TierBadge).

### 2026-10-02 (Khởi tạo kế hoạch & báo cáo)

- Đã làm:
  - Kéo code mới nhất từ nhánh `dev` (commit `0811358 docs: add feature reporting guide`).
  - Tạo nhánh làm việc `codex/tiering-loyalty`.
  - Hoàn thiện kế hoạch chi tiết, loại bỏ floating point, thiết kế transaction nguyên tử chống duplicate bằng `ON CONFLICT DO NOTHING RETURNING`, đối soát state machine và lập bảng 9 quyết định P0.
  - Khởi tạo file báo cáo tiến độ `docs/feature/03-tiering-loyalty.md`.
