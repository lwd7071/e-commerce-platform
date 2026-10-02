# Báo cáo: Phân cấp Buyer & Shop (Tiering & Loyalty)

## Owner và trạng thái

- Owner: NVCuong3112
- Người phối hợp:
  - Người 1 (Auth & User Platform / Platform Lead): Cấu trúc bảng `app_users`, `admin_logs`, auth context, RBAC middleware.
  - Người 2 (Shop & Seller Operations): Cấu trúc bảng `shops`, giao diện quản lý Shop trên Admin Portal (`AdminShopsScreen`).
  - Người 3 (Catalog & Search): Tích hợp `shop_tier` vào truy vấn Catalog, bộ lọc `shop_tier`, component `ProductCard`, `ProductDetailScreen`, `CatalogListScreen`.
  - Người 4 (Checkout & Orders): Tích hợp hook hoàn tất đơn hàng `confirmReceived`, xác minh trạng thái `shipments` theo P0-9.
- Trạng thái: Đang hoàn thiện / Nghiệm thu sau merge (Đợt A & Đợt B đã merge vào `origin/dev` và xác minh PASS; Đợt C đã hoàn thiện trên nhánh riêng và đang chờ merge)
- Cập nhật lần cuối: 2026-10-02
- Nhánh / PR / commit:
  - Nhánh cập nhật báo cáo: `docs/tiering-loyalty-report` (tạo từ `origin/dev` tại commit `3d92000`).
  - Commit dev được kiểm chứng sau merge: `3d92000` (chứa merge commit `5301b70` tích hợp Đợt A và Đợt B đến commit `6e09b39`).
  - Nhánh chứa mã nguồn Đợt C: `codex/tiering-loyalty` (commit `ca118a1`), đang chờ tạo PR merge vào `dev`.

## Mục tiêu và phạm vi

- Mục tiêu: Xây dựng hệ thống phân hạng minh bạch, an toàn và tinh gọn cho Shop (`STANDARD`, `PREFERRED`, `MALL`) và Buyer (`STANDARD`, `VIP`) kèm cơ chế tích lũy điểm DinoPoint chính xác tuyệt đối (zero floating point) và sổ cái giao dịch (ledger) chống duplicate, an toàn đồng thời khi đơn hàng hoàn tất.
- Trong phạm vi:
  - **Bước 0 (Nền tảng)**: Đấu nối runtime wiring `confirmReceived` trên `createRuntimeApp` và hoàn thiện kiểm tra điều kiện Shipment (P0-9).
  - **Phần A (Phân hạng Shop & Admin Tiering)**: Bổ sung `tier` (`STANDARD`, `PREFERRED`, `MALL`) và metadata override vào bảng `shops`; cung cấp API Admin duyệt đổi hạng thủ công `PATCH /api/v1/admin/shops/:id/tier` kèm bắt buộc ghi lý do và audit log nguyên tử (`SHOP_TIER_UPDATE`); hỗ trợ lọc catalog theo `shop_tier`; hiển thị huy hiệu `TierBadge` (MALL, Yêu thích) trên `ProductCard` và `ProductDetailScreen`; tích hợp bộ lọc hạng Shop trên `CatalogListScreen` và giao diện quản lý trên `AdminShopsScreen`.
  - **Phần B (Phân cấp Buyer VIP & DinoPoint Ledger)**: Phân hạng Buyer (`STANDARD`, `VIP` ngưỡng 5.000.000 VNĐ chi tiêu tích lũy `total_spent`); cơ chế tích lũy điểm DinoPoint (10.000 VNĐ = 1 điểm cho Standard, nhân đôi x2 điểm cho VIP); lưu vết sổ cái `loyalty_point_transactions` kèm RLS; cơ chế chống duplicate qua unique index và `ON CONFLICT DO NOTHING`; khóa dòng Buyer `SELECT ... FOR UPDATE` bảo đảm an toàn đồng thời; bảo toàn tính toàn vẹn rollback transaction; cung cấp API Buyer `GET /api/v1/buyer/loyalty` và component `BuyerLoyaltyCard` trong trang cá nhân Buyer.
  - **Phần C (API Xét hạng & Ưu tiên tìm kiếm)**: Dịch vụ `ShopTierEvaluationService` tự động đánh giá tiêu chuẩn thăng hạng PREFERRED dựa trên doanh số và đơn hoàn tất (chỉ hạ hạng nếu không có override từ Admin); ưu tiên hiển thị thứ tự sản phẩm theo hạng Shop (`MALL` > `PREFERRED` > `STANDARD`) trong truy vấn Catalog; endpoint kích hoạt xét hạng thủ công `POST /api/v1/admin/shops/evaluate-tiers`. *(Lưu ý: Mã nguồn Phần C hiện đã hoàn thành tại commit `ca118a1` trên nhánh `codex/tiering-loyalty`, đang chờ nghiệm thu và merge vào `dev`)*.
- Ngoài phạm vi:
  - Không backfill dữ liệu cũ của các đơn hàng trước thời điểm triển khai (P0-6).
  - Đổi điểm DinoPoint trừ tiền checkout hoặc voucher đổi thưởng (P0-5: hiện tại hệ thống chỉ triển khai tích lũy và hiển thị điểm; **chưa triển khai luồng đổi thưởng**).
  - Thu hồi điểm / hoàn điểm khi hoàn tiền, trả hàng hoặc hủy đơn sau khi đã hoàn tất (P0-7: **chưa triển khai**).
  - Cơ chế scheduler chạy định kỳ: **Chưa có cron runner hoặc background daemon chạy tự động theo lịch**. Cơ chế xét hạng hiện tại chỉ được kích hoạt thủ công qua API Admin.
  - Không tự ý mở rộng sang Wallet (ví người bán), Shipping (giao vận thật), Chat realtime hoặc Flash Sale.

## Đã thực hiện

- **Bước 0: Đấu nối runtime wiring và kiểm tra điều kiện Shipment (P0-9)**:
  - Đấu nối phương thức `confirmReceived` trong `createRuntimeApp` ([app.ts](file:///d:/e-commerce-platform/backend/src/platform/http/app.ts)).
  - Bổ sung kiểm tra Shipment bắt buộc (`409 SHIPMENT_REQUIRED`), lý do Admin (`422 REASON_REQUIRED`), và chuyển trạng thái Shipment `DELIVERED` hợp lệ trong cùng database transaction ([pg-checkout.service.ts](file:///d:/e-commerce-platform/backend/src/modules/checkout/services/pg-checkout.service.ts)).
  - Bằng chứng: Bộ kiểm thử [order-confirm-received.spec.ts](file:///d:/e-commerce-platform/backend/test/platform/order-confirm-received.spec.ts) (8/8 tests PASS).
- **Phần A: Phân hạng Shop, API Admin, Override metadata, Badge & Lọc Catalog (Đã merge dev)**:
  - Migration CSDL: `20261003100000_shop_tiering` thêm `tier`, `tier_override`, `tier_override_reason`, `tier_overridden_at`, `tier_override_by` vào bảng `shops`.
  - API Admin: Triển khai `PATCH /api/v1/admin/shops/:id/tier` kiểm tra RBAC `ADMIN`, validate dữ liệu, bắt buộc lý do và ghi audit log `SHOP_TIER_UPDATE` nguyên tử ([admin-routes.ts](file:///d:/e-commerce-platform/backend/src/platform/http/routes/admin-routes.ts)).
  - Lọc Catalog: Hỗ trợ query `shop_tier` tại `GET /api/v1/products`, trả về `shop_tier` trong danh sách và chi tiết sản phẩm ([pg-catalog-http.service.ts](file:///d:/e-commerce-platform/backend/src/modules/catalog/services/pg-catalog-http.service.ts)).
  - Giao diện: Component `TierBadge` hiển thị nhãn MALL và Yêu thích trên `ProductCard` và `ProductDetailScreen`; tích hợp bộ lọc phân hạng trên `CatalogListScreen`; bổ sung cột Hạng và dialog "Đổi hạng" trên `AdminShopsScreen`.
  - Bằng chứng: [admin-shop-tier.spec.ts](file:///d:/e-commerce-platform/backend/test/platform/admin-shop-tier.spec.ts) (10/10 tests PASS), [admin-portal.spec.ts](file:///d:/e-commerce-platform/frontend/test/admin-portal.spec.ts) (14/14 tests PASS).
- **Phần B: Phân hạng Buyer VIP, DinoPoint Ledger, Concurrency Lock & Rollback (Đã merge dev)**:
  - Migration CSDL: `20261003110000_buyer_loyalty` thêm `buyer_tier`, `total_spent`, `loyalty_points` vào `app_users`, tạo bảng `loyalty_point_transactions` kèm unique partial index `uq_loyalty_transactions__order_earned` và cấu hình RLS bảo vệ ledger.
  - Domain tính toán: Xây dựng `loyalty.types.ts` sử dụng số học `BigInt` cents, bảo đảm zero floating point; loại trừ phí vận chuyển (P0-1); 10.000 VNĐ = 1 điểm (P0-2); hệ số tính theo hạng cũ dưới khóa (P0-3); ngưỡng VIP 5.000.000 VNĐ.
  - Xử lý Concurrency & Rollback: Khóa dòng Buyer `SELECT ... FOR UPDATE`, ghi nhận ledger bằng `INSERT ... ON CONFLICT DO NOTHING RETURNING transaction_id`, chỉ tăng chi tiêu và điểm khi chèn ledger thành công (`rowCount === 1`). Toàn bộ luồng chuyển đơn, shipment, audit log và tích điểm thực thi trong cùng transaction.
  - API & Giao diện: Triển khai `GET /api/v1/buyer/loyalty` và `GET /api/v1/buyer/loyalty/history`; xây dựng component `BuyerLoyaltyCard` hiển thị huy hiệu VIP/Standard, điểm tích lũy, thanh tiến trình thăng hạng và lịch sử giao dịch trong `ProfileScreen`.
  - Bằng chứng: [buyer-loyalty.spec.ts](file:///d:/e-commerce-platform/backend/test/platform/buyer-loyalty.spec.ts) (10/10 tests PASS), kiểm thử PostgreSQL thật độc lập [tiering-loyalty.integration.test.ts](file:///d:/e-commerce-platform/backend/tests/db/tiering-loyalty.integration.test.ts) (8/8 tests PASS), kiểm thử lifecycle [e2e-tiering-loyalty-lifecycle.spec.tsx](file:///d:/e-commerce-platform/frontend/test/e2e-tiering-loyalty-lifecycle.spec.tsx) (7/7 tests PASS).
- **Phần C: Dịch vụ xét hạng Shop, Ưu tiên Catalog và API kích hoạt (Hoàn thành trên nhánh feature, chưa merge dev)**:
  - Đã triển khai trên nhánh `codex/tiering-loyalty` (commit `ca118a1`):
    - `ShopTierEvaluationService` ([shop-tier-evaluation.service.ts](file:///d:/e-commerce-platform/backend/src/modules/shop/services/shop-tier-evaluation.service.ts)): Đánh giá doanh số 30 ngày (ngưỡng >= 100M VNĐ và >= 50 đơn hoàn tất để đạt PREFERRED), tôn trọng `tier_override` của Admin.
    - Sắp xếp Catalog ưu tiên (`ORDER BY CASE s.tier WHEN 'MALL' THEN 1 WHEN 'PREFERRED' THEN 2 ELSE 3 END`) trong [pg-catalog.repository.ts](file:///d:/e-commerce-platform/backend/src/modules/catalog/repositories/pg-catalog.repository.ts).
    - Endpoint Admin kích hoạt thủ công `POST /api/v1/admin/shops/evaluate-tiers`.
    - Bộ kiểm thử unit [shop-tier-evaluation.spec.ts](file:///d:/e-commerce-platform/backend/test/platform/shop-tier-evaluation.spec.ts) (7/7 tests PASS) và kiểm thử Suite 5 trong `tiering-loyalty.integration.test.ts` (9 tests PASS, tổng 17/17 tests PASS trên nhánh feature).
  - Tình trạng trên `origin/dev`: **Chưa được merge vào dev**.

## Thiết kế / quyết định kỹ thuật

- **P0-9 Điều kiện hoàn tất đơn hàng và Shipment**: Khi xác nhận nhận hàng (`confirmReceived`), đơn hàng phải ở trạng thái `SHIPPING`, bản ghi `shipments` phải tồn tại (nếu thiếu trả về `409 SHIPMENT_REQUIRED`), Admin phải có `reason` không rỗng (`422 REASON_REQUIRED`), và trạng thái Shipment chuyển sang `DELIVERED` hợp lệ trong cùng database transaction.
- **Loại bỏ hoàn toàn sai số dấu phẩy động (Zero Floating Point)**: Sử dụng đơn vị `BigInt` cents quy đổi 10.000 VNĐ = `1_000_000n` cents để tính toán chi tiêu và điểm tích lũy.
- **Idempotency & Chống Duplicate ở tầng Cơ sở dữ liệu**: Bảng `loyalty_point_transactions` có unique partial index `uq_loyalty_transactions__order_earned` trên `(reference_order_id) WHERE reason = 'ORDER_COMPLETED'`. Câu lệnh ghi nhận sử dụng cú pháp `INSERT ... ON CONFLICT (reference_order_id) WHERE reason = 'ORDER_COMPLETED' DO NOTHING RETURNING transaction_id`. Điểm và chi tiêu chỉ được cập nhật khi `rowCount === 1`. Đơn dưới 10.000 VNĐ vẫn ghi ledger với `points_delta = 0` để chặn duplicate.
- **Khóa tuần tự Concurrency**: Trong transaction hoàn tất đơn, hệ thống thực hiện `SELECT ... FROM app_users WHERE user_id = $1 FOR UPDATE`. Đọc `old_total_spent` và `old_tier` dưới khóa, tính toán `new_total_spent` và `new_tier` bằng domain logic trước khi ghi đè, tránh hoàn toàn race condition khi 2 đơn hoàn tất đồng thời.
- **Bảo mật Sổ cái (Ledger RLS)**: Bật Row Level Security (`ENABLE ROW LEVEL SECURITY`) và thu hồi toàn bộ quyền trực tiếp (`REVOKE ALL ON TABLE loyalty_point_transactions FROM PUBLIC, anon, authenticated;`), bảo đảm chỉ có service backend thông qua connection pool tin cậy mới có quyền ghi chép.
- **Tương thích dữ liệu cũ / Zero Breaking Changes**: Mọi trường mới bổ sung vào `shops` và `app_users` đều có giá trị `DEFAULT` (`'STANDARD'`, `0`, `FALSE`), bảo đảm an toàn khi triển khai.
- **Ghi chú về Dependencies với các Module khác**:
  - *Module Flash Sale (Redis Client)*: Trong `app.ts`, `FlashSaleService` khởi tạo kết nối `ioredis` với chiến lược tự động retry liên tục. Khi chạy test node đơn lẻ không có Redis local, cần sử dụng cờ `--test-force-exit` để tiến trình Node kết thúc sau khi hoàn thành test.
  - *Module Escrow / Wallet*: Khi đơn hàng chuyển sang `COMPLETED`, hook tự động quyết toán `settleEscrow` được kích hoạt; nếu đơn kiểm thử không có bản ghi escrow, hệ thống bắt lỗi và log cảnh báo mà không làm gián đoạn luồng tích điểm.
  - *Module Shipping*: Luồng xác nhận nhận hàng phụ thuộc vào bảng `shipments` theo quy tắc P0-9.

## Kiểm tra và kết quả

Mọi kiểm tra dưới đây được thực hiện trực tiếp trên nhánh `docs/tiering-loyalty-report` (dựa trên commit dev `3d92000`) vào ngày **2026-10-02**:

| Kiểm tra | Môi trường | Lệnh / File kiểm thử | Kết quả | Bằng chứng / ghi chú |
|---|---|---|---|---|
| Backend Typecheck | TypeScript 5.8 | `npm --prefix backend run typecheck` | PASS | `tsc --noEmit` hoàn thành với 0 lỗi |
| Backend Lint | ESLint 9 | `npm --prefix backend run lint` | PASS | 0 errors, 0 warnings (với `--max-warnings=0`) |
| Backend Build | esbuild | `npm --prefix backend run build` | PASS | Bundle `dist/app.js` (812.1kb) thành công |
| Admin Shop Tiering Unit/Integration (Phần A) | Node Test Runner | `npx tsx --test --test-force-exit test/platform/admin-shop-tier.spec.ts` | PASS (10/10 tests) | 10/10 tests pass: Đổi hạng MALL/PREFERRED, bắt buộc reason, validate tier, chặn Seller/Buyer, lọc catalog `shop_tier`, xử lý lỗi 422 |
| Buyer Loyalty & Concurrency Unit (Phần B) | Node Test Runner | `npx tsx --test --test-force-exit test/platform/buyer-loyalty.spec.ts` | PASS (10/10 tests) | 10/10 tests pass: Tính điểm trừ ship, đơn <10k, hệ số x1/x2 khi thăng hạng, 2 ca concurrency 4.9M và 4.8M, duplicate check, API envelopes |
| Order Confirm Received & P0-9 Shipment | Node Test Runner | `npx tsx --test --test-force-exit test/platform/order-confirm-received.spec.ts` | PASS (8/8 tests) | 8/8 tests pass: Quyền Buyer/Admin, kiểm tra Shipment bắt buộc, trạng thái `SHIPPING` -> `DELIVERED` & `COMPLETED` |
| Real PostgreSQL Database Integration (Phần A & B) | Supabase Remote PostgreSQL (Schema cô lập `p5_loyalty_<uuid>`) | `$env:RUN_REMOTE_DB_TESTS="true"; npx vitest run tests/db/tiering-loyalty.integration.test.ts` | PASS (8/8 tests) | 8/8 tests pass (87.03s): Kiểm chứng schema `shops` và `app_users`, RLS ledger, chống duplicate `ON CONFLICT`, đơn <10k 0 điểm, concurrency serialization `SELECT FOR UPDATE` (mốc 4.9M và 4.8M), transaction rollback integrity. Môi trường kiểm thử cô lập hoàn toàn, không tác động production |
| Shop Tier Evaluation & Boost Tests (Phần C) | Local/Node | `test/platform/shop-tier-evaluation.spec.ts` | Chưa chạy trên dev | Mã nguồn Phần C chưa được merge vào `origin/dev`. Trên nhánh `codex/tiering-loyalty` đã kiểm chứng đạt 7/7 tests pass |
| Frontend Typecheck | TypeScript 5.8 | `npm --prefix frontend run typecheck` | PASS | `tsc --noEmit` hoàn thành với 0 lỗi |
| Frontend Lint | ESLint 9 | `npm --prefix frontend run lint` | PASS | 0 errors, 0 warnings |
| Frontend E2E & Lifecycle Tests | Vitest / jsdom | `npx vitest run test/e2e-tiering-loyalty-lifecycle.spec.tsx test/buyer-loyalty-card.spec.tsx` | PASS (9/9 tests) | 9/9 tests pass: Hiển thị badge MALL/PREFERRED, UI chip lọc catalog, Buyer nhận hàng -> cập nhật DinoPoint/VIP/lịch sử, thăng hạng VIP x2 điểm |
| Frontend Admin Portal Tests | Vitest / jsdom | `npx vitest run test/admin-portal.spec.ts` | PASS (14/14 tests) | 14/14 tests pass: Quản lý shop, duyệt hạng shop và audit log |
| Frontend Production Build | Next.js 16 (Turbopack) | `npm --prefix frontend run build` | PASS | Biên dịch Next.js thành công toàn bộ 34 routes |

## An toàn và tình huống lỗi

- **Phân quyền và bảo vệ dữ liệu nhạy cảm**:
  - Áp dụng kiểm tra RBAC nghiêm ngặt: Chỉ vai trò `ADMIN` mới có quyền gọi `PATCH /api/v1/admin/shops/:id/tier` và `POST /api/v1/admin/shops/evaluate-tiers`. Seller bị chặn hoàn toàn không thể tự ý sửa hạng shop qua `/api/v1/seller/shop` (trả về `422 VALIDATION_FAILED` hoặc `403 FORBIDDEN`).
  - Buyer chỉ xem được điểm và lịch sử giao dịch của chính mình thông qua context phiên đăng nhập (`req.user.user_id`).
  - Bảng sổ cái `loyalty_point_transactions` được bảo vệ bằng RLS và thu hồi quyền trực tiếp từ client.
- **Chống Request trùng (Idempotency) và Race Condition**:
  - Cơ chế unique partial index `uq_loyalty_transactions__order_earned` kết hợp cú pháp `INSERT ... ON CONFLICT DO NOTHING RETURNING` bảo đảm mỗi đơn hàng chỉ được tích điểm đúng một lần duy nhất.
  - Sử dụng khóa dòng `SELECT ... FOR UPDATE` trên tài khoản Buyer bảo đảm khi nhiều đơn hàng hoàn tất đồng thời, các phép tính thăng hạng và nhân điểm được tuần tự hóa chính xác theo thứ tự giao dịch.
- **Rollback và Tính toàn vẹn Transaction**:
  - Toàn bộ các thao tác: chuyển trạng thái đơn hàng (`COMPLETED`), cập nhật vận đơn (`DELIVERED`), ghi sổ cái điểm (`loyalty_point_transactions`), cập nhật chi tiêu/điểm Buyer (`app_users`), và ghi nhật ký kiểm toán (`admin_logs`) được thực hiện trong cùng một transaction duy nhất. Đã kiểm chứng qua test tích hợp PostgreSQL thật: nếu có bất kỳ bước nào thất bại, toàn bộ số dư và sổ cái được rollback 100%, không xảy ra rò rỉ dữ liệu.
- **Rủi ro còn lại**:
  - Chưa có Scheduler chạy định kỳ cho việc đánh giá hạng Shop tự động (cần kích hoạt thủ công qua API Admin).
  - Tải kết nối cơ sở dữ liệu: Khi khối lượng đơn hàng tăng cao, cần theo dõi connection pool của PostgreSQL đối với các truy vấn sử dụng `FOR UPDATE`.

## Việc còn lại và blocker

- [ ] Tạo Pull Request merge Đợt C (`ShopTierEvaluationService`, catalog search boost MALL/PREFERRED, API `POST /api/v1/admin/shops/evaluate-tiers`) từ nhánh `codex/tiering-loyalty` vào nhánh `dev` — Owner: NVCuong3112 — Dự kiến: 2026-10-04
- [ ] Thiết kế và bổ sung Job Scheduler (Cron/Worker nền) để xét duyệt hạng Shop định kỳ tự động thay vì chỉ gọi thủ công qua Admin API — Owner: NVCuong3112 — Dự kiến: Chưa xác định (Cần thống nhất kiến trúc cron job / worker nền với Platform Lead và Đội Infrastructure)
- [ ] Triển khai cơ chế đổi điểm DinoPoint trừ tiền checkout hoặc voucher đổi thưởng (P0-5) — Owner: NVCuong3112 — Dự kiến: Chưa xác định (Phụ thuộc vào thống nhất tỉ lệ quy đổi và luồng thanh toán với Người 4 phụ trách Checkout & Payment)
- [ ] Triển khai cơ chế thu hồi điểm / khấu trừ DinoPoint khi đơn hàng bị hoàn tiền / trả hàng sau khi hoàn tất (P0-7) — Owner: NVCuong3112 — Dự kiến: Chưa xác định (Phụ thuộc vào luồng Dispute & Refund của hệ thống)
- [ ] Áp dụng migration lên môi trường staging / production — Owner: NVCuong3112 & DevOps/Lead — Dự kiến: Chưa xác định (Phụ thuộc vào kế hoạch release và điều kiện môi trường staging/production được cấp quyền chạy migration chính thức)
- Blocker: Không có blocker kỹ thuật nội tại cho Đợt A và Đợt B. Các tính năng mở rộng (Scheduler định kỳ, Đổi điểm thưởng, Thu hồi điểm khi refund) đang chờ thống nhất kiến trúc và yêu cầu từ các feature phụ thuộc.

## Nhật ký cập nhật

### 2026-10-02 (Bàn giao và kiểm chứng sau merge trên phiên bản dev)

- **Đã làm**:
  - Đối chiếu mã nguồn trên `origin/dev` (commit `3d92000`): Xác nhận merge commit `5301b70` đã tích hợp đầy đủ mã nguồn Đợt A và Đợt B (đến commit `6e09b39`). Mã nguồn Đợt C hiện đang lưu trên nhánh riêng `codex/tiering-loyalty` (commit `ca118a1`) và chưa được merge vào `dev`.
  - Tạo nhánh cập nhật báo cáo `docs/tiering-loyalty-report` trực tiếp từ `origin/dev`.
  - Chạy toàn bộ các kiểm thử liên quan sau merge trên phiên bản dev hiện tại:
    - Backend Typecheck & Lint: PASS (0 errors, 0 warnings).
    - Backend Build: PASS (bundle `dist/app.js` 812.1kb thành công).
    - Unit & Platform tests: `admin-shop-tier.spec.ts` (10/10 PASS), `buyer-loyalty.spec.ts` (10/10 PASS), `order-confirm-received.spec.ts` (8/8 PASS).
    - Kiểm thử tích hợp cơ sở dữ liệu thật trên Supabase PostgreSQL (schema cô lập `p5_loyalty_<uuid>`, không tác động production): `tiering-loyalty.integration.test.ts` (8/8 PASS trong 87.03s).
    - Frontend Typecheck & Lint: PASS (0 errors, 0 warnings).
    - Frontend Tests: `e2e-tiering-loyalty-lifecycle.spec.tsx` & `buyer-loyalty-card.spec.tsx` (9/9 PASS), `admin-portal.spec.ts` (14/14 PASS).
    - Frontend Production Build: PASS (34 routes Next.js).
  - Cập nhật tài liệu báo cáo `docs/feature/03-tiering-loyalty.md` chuẩn hóa theo đúng mẫu README: ghi rõ Owner NVCuong3112, commit dev được kiểm tra (`3d92000`), ngày chạy (2026-10-02), trạng thái từng phần A/B/C, kết quả lệnh thực tế, phân định rõ ràng các tính năng chưa triển khai (đổi điểm, thu hồi điểm khi refund, scheduler tự động), và các dependency với feature khác (Redis client ở Flash Sale, Escrow auto-settle ở Wallet, Shipment check ở Shipping).
- **Kiểm tra**:
  - Toàn bộ 28 tests backend platform và 8 tests PostgreSQL thật trên schema cô lập đạt 100% PASS.
  - Toàn bộ 23 tests frontend liên quan đạt 100% PASS.
  - Toàn bộ quality gates (typecheck, lint, build) đạt 100% PASS.
- **Tiếp theo**:
  - Chuẩn bị Pull Request đưa mã nguồn Đợt C (`ShopTierEvaluationService`, search boost, API evaluate-tiers) từ nhánh `codex/tiering-loyalty` vào nhánh `dev`.
  - Phối hợp với Tech Lead để chốt giải pháp Scheduler định kỳ cho xét duyệt hạng Shop.
