# 08. Implementation plan — Dino MVP 30/09/2026

> **Phiên bản:** 1.4.0
>
> **Deadline:** cuối ngày 30/09/2026 (Asia/Saigon)
>
> **Trạng thái:** CONTRACT FREEZE — FIVE OWNER PARALLEL EXECUTION
>
> **Workspace FE:** `frontend/`; không sửa hoặc phát triển tiếp `ecommerce-web/`

## 1. Mục tiêu giao

MVP phải chạy được các luồng sau bằng API/runtime thật:

1. Buyer đăng nhập, tìm sản phẩm, cart và COD checkout không oversell.
2. User onboarding thành Seller, tạo Shop `PENDING`, Admin approve, Seller upload ảnh thật và tạo sản phẩm.
3. Seller xử lý Order đến `SHIPPING`; Buyer xác nhận đã nhận để Order `COMPLETED`.
4. Buyer review OrderItem đã hoàn thành; review/rating xuất hiện trên Product Detail.
5. Profile và notifications REST dùng API thật.
6. Admin quản lý users, shops và categories cơ bản; mọi moderation mutation có audit.

Nếu capability MUST chưa qua runtime/integration gate, giữ `BLOCKED` và ẩn trong production. Không bật mock để giả hoàn tất.

## 2. DRI và ranh giới sở hữu

Mỗi task có đúng một DRI. Người khác chỉ review contract hoặc tiêu thụ đầu ra.

| Người | Phạm vi DRI |
|---|---|
| **Người 1** | Platform/Auth, Seller onboarding FE, OpenAPI, generated FE types, readiness, error envelope, deploy |
| **Người 2** | Database/Storage policy, E2E seed, shared UI/accessibility, Profile/Notifications FE |
| **Người 3** | Catalog, media API/repository, Seller products, Product Detail/review read UI |
| **Người 4** | Cart/Checkout FE, Review/Notification backend services và contract |
| **Người 5** | Checkout/Order/Shipment backend, Orders/Review/Admin FE, moderation integration |

Quy tắc file chung:

- Người 1 duy nhất sửa package/lockfile, API client/config/auth/shared repository interface và generated OpenAPI setup.
- Người 2 duy nhất sửa global tokens, shared UI/navigation và Storage policy/migration theo ownership hiện hành.
- Người 3 sở hữu catalog/Seller product/media feature.
- Người 4 sở hữu cart/checkout FE và buyer supporting services được giao.
- Người 5 sở hữu orders/review/admin screens và transaction order/shipment.

## 3. Lịch ngày 30/09

### Block 0 — Hai giờ đầu: contract/test freeze

- Chốt OpenAPI/DTO/error/state transition.
- Setup generated FE types, component/browser test tooling.
- Seed E2E và capability manifest.
- Không thay public contract sau block này nếu chưa có Change Request.

### Block 1 — Năm giờ tiếp theo: ba workstream song song

- **A — Auth/Buyer/Inventory:** Người 1, 4, 5.
- **B — Media/Catalog/Seller:** Người 2, 3.
- **C — Orders/Review/Notifications/Admin:** Người 1–5 theo ticket riêng.

Review text/rating làm song song bằng fake boundary; review media chỉ nối sau khi Media finalize được Người 3 bàn giao.

### Block 2 — Ba giờ tiếp theo: integration

- Sinh lại FE wire types từ OpenAPI.
- Nối repository thật và chuyển capability sang `LIVE` khi runtime test pass.
- Chạy PostgreSQL race tests và bốn Playwright critical paths.
- Không thêm feature mới sau khi bắt đầu block này.

### Block 3 — Hai giờ cuối: release

- Sửa defect P0/P1, chạy quality gates, deploy Vercel/backend host.
- Smoke CORS/env/Supabase Auth/Storage và `/health/readiness`.
- Cập nhật progress của từng người bằng test/PR/commit thật.

### Critical path

```text
OpenAPI freeze
  → login + E2E seed
  → media presign/finalize
  → Seller create product có ảnh
  → checkout/order SHIPPING
  → Buyer confirm-received
  → review write/read model
  → critical E2E
  → production smoke
```

Phase A/B/C gần như độc lập sau Block 0. Cụm review media trong C phụ thuộc Media ở B; release phụ thuộc cả ba.

## 4. Contract-first workflow

Mỗi endpoint mới đi theo một chuỗi duy nhất:

1. DRI backend cập nhật OpenAPI: method/path/request/response/error/role.
2. Người 1 sinh FE wire types từ OpenAPI.
3. DRI FE cập nhật view-model/repository và fake boundary cho development.
4. DRI backend viết red test qua public HTTP/runtime seam rồi implement tối thiểu.
5. DRI FE viết red behavior test rồi nối API thật.
6. Runtime integration và E2E pass.
7. Capability chuyển `BLOCKED|MOCK_DEV_ONLY → LIVE`.

Không viết lại wire DTO bằng tay. Fixture chỉ là dữ liệu ví dụ, không phải schema thứ hai.

## 5. Block 0 tasks

| ID | DRI | Task | Acceptance |
|---|---|---|---|
| P0-01 | Người 1 | Khóa OpenAPI onboarding, media, Seller products, confirm-received, timeline, reviews, notifications, Admin categories | Contract drift fail nếu OpenAPI/runtime lệch method hoặc path |
| P0-02 | Người 1 | Thêm Testing Library, user-event, jsdom, Playwright, Axe và `openapi-typescript` | Component/E2E chạy CI; generated file có diff guard |
| P0-03 | Người 2 | Red test: form nhiều lỗi focus ErrorSummary và link tới field | Test đỏ do hành vi thiếu, không phải thiếu tooling |
| P0-04 | Người 1 | Capability registry `LIVE | MOCK_DEV_ONLY | BLOCKED` | Production build fail nếu capability MUST chưa LIVE hoặc mock bật |
| P0-05 | Người 2 | Seed E2E idempotent | Chạy hai lần không lỗi unique và giữ stable logical fixtures |
| P0-06 | Người 2 | Seed Category/Product/Storage | Có product ACTIVE, variant stock 1 và ảnh finalized thật |
| P0-07 | Người 1 | Login email/password + `/auth/me` smoke là MUST | Buyer/Seller/Admin seed nhận đúng role/shop status |
| P0-08 | Người 1 | Change Request `confirm-received` | Cập nhật spec, state machine, OpenAPI, tests; Seller vẫn không COMPLETED |
| P0-09 | Người 1 | Error envelope completeness | Mọi 4xx/5xx/404/429 có `meta.request_id` |

Seed bắt buộc gồm Buyer ACTIVE, Seller PENDING, Seller ACTIVE, Admin, Category thật, Product ACTIVE có media finalized, variant stock thường và stock `1`, Address/cart/voucher, Orders ở các state cần cho UI và một notification unread. Seed chỉ chạy trên development/test database đã xác minh; không tự chạy production.

## 6. Quy tắc nghiệp vụ khóa

### 6.1. Seller onboarding

`POST /auth/onboarding` nhận `requested_role=SELLER`, `full_name`, `shop_name`; transaction tạo profile, đổi role thành Seller và tạo Shop `PENDING`. Seller đăng nhập được nhưng mọi mutation catalog/order trả `403 SHOP_NOT_ACTIVE` cho tới khi Admin approve.

MVP không hỗ trợ Buyer đã hoàn tất profile nâng cấp thành Seller. Errors: `ONBOARDING_ALREADY_COMPLETED`, `ONBOARDING_STATE_CONFLICT`, `SHOP_ALREADY_EXISTS`, `SHOP_NOT_ACTIVE`, `USER_LOCKED`, `VALIDATION_FAILED`.

### 6.2. Inventory/cancel

- Trừ tồn tại checkout trong transaction; lock variants theo thứ tự ổn định và conditional update `stock_quantity >= quantity`.
- Hai Buyer mua item cuối: chỉ một transaction thành công, transaction kia `409 INVENTORY_INSUFFICIENT`.
- Buyer chỉ cancel `PENDING_CONFIRMATION`; Seller/Admin cancel `PENDING_CONFIRMATION|CONFIRMED|PREPARING`.
- Cancel luôn cần reason và hoàn tồn đúng một lần trong cùng transaction.
- Không cancel `SHIPPING`; `DELIVERY_FAILED` không tự hoàn tồn trong MVP.

### 6.3. Shipment/completion

- Seller confirm tạo Shipment `PENDING` nếu chưa có; retry không tạo trùng.
- `PREPARING → SHIPPING` đồng thời đưa Shipment sang `HANDED_OVER`.
- `POST /orders/:id/confirm-received`: Buyer owner, Order SHIPPING, Shipment bắt buộc tồn tại; thiếu trả `409 SHIPMENT_REQUIRED`.
- Lock Order/Shipment; conditional update `WHERE status='SHIPPING'`; atomically Shipment `DELIVERED`, Order `COMPLETED`, history và notification.
- Admin/shipment integration đặt `DELIVERY_FAILED` từ SHIPPING với Shipment `FAILED` và reason bắt buộc.
- Seller không được đặt `COMPLETED` hoặc `DELIVERY_FAILED`.

### 6.4. Idempotency

Scope `user_id + endpoint + key`, TTL 24 giờ. Cùng fingerprint replay response đầu; khác payload trả `409 IDEMPOTENCY_KEY_REUSED`; request đang chạy trả `409 REQUEST_IN_PROGRESS`. Replay không trừ tồn/consume voucher/tạo notification lần hai.

### 6.5. Moderation side effects

- User lock: auth middleware chặn request kế tiếp bằng `USER_LOCKED`; FE sign out. Order/data lịch sử không bị xóa.
- Shop không ACTIVE: bị loại khỏi public catalog và không được mutation; order lịch sử không tự hủy; Admin xử lý outstanding orders.
- Không lock/unlock bất kỳ tài khoản `ADMIN`; trả `403 ADMIN_TARGET_PROTECTED`.
- Approve/lock/unlock user/shop/category phải ghi audit trong cùng transaction; audit write lỗi thì mutation rollback.

## 7. Workstream A — Auth, Buyer, inventory

| ID | DRI | Task | Red slice/acceptance |
|---|---|---|---|
| A-101 | Người 1 | Nối register/complete-profile với onboarding thật | Seller onboarding tạo Shop PENDING |
| A-102 | Người 1 | Refresh AuthContext sau onboarding/approve | Role/shop status mới xuất hiện không cần mock |
| A-103 | Người 1 | Gate Seller navigation theo Shop status | PENDING thấy chờ duyệt, không thấy mutation CTA |
| A-104 | Người 1 | Safe returnTo | Guest login quay về route nội bộ; external URL về `/` |
| A-201 | Người 4 | Cart optimistic rollback | Mutation lỗi rollback đúng item |
| A-202 | Người 4 | Checkout idempotency UI | Timeout retry giữ snapshot/key |
| A-203 | Người 5 | PostgreSQL last-item race | Hai checkout song song chỉ một thành công |
| A-204 | Người 5 | Cancel + stock restore | Cancel hợp lệ hoàn tồn một lần; repeat không hoàn lần hai |
| A-205 | Người 5 | Seller/Admin exceptional cancel | Chỉ pending/confirmed/preparing; reason bắt buộc |
| A-206 | Người 4 | Buyer checkout E2E | Catalog → cart → address → voucher → COD tạo một order/shop |

## 8. Workstream B — Media, catalog, Seller products

Media endpoints: `POST /media/uploads/presign`, `POST /media/uploads/:media_id/finalize`, `DELETE /media/uploads/:media_id`.

- Presign TTL 10 phút; JPEG/PNG/WebP; tối đa 5 MB/file.
- Product tối đa 5 ảnh, review 3, avatar 1.
- Server sinh object path và gắn owner/purpose.
- Finalize kiểm magic bytes, không tin Content-Type/extension client.
- Chỉ xóa media chưa attached; attach vào target trong transaction.
- Finalized chưa attached sau 24 giờ được cleanup; create product lỗi thì FE DELETE best-effort.

| ID | DRI | Task | Red slice/acceptance |
|---|---|---|---|
| B-101 | Người 2 | Storage bucket/RLS/cleanup | Cross-owner upload/finalize/delete bị chặn |
| B-102 | Người 3 | Presign/finalize/delete API | Sai magic bytes bị từ chối |
| B-103 | Người 3 | MediaRepository FE | Lỗi upload giữ form; không fallback ảnh giả |
| B-104 | Người 2 | FileUploadZone hardening | Object URL revoke khi remove/unmount |
| B-105 | Người 3 | Product image dùng `next/image` | Kích thước ổn định, alt đúng |
| B-201 | Người 3 | `GET /seller/products` | Scope JWT/shop, không arbitrary `shop_id` |
| B-202 | Người 3 | Create product với media IDs | Product có ảnh finalized; Shop chưa ACTIVE bị 403 |
| B-203 | Người 3 | Stock update | Integer không âm, ownership và Shop ACTIVE |
| B-204 | Người 3 | Product ACTIVE↔INACTIVE | Public catalog ẩn product/shop không ACTIVE |
| B-205 | Người 3 | Seller product UI live | Search/filter/create/stock/hide/show, không mock production |
| B-206 | Người 3 | Seller product E2E | Upload → create → list → stock → hide/show |

Edit name/description/price/variant structure nằm backlog sau MVP.

## 9. Workstream C — Orders, review, notifications, Admin

### 9.1. Orders/timeline

`GET /orders/:id` trả timeline từ `order_status_history` theo `changed_at ASC`; FE không tự suy từ status hiện tại.

| ID | DRI | Task | Red slice/acceptance |
|---|---|---|---|
| C-101 | Người 5 | Timeline DTO/query | History đúng thứ tự và scope |
| C-102 | Người 5 | Shipment create/handover | Confirm retry không tạo Shipment trùng |
| C-103 | Người 5 | Confirm-received transaction | Missing Shipment conflict; happy path đổi đúng hai entity |
| C-104 | Người 5 | Confirm-received race | Hai transition race chỉ một thắng, phía sau refetch |
| C-105 | Người 5 | Admin delivery-failed | Reason bắt buộc; Seller bị từ chối |
| C-106 | Người 5 | Buyer/Seller Order UI | Timeline và actions đúng actor/status |
| C-107 | Người 5 | Negative state-machine test | Seller vẫn không đặt được COMPLETED |

### 9.2. Review write/read

- `POST /order-items/:id/review`: server suy Product/Order từ OrderItem, không tin `product_id` client; Buyer owner; Order COMPLETED; một review/OrderItem.
- `GET /products/:id/reviews?cursor=&limit=` trả public reviews và `rating_summary {average,count}`.

| ID | DRI | Task | Red slice/acceptance |
|---|---|---|---|
| C-201 | Người 4 | Inject ReviewService runtime | Route không còn 501 |
| C-202 | Người 4 | Review ownership/eligibility | Wrong owner/not completed/duplicate bị chặn |
| C-203 | Người 4 | Review list + rating aggregate | Average/count chỉ từ review đúng Product |
| C-204 | Người 5 | Review form API thật | Rating/content/media, inline errors, duplicate UX |
| C-205 | Người 3 | Product Detail review UI | Rating/count/list thật; không rating giả |
| C-206 | Người 5 | Order → review E2E | SHIPPING → confirm received → COMPLETED → review |

### 9.3. Notifications

Event MVP: Order mới cho Seller; Seller confirm/prepare/ship cho Buyer; cancel cho phía đối ứng; confirm-received cho Seller; delivery-failed cho Buyer+Seller; approve/lock/unlock Shop cho owner; lock/unlock User cho target; review mới cho Seller. Mỗi event có deterministic `event_id`.

| ID | DRI | Task | Red slice/acceptance |
|---|---|---|---|
| C-301 | Người 4 | Inject NotificationService | List/detail/read không 501 |
| C-302 | Người 4 | Emit event catalog | Retry không tạo notification trùng |
| C-303 | Người 2 | NotificationRepository FE | Không demoRows production |
| C-304 | Người 2 | Mark-one rollback | API lỗi trả item về unread |
| C-305 | Người 2 | Mark tối đa 20 | Concurrency 4, partial failure, dừng queue khi 429 |

### 9.4. Admin MVP

| ID | DRI | Task | Red slice/acceptance |
|---|---|---|---|
| C-401 | Người 1 | Admin users/shops API hardening | Pagination/filter/error envelope chuẩn |
| C-402 | Người 1 | Moderation effects + audit | Mutation/audit atomic; Admin target 403 |
| C-403 | Người 3 | Admin category CRUD/status | Hai cấp, chặn parent cycle |
| C-404 | Người 5 | Admin users/shops UI live | Không fixture production |
| C-405 | Người 5 | Admin category UI live | Không local ID/create giả |
| C-406 | Người 5 | Admin RBAC E2E | Buyer/Seller bị chặn route và API |

Audit viewer, product/review moderation và KPI nằm backlog; audit write không được hoãn.

## 10. Capability readiness

Capability MUST: `auth`, `catalog`, `cart`, `checkout`, `seller_catalog`, `media`, `orders`, `reviews`, `notifications`, `admin_users`, `admin_shops`, `admin_categories`.

- Development `MOCK_DEV_ONLY`: UI có badge “Dữ liệu demo”.
- Production `BLOCKED`: ẩn menu/CTA; direct route dùng `FeatureUnavailable`.
- Production `LIVE` lỗi request: error/retry/request ID, không fallback mock.
- `next.config.ts` chạy `validateReleaseReadiness()` và fail build nếu capability MUST chưa LIVE.
- Backend `/health/readiness` trả commit/version, DB/Auth/Storage và capability state; deployment chỉ promote khi khớp manifest FE.

## 11. TDD seams đã khóa

- **UI seam:** render screen qua public props/provider, thao tác bằng role/label/text, assert nội dung/focus/navigation; không đọc state nội bộ.
- **Repository/API seam:** test public repository, chỉ mock HTTP/Storage/time/provider; wire type dùng generated OpenAPI types.
- **Browser seam:** Playwright dùng backend/test DB và account seed; không query DB trực tiếp để chứng minh UI.
- Mỗi red slice chỉ kiểm tra một hành vi. Confirm-received và review chỉ nối trong E2E, không gộp thành một red test.

## 12. Release gate

### Automated

- FE lint 0 warning, typecheck, unit/component tests, build pass.
- BE lint/typecheck/unit/integration/PostgreSQL pass.
- Race tests: last-item checkout, cancel/restore, confirm-received, notification idempotency và checkout idempotency.
- Playwright Chromium: Buyer checkout; Seller onboarding/Admin approve/create product; fulfillment→confirm-received→review; Admin moderation.
- Axe: **0 critical, 0 serious** trên critical pages.

### Manual accessibility/responsive

- Keyboard-only hoàn thành bốn critical paths.
- Focus summary, dialog containment/ESC/return focus và sticky UI không che focus.
- Status không chỉ dùng màu.
- Viewport MVP: 360/768/1280px.
- Chrome là browser release chính; Edge smoke login/checkout/admin.

### Production smoke

- Vercel gọi đúng backend host; CORS chỉ cho allowed origin.
- Security headers còn hiệu lực; frontend không có service-role key.
- Supabase Auth và Storage presign/upload/finalize chạy thật.
- `/health/readiness` xanh và khớp FE manifest.
- Production không gọi mock; mọi lỗi có request ID.

## 13. Checklist riêng từng người

### Người 1 — Platform/Auth/Integration

- [ ] P0-01 khóa OpenAPI.
- [ ] P0-02 test tooling + generated FE types.
- [ ] P0-04 capability registry/build guard.
- [ ] P0-07 login `/auth/me` smoke.
- [ ] P0-08 Change Request confirm-received.
- [ ] P0-09 request ID mọi error.
- [ ] A-101–A-104 Seller onboarding, AuthContext, navigation gate, returnTo.
- [ ] C-401/C-402 Admin API hardening, moderation effects và atomic audit.
- [ ] `/health/readiness`, contract drift CI và production deploy smoke.

### Người 2 — Database/Storage/UI/Notifications

- [ ] P0-03 ErrorSummary behavior test.
- [ ] P0-05/P0-06 seed E2E + Product/Storage fixture.
- [ ] B-101 Storage RLS/cleanup.
- [ ] B-104 revoke object URL/FileUploadZone.
- [ ] C-303–C-305 Notification FE, rollback và bounded concurrency.
- [ ] Profile/avatar nối media thật.
- [ ] Axe/manual keyboard/responsive QA và defect handoff.

### Người 3 — Catalog/Media/Seller Products

- [ ] B-102/B-103 media APIs + MediaRepository.
- [ ] B-105 `next/image` product assets.
- [ ] B-201–B-206 Seller product live flow và E2E.
- [ ] C-205 Product Detail rating/reviews thật.
- [ ] C-403 Admin category CRUD/status backend.
- [ ] Cập nhật catalog capability và loại production mock fallback.

### Người 4 — Buyer/Checkout FE + Review/Notification services

- [x] A-201/A-202 cart rollback và checkout idempotency UX.
- [x] A-206 Buyer checkout E2E.
- [x] C-201–C-203 Review runtime/write/read/rating aggregate.
- [x] C-301/C-302 Notification runtime và event catalog.
- [x] Xác minh Profile/Address/Voucher adapters dùng generated types.
- [x] Bàn giao review/notification fixtures và error codes cho Người 2/3/5.

### Người 5 — Transaction/Order/Review/Admin FE

- [ ] A-203–A-205 inventory race, cancel/restore và exceptional cancellation.
- [ ] C-101–C-107 timeline, shipment, confirm-received, delivery-failed và Order UI.
- [ ] C-204/C-206 Review form và Order→Review E2E.
- [ ] C-404–C-406 Admin UI + RBAC E2E.
- [ ] Buyer/Seller critical Playwright path và release evidence.

Mỗi checkbox chỉ được tick khi progress file có link PR/commit, test đã chạy và blocker còn lại.

## 14. Backlog sau MVP

- Edit product name/description/price/variant structure.
- Audit log viewer, product/review moderation UI, Seller/Admin analytics.
- Dynamic SEO metadata từng Product và SSR optimization nâng cao.
- Online payment provider và realtime notifications.
- Auto-complete SHIPPING bằng shipment webhook/job.
- Tách `CheckoutScreen`/`SellerOrdersScreen` sau behavior tests.
- Visual regression và full Edge/375/1024/1440 matrix.
- Rate-limit tuning ngoài baseline hiện có.
- Buyer đã hoàn tất profile nâng cấp thành Seller.
- Quy trình nhập lại kho sau `DELIVERY_FAILED`.

## 15. Rủi ro chấp nhận

- Order có thể kẹt `SHIPPING` nếu Buyer không xác nhận; demo dùng Buyer seed, chưa có auto-complete.
- Admin không thể khóa Admin khác, kể cả admin xấu; quản lý Admin account ngoài portal MVP.
- `DELIVERY_FAILED` không hoàn tồn tự động.
- Refund/return không thuộc MVP.
- Capability chưa qua integration cutoff giữ `BLOCKED`; không dùng mock production để che blocker.
