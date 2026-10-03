# Báo cáo: Phân cấp Buyer & Shop (Tiering & Loyalty)

## Owner và trạng thái

- Owner: Chưa xác định — cần chủ dự án xác nhận thành viên phụ trách.
- Người phối hợp: Chưa xác định.
- Trạng thái: Đang review / Nghiệm thu từng phần. Code A/B/C đã có; phần C hiện được kích hoạt theo yêu cầu, chưa chạy định kỳ.
- Cập nhật lần cuối: 2026-10-02.
- Nhánh / PR / commit: `codex/tiering-loyalty`; commit nền đối chiếu `ca118a1`.
- Các commit triển khai: `56780a1` (wiring), `bb8b717` (A), `7e12e4b` (B), `6e09b39`, `445ffec` (kiểm chứng bổ sung), `ca118a1` (C).
- [Nhánh GitHub](https://github.com/lwd7071/e-commerce-platform/tree/codex/tiering-loyalty). Chưa xác minh PR đã tạo; đường dẫn `/pull/new/` chỉ là trang tạo PR.

## Mục tiêu và phạm vi

Buyer và Shop có hai cơ chế phân hạng riêng: Buyer tự lên VIP khi đơn hoàn tất được ghi nhận; Shop được Admin cấp hạng hoặc được service xét lên/xuống PREFERRED khi Admin gọi API đánh giá.

| Phần | Mục tiêu / kế hoạch | Hiện trạng code |
|---|---|---|
| Bước 0 | Nối xác nhận nhận hàng và kiểm tra Shipment | Handler đã nối trong runtime; yêu cầu Order SHIPPING, Shipment tồn tại và có trạng thái SHIPPING hoặc DELIVERED |
| A — Shop | STANDARD / PREFERRED / MALL; Admin quản lý, audit, badge và bộ lọc | Có migration, API đổi hạng, metadata override, UI Admin, badge danh sách/chi tiết và bộ lọc catalog |
| B — Buyer | STANDARD / VIP, tự lên VIP từ 5 triệu, tích DinoPoint | Có hook transaction, ledger chống trùng, API summary/history và thẻ thành viên Profile |
| C — Shop tự xét | Xét PREFERRED và ưu tiên hạng trong catalog mặc định | Có service và API Admin kích hoạt xét; chưa có cron. Catalog mặc định ưu tiên MALL → PREFERRED → STANDARD |

- Phạm vi A/B và P0-1 đến P0-8 được chủ dự án đồng ý trong phiên làm việc. P0-9 được mô tả riêng bên dưới.
- Chủ dự án yêu cầu bổ sung cơ chế tự xét Shop; ngưỡng và cách vận hành C dưới đây là hành vi code hiện tại, không thay thế CR Approved. Chưa tìm thấy CR riêng cho tiering/loyalty trong `docs/spec/changes/` khi đối chiếu.
- Ngoài phạm vi: backfill đơn cũ, đổi điểm/voucher, refund/thu hồi điểm, ví/escrow và chat.
- Chưa triển khai: lịch chạy tự xét định kỳ, API bỏ override và capability `loyalty` riêng.

## Đã thực hiện

### Bước 0 — Xác nhận nhận hàng

- Runtime nối `confirmReceived`: `backend/src/platform/http/app.ts`, `backend/src/platform/http/routes/order-routes.ts`.
- `PgCheckoutService.confirmReceived` khóa Order, kiểm tra ownership, yêu cầu Order `SHIPPING`, khóa Shipment và cập nhật Shipment `SHIPPING` → `DELIVERED` hoặc giữ `DELIVERED`.
- Thiếu Shipment trả `409 SHIPMENT_REQUIRED`; trạng thái khác trả `409 SHIPMENT_INVALID_STATE`. Admin thiếu lý do trả `422 REASON_REQUIRED`.
- `persistTransition` cập nhật Order, lịch sử, loyalty, audit Admin và notification trong transaction của caller.
- Bằng chứng: `backend/src/modules/checkout/services/pg-checkout.service.ts`, `backend/test/platform/order-confirm-received.spec.ts`.

### A — Hạng Shop do Admin quản lý

- Migration `backend/prisma/migrations/20261003100000_shop_tiering/migration.sql` thêm `tier` và metadata override.
- `PATCH /api/v1/admin/shops/:id/tier` nhận `tier`, `reason`; service kiểm tra UUID/hạng/lý do, cập nhật hạng thủ công và ghi moderation/audit trong transaction.
- `GET /api/v1/admin/shops` hỗ trợ lọc `tier`; catalog `GET /api/v1/products` hỗ trợ `shop_tier`, trả hạng trong danh sách/chi tiết.
- Frontend có `TierBadge`, badge tại ProductCard/ProductDetail, bộ lọc Catalog và dialog đổi hạng Admin.
- Bằng chứng: `backend/src/platform/http/routes/admin-routes.ts`, `backend/src/modules/moderation/services/moderation.service.ts`, `backend/src/modules/moderation/repositories/pg-target.repository.ts`, `frontend/src/components/ui/tier-badge.tsx`, `frontend/src/features/admin/admin-shops-screen.tsx`, `frontend/src/features/catalog/`.

### B — Buyer VIP và DinoPoint

- Migration `20261003110000_buyer_loyalty` thêm `buyer_tier`, `total_spent`, `loyalty_points` và ledger; `20261003120000_secure_loyalty_ledger` bật RLS, revoke quyền PUBLIC/anon/authenticated.
- Tiền đủ điều kiện là `max(subtotal - discount_amount, 0)`, không tính ship. Tính bằng BigInt cents trong module loyalty.
- Điểm mỗi đơn: `floor(eligible_amount / 10000) × hệ số hạng trước khi ghi nhận`; STANDARD x1, VIP x2. Tổng mới đạt 5.000.000 VNĐ thì hạng mới là VIP. Đơn đưa Buyer vượt ngưỡng vẫn dùng hệ số cũ.
- Caller khóa Order trước; loyalty khóa Buyer `FOR UPDATE`. Insert ledger dùng partial unique index và `ON CONFLICT ... DO NOTHING RETURNING`; chỉ cập nhật tổng nếu có ledger mới. Đơn 0 điểm vẫn có ledger và tăng chi tiêu.
- `GET /api/v1/buyer/loyalty` trả `tier`, `total_spent`, `loyalty_points`, `vip_threshold`, `points_multiplier`, `next_tier`.
- `GET /api/v1/buyer/loyalty/history` dùng `page`, `limit` (OFFSET), trả `items`, `page`, `limit`, `total`; chưa dùng cursor như kế hoạch ban đầu.
- Profile Buyer có `BuyerLoyaltyCard`. Frontend types có tại `frontend/src/lib/api/generated/openapi.ts`.
- Bằng chứng: `backend/src/modules/loyalty/domain/loyalty.types.ts`, `backend/src/modules/loyalty/services/loyalty.service.ts`, `backend/src/platform/http/routes/buyer-routes.ts`, `frontend/src/features/profile/loyalty-card.tsx`.

### C — Xét PREFERRED theo yêu cầu và ưu tiên catalog

- `ShopTierEvaluationService` dùng mặc định: ≥20 đơn COMPLETED, rating trung bình ≥4,5 và ≥5 review VISIBLE. Thống kê toàn bộ dữ liệu, không giới hạn 30 ngày.
- Đủ cả ba điều kiện: STANDARD → PREFERRED. Không đủ: PREFERRED → STANDARD ngay khi xét; chưa có ngưỡng hạ 4,0 hoặc thời gian chờ.
- Bỏ qua Shop MALL và `tier_override = true` khi đọc Shop. Batch chỉ chọn ACTIVE; xét một Shop theo ID chưa kiểm tra ACTIVE.
- `POST /api/v1/admin/shops/evaluate-tiers` yêu cầu ADMIN. Body có thể chứa `shop_id` và `criteria`; không có `shop_id` thì xét toàn bộ ACTIVE. Không có scheduler hoặc hook tự chạy sau đơn/review.
- Catalog mặc định xếp MALL → PREFERRED → STANDARD, tiếp theo `created_at DESC`, `product_id ASC`. Sort tường minh giữ thứ tự theo giá/mới nhất.
- Catalog hiện mã hóa cursor chứa offset, không phải cursor chứa khóa hạng/thời gian/ID. Dữ liệu thay đổi có thể làm dịch chuyển kết quả giữa các trang.
- Bằng chứng: `backend/src/modules/shop/services/shop-tier-evaluation.service.ts`, `backend/src/platform/http/routes/admin-routes.ts`, `backend/src/platform/http/app.ts`, `backend/src/modules/catalog/repositories/pg-catalog.repository.ts`, `backend/test/platform/shop-tier-evaluation.spec.ts`.

## Thiết kế / quyết định kỹ thuật

- P0-9: Shipment phải tồn tại, Order phải SHIPPING; Shipment chỉ chấp nhận SHIPPING hoặc DELIVERED. Admin cần lý do. Đây là hành vi `confirmReceived` hiện tại cho cả Buyer/Admin; điều kiện của endpoint transition khác cần đối chiếu riêng, không suy rộng.
- VIP tự nâng theo tổng chi tiêu đơn được ghi nhận, không tự hạ theo thời gian. Shop MALL do Admin cấp; hệ thống đánh giá không tự cấp MALL.
- DEFAULT giúp insert/dữ liệu cũ nhận hạng mặc định, nhưng không chứng minh toàn bộ tương thích: truy vấn mới cần migration trước khi chạy. Không backfill tổng/điểm từ đơn cũ.
- Migration forward-only; chưa xác minh lại trạng thái apply database ở lượt cập nhật tài liệu này.
- Khác biệt cần theo dõi so với kế hoạch:
  - Ledger thực tế chỉ lưu user, điểm, order tham chiếu, reason và thời gian; chưa có `eligible_amount`/`multiplier` để đối soát độc lập.
  - FK ledger hiện dùng CASCADE với user và SET NULL với order; chưa phải RESTRICT như thiết kế mong muốn. Chưa có constraint bắt buộc order cho ORDER_COMPLETED hoặc giới hạn reason.
  - API đổi hạng chưa hỗ trợ `clear_override`; không mô tả chức năng bỏ override là đã có.
  - Evaluation C dùng nhiều query qua pool, chưa có transaction/audit nguyên tử hoặc khóa Shop; không khẳng định bảo vệ MALL/override trước mọi race condition.
  - `criteria` được route ép kiểu, chưa có validation đầy đủ các ngưỡng. Chưa có cron, UI kích hoạt đánh giá hoặc capability loyalty riêng.
  - Việc xác minh hồ sơ chính hãng là quy trình Admin, API hiện chỉ kiểm tra tier/lý do, không tự xác thực chứng từ.

## Kiểm tra và kết quả

Lượt cập nhật tài liệu này chỉ đọc code/migration/test và lịch sử Git; không chạy lại test, build, migration hoặc browser. Các số liệu dưới đây là kết quả đã được ghi trong báo cáo/nhật ký trước, không phải xác nhận chạy mới.

| Kiểm tra | Lệnh / CI job | Kết quả | Bằng chứng / ghi chú |
|---|---|---|---|
| Đối chiếu A/B/C hiện tại | Đọc source và `git log` | Đã đối chiếu | Commit nền `ca118a1`; các đường dẫn ở mục Đã thực hiện |
| PostgreSQL feature A/B/C | `npm --prefix backend exec vitest run tests/db/tiering-loyalty.integration.test.ts` | PASS theo nhật ký trước | 17/17, 247,2s; schema cô lập trên database dùng chung, không phải project test độc lập |
| Evaluation C unit/mock | `npm --prefix backend exec tsx --test test/platform/shop-tier-evaluation.spec.ts` | PASS theo nhật ký trước | 7/7; chưa chạy lại |
| Frontend component | `npm --prefix frontend test -- test/e2e-tiering-loyalty-lifecycle.spec.tsx` | PASS theo nhật ký trước | 7/7, Vitest/jsdom và mock; không phải browser E2E |
| Browser E2E | `npm --prefix frontend run test:e2e -- e2e/tiering-loyalty-live.spec.ts` | Chưa nghiệm thu | Nhật ký ghi 2 skipped khi thiếu live env; có spec không đồng nghĩa hành trình đã pass |
| Full backend Vitest | `npm --prefix backend run test:vitest` | FAIL theo nhật ký trước | 53/60 files, 334/344 tests pass; nguyên nhân báo cáo gồm public thiếu tier và số bảng thay đổi. Chưa có log giải thích đầy đủ cả 7 files |
| Node/frontend suites, lint/typecheck/build, Prisma, API types | Scripts trong `CONTRIBUTING.md` và package manifests | Kết quả lịch sử | Số lượng/timing thuộc từng lượt cũ; chưa xác minh lại sau commit C |

## An toàn và tình huống lỗi

- API loyalty lấy user từ auth context; endpoint Admin có RBAC. Seller không được sửa tier qua endpoint hồ sơ Shop.
- Ledger có partial unique index và RLS/revoke. Nhật ký trước ghi test quyền anon/authenticated; lượt này không kết nối database để xác nhận môi trường triển khai.
- Khi lỗi loyalty trong transaction hoàn tất đơn, transaction phải rollback cả Order/Shipment/lịch sử/số dư/ledger; test PostgreSQL có kịch bản này.
- Chưa có hoàn/thu hồi điểm khi refund. Chưa có cơ chế đổi điểm.
- Rủi ro C cần review: race giữa Admin đổi hạng và evaluation; chưa audit thao tác evaluation; single-shop không guard ACTIVE; ngưỡng tùy chỉnh chưa validation đầy đủ; offset pagination trên dữ liệu biến động.

## Việc còn lại và blocker

- [ ] Hoàn thiện/ghi nhận CR và tiêu chí C được duyệt, đối chiếu các khác biệt schema/API ở trên — Owner: Chưa xác định — Dự kiến: Chưa xác định.
- [ ] Chốt C chỉ kích hoạt theo yêu cầu hay chạy định kỳ; nếu định kỳ cần lịch và cơ chế vận hành — Owner: Chưa xác định — Dự kiến: Chưa xác định.
- [ ] Review bảo vệ hạng thủ công, validation, audit và concurrency của evaluation — Owner: Chưa xác định — Dự kiến: Chưa xác định.
- [ ] Cung cấp database test độc lập và migration tương ứng trước nghiệm thu toàn bộ — Owner: Chưa xác định — Dự kiến: Chưa xác định.
- [ ] Chạy hai hành trình Playwright thật, không skip; chạy lại gates trên phiên bản cuối — Owner: Chưa xác định — Dự kiến: Chưa xác định.
- Blocker theo báo cáo trước: database dùng chung, full Vitest chưa đạt, browser E2E thiếu live env. Trạng thái môi trường hiện tại chưa được xác minh lại.

## Nhật ký cập nhật

### 2026-10-02 — Đồng bộ tài liệu A/B/C với code

- Đã làm: chuẩn hóa báo cáo theo mẫu `docs/feature/README.md`; bổ sung bảng phạm vi A/B/C và đối chiếu code tại `ca118a1`.
- Kiểm tra: đọc runtime, evaluation service, catalog, loyalty, migration và test; không chạy lại quality gates hoặc database.
- Làm rõ: C có API xét theo yêu cầu, chưa tự chạy định kỳ; xét toàn thời gian; history dùng page/offset; ledger/override/capability còn khác kế hoạch.
- Tiếp theo / blocker: giữ nghiệm thu từng phần; các việc còn lại được liệt kê ở trên.

> Nhật ký dưới đây được giữ nguyên từ các lượt trước. Các tuyên bố PASS/Hoàn tất là ghi nhận lịch sử của người cập nhật; khi khác mô tả hiện tại, ưu tiên các mục đã đối chiếu ở đầu báo cáo. “E2E” của file trong frontend/test là component test; các khẳng định “Zero Breaking Changes” hoặc “chống trùng tuyệt đối” không phải kết luận của lượt này.


### 2026-10-02 (Đợt C - Đánh giá tự động PREFERRED, Search Boost MALL & Admin evaluate-tiers)

- Đã làm:
  - Tạo `ShopTierEvaluationService` (`backend/src/modules/shop/services/shop-tier-evaluation.service.ts`): Đánh giá tự động PREFERRED cho shop, miễn trừ P0-8 (MALL exempt, `tier_override` exempt). Điều kiện: >= 20 đơn COMPLETED, rating trung bình >= 4.5 (chỉ tính review `VISIBLE`), >= 5 review VISIBLE. Hỗ trợ đánh giá 1 shop hoặc batch tất cả shop ACTIVE.
  - Cập nhật `PgProductRepository.queryPublic`: Search Boost trong default sort (`CASE WHEN s.tier = 'MALL' THEN 2 WHEN s.tier = 'PREFERRED' THEN 1 ELSE 0 END DESC`). Khi sắp xếp cụ thể (`price_asc`, `price_desc`, `created_at_desc`), tier không can thiệp vào thứ tự.
  - Thêm endpoint `POST /api/v1/admin/shops/evaluate-tiers` (RBAC ADMIN) vào `admin-routes.ts` và đấu nối `ShopTierEvaluationService` vào `app.ts`.
  - Viết bộ kiểm thử mock `backend/test/platform/shop-tier-evaluation.spec.ts` (7/7 tests PASS).
  - Bổ sung Suite 5 vào `backend/tests/db/tiering-loyalty.integration.test.ts` (6 tests Đợt C trên PostgreSQL thật): promote, skip MALL, skip override, demote, HIDDEN reviews, Search Boost default vs price_asc. Tổng 17/17 tests PASS (247.2s).
  - Sửa lint warning `@typescript-eslint/no-unused-vars` trong mock pool và cải thiện mock review filtering chính xác theo `product.shop_id`.
  - Toàn bộ quality gates: Backend typecheck 0 errors, backend lint 0 errors 0 warnings, frontend typecheck 0 errors, frontend lint 0 errors.

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
