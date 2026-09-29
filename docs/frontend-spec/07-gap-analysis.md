# 07. Gap analysis và integration readiness

> **Phiên bản:** 1.1.0  
> **Trạng thái:** T3 BACKEND HARDENING COMPLETE; FE RUNTIME GAPS REMAIN (AUDITED 2026-09-29)

## 1. Cách đánh giá

Không dùng phần trăm cảm tính. Mỗi capability nhận một trạng thái dựa trên bằng chứng runtime:

- `READY`: có contract và runtime integration path hoạt động.
- `PARTIAL`: dùng được một phần nhưng thiếu data/behavior cho UI.
- `BLOCKED`: không thể hoàn tất production flow.

Phân biệt hoàn tất mốc backend với integration readiness FE: T3 hardening/quality gates hoàn tất theo [backend progress](../progress/README.md), nhưng chỉ các service được inject trong `createRuntimeApp()` mới được xem là live API. Router có thể trả 501 hoặc placeholder nếu dependency chưa được nối. Dùng `05-api-contract.md` làm bảng endpoint chi tiết.

## 2. Gaps ưu tiên

### GAP-01 — Order reads, review và notification runtime wiring

- **Severity:** BLOCKER.
- **Hiện trạng (source audit 2026-09-29):** `createRuntimeApp()` injects `PgCheckoutService` for checkout/order mutations, but no `orderRepo`/`orderQueryService`; `GET /orders` returns HTTP 200 with `data: []`, and `GET /orders/:id` returns a placeholder. Review and notification routes are mounted but return HTTP 501 because their services are not injected. Address item routes return HTTP 501; address list/create are wired. `DELETE /cart/selected` is wired.
- **Ảnh hưởng:** buyer/seller order lists and order detail cannot use live data; review/notification and address item operations cannot be enabled in production. Order mutations work only when FE already has a valid order ID.
- **Giải pháp:** wire order query/repository, review and notification services through `createRuntimeApp()`; wire address item service if address CRUD is in scope. Add runtime-composition tests, not only injected-router tests.
- **Đóng gap khi:** authenticated tests against `createRuntimeApp()` verify buyer/seller-scoped order reads, review create, notification list/read and address item CRUD against PostgreSQL test data.

### GAP-02 — Checkout/payment contract và provider

- **Severity:** BLOCKER cho online payment.
- **Hiện trạng:** checkout core hoạt động với `COD|ONLINE`, selected cart và Idempotency-Key; không có payment provider session/QR/webhook. Payment endpoint hiện là retry.
- **Giải pháp:** FE triển khai checkout core không QR. Nếu cần online payment thật, BE thiết kế create-session, callback/webhook, status polling và idempotency riêng.
- **Đóng gap khi:** payment contract có provider-agnostic response và E2E sandbox test.

### GAP-03 — Enriched cart response

- **Severity:** BLOCKER cho cart UI production.
- **Hiện trạng:** cart runtime chỉ trả IDs, quantity và is_selected; thiếu name, variant, image, current price/stock, shop.
- **Giải pháp:** mở rộng `GET /cart` bằng join/read model, giữ server là nguồn giá/tồn kho.
- **Đóng gap khi:** response đủ render cart và có test cho inactive/out-of-stock variant.

### GAP-04 — Catalog detail/read models

- **Severity:** HIGH.
- **Hiện trạng:** product list thiếu rating/sold; detail thiếu images, shop metadata và reviews; `shop_id` filter không được hỗ trợ.
- **Giải pháp:** bổ sung detail read model, public reviews và seller-scoped product list riêng thay vì public `shop_id` tùy tiện.

### GAP-05 — Categories

- **Severity:** BLOCKER cho seller create/admin category; MEDIUM cho homepage.
- **Hiện trạng (source audit 2026-09-29):** categories exist in the database/domain, but no `/categories` route is mounted in `t1-routes.ts`; frontend `category_id` filtering only works with a known valid UUID. A backend progress entry claiming `GET /categories` is corrected in that log; current runtime code is authoritative.
- **Giải pháp:** public `GET /categories`; admin create/update/status với validation parent cycle và active status.
- **Fallback:** static config chỉ dùng development và chỉ chứa category UUID sau khi chạy [guarded dev/test seed](../architecture/backend-run-guide.md) trên đúng DB runtime. Không tự bịa/generate UUID: product filter so khớp trực tiếp `category_id` trong DB nên UUID không tồn tại trả mảng rỗng. Nếu chưa xác minh được seed trên đúng target thì ẩn filter.

### GAP-06 — Authentication onboarding

- **Severity:** BLOCKER cho registration.
- **Hiện trạng:** Supabase signup không tự đảm bảo `app_users`, profile, role và shop tồn tại.
- **Giải pháp:** server-controlled onboarding/DB trigger; không tin role `ADMIN` từ metadata client; seller onboarding tạo shop `PENDING` hoặc workflow được phê duyệt.

### GAP-07 — Profile API

- **Severity:** HIGH.
- **Hiện trạng:** có domain service/table nhưng không có HTTP route runtime.
- **Giải pháp:** `GET /profile`, `PATCH /profile`; email read-only từ auth; avatar dùng media contract.

### GAP-08 — Admin read APIs và moderation scope

- **Severity:** BLOCKER cho admin UI.
- **Hiện trạng (source audit 2026-09-29):** `POST /admin/users/:id/lock` and `/unlock` are mounted and wired to `ModerationService`; there are no user/log/shop/product list routes or shop/product moderation routes.
- **Giải pháp:** cursor pagination + filters; expose moderation actions có audit; không dùng client-supplied target type tùy ý.

### GAP-09 — Media upload

- **Severity:** HIGH.
- **Hiện trạng:** UI cần product/avatar/review images nhưng API chỉ nhận URL; chưa có presign/finalize contract.
- **Giải pháp:** định nghĩa bucket/path ownership, MIME/size/count, signed upload, finalize/cleanup và authorization.
- **Fallback:** URL text input chỉ cho development.

### GAP-10 — Notification completeness

- **Severity:** MEDIUM.
- **Hiện trạng:** runtime chưa wire; không có mark-all-read; không có realtime transport.
- **Giải pháp:** wire REST trước, thêm bulk read; realtime là phase riêng bằng Supabase Realtime/SSE/WebSocket sau khi có yêu cầu.

### GAP-11 — Error/OpenAPI drift

- **Severity:** HIGH.
- **Hiện trạng:** OpenAPI có kiểm thử hai chiều theo từng method với route Express đang mount; response DTO cụ thể vẫn cần được mở rộng khi endpoint được wire.
- **Giải pháp:** giữ kiểm thử method+path hai chiều trong CI; bổ sung response schemas cụ thể và contract fixtures khi backend hoàn thành từng gap.

### GAP-12 — Seller analytics

- **Severity:** MEDIUM.
- **Hiện trạng:** reporting domain tồn tại nhưng chưa có HTTP seller stats; order list runtime cũng chưa sẵn sàng.
- **Giải pháp:** sau GAP-01, quyết định FE aggregate cho dataset nhỏ hay endpoint `/seller/stats`; ưu tiên endpoint server-side.

## 3. Readiness matrix

| Capability | State | FE có thể làm ngay | Điều kiện production |
|---|---|---|---|
| FE foundation/design system | `READY` | Có | lint/typecheck/a11y |
| Login | `PARTIAL` | Có | Supabase env + app user bootstrap behavior |
| Registration | `BLOCKED` | UI/mock | GAP-06 |
| Product list | `READY` | Có | adapter + loading/error |
| Product detail core | `PARTIAL` | Có | placeholder/ẩn unsupported UI |
| Categories | `MISSING` | mock/ẩn filter | GAP-05; route chưa mount |
| Cart mutation/selection | `READY` | Có | integration test |
| Cart display | `BLOCKED` | mock | GAP-03 |
| Address list/create | `READY` | Có | integration test |
| Address edit/default/delete | `NOT_IMPLEMENTED` | UI/mock | address service/runtime injection; endpoint hiện trả 501 |
| Voucher | `READY` | Có | decimal handling |
| Checkout core | `READY` | Có sau cart selection | idempotency E2E |
| Online provider payment | `BLOCKED` | UI prototype | GAP-02 |
| Order center | `STUB` | mock; hoàn thiện UI và QA | order query/repository phải được inject; GET hiện trả empty/placeholder 200 |
| Cancel/confirm/transition/payment retry | `READY` for mutation only | có thể dùng contract thật với order ID hợp lệ | reads/order IDs cần GAP-01; payment provider vẫn GAP-02 |
| Review submit | `NOT_IMPLEMENTED` | UI text/rating bằng mock, production submit off | GAP-01; images còn GAP-09 |
| Notifications | `NOT_IMPLEMENTED` | UI mock/gated | GAP-01 và GAP-10; route hiện trả 501 |
| Profile | `MISSING` | auth metadata read-only | GAP-07; không có profile route |
| Seller create product | `PARTIAL` | form/URL images | GAP-05, GAP-09 |
| Seller fulfillment | `STUB` for list; mutation ready | mock queue; action handler có thật khi có order ID | GAP-01 order query/repository |
| Seller KPI | `BLOCKED` | mock | GAP-12 |
| Admin | `PARTIAL` | mock reads; có thể dựng isolated lock/unlock action | GAP-08 reads; mutation cần target ID |

## 4. Quyết định sản phẩm/API cần chốt cho phase tiếp theo

Các mục sau không làm milestone T3 chưa hoàn tất; đây là các capability hoặc quyết định ngoài phạm vi hardening hiện tại, cần chốt nếu muốn mở rộng FE production:

1. Registration provisioning dùng trigger hay onboarding endpoint?
2. Online payment có nằm trong MVP không; provider nào và callback model gì?
3. Media upload dùng Supabase Storage trực tiếp hay backend presign?
4. Order query DTO chuẩn là snake_case read model nào?
5. Cart response có join display data hay FE gọi catalog bổ sung?

## 5. Hướng triển khai FE theo runtime hiện có

- Dùng API thật ngay cho public product list/detail (detail thiếu images/shop/reviews), stock mutation, address list/create, cart mutations, voucher list/evaluate và checkout.
- Cart display phải giữ placeholder/mock có nhãn hoặc gated vì `GET /cart` chỉ trả variant IDs và state, không có dữ liệu đủ để xác nhận giá/tồn/shop.
- Không gọi order list/detail như dữ liệu thật. Có thể hoàn thiện UI/contract mock; chỉ gọi order mutation khi có ID từ nguồn đã xác thực.
- Không gọi review/notification writes/reads trong production; hiện trả 501. Làm UI độc lập bằng fixture, giữ submit gated.
- Không gọi profile, categories, seller product list, admin reads, seller stats hoặc media routes; hiện chưa được mount.
- Không dùng `/buyers/addresses`, `/buyers/profile` hoặc FE DTO hiện có nếu chưa sửa theo `06-fe-be-mapping.md`.
- Mốc backend T3 đã hoàn thành; các gap trên là capability runtime/API chưa có hoặc chưa được nối, không phải trạng thái T3 còn dang dở.

Cho tới khi các quyết định trên được chốt, FE phải giữ repository boundary và feature flags để tránh khóa kiến trúc vào mock.
