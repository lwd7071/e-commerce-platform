# 07. Gap analysis và integration readiness

> **Phiên bản:** 1.1.0  
> **Trạng thái:** ACTION REQUIRED

## 1. Cách đánh giá

Không dùng phần trăm cảm tính. Mỗi capability nhận một trạng thái dựa trên bằng chứng runtime:

- `READY`: có contract và runtime integration path hoạt động.
- `PARTIAL`: dùng được một phần nhưng thiếu data/behavior cho UI.
- `BLOCKED`: không thể hoàn tất production flow.

## 2. Gaps ưu tiên

### GAP-01 — Runtime service wiring

- **Severity:** BLOCKER.
- **Hiện trạng:** order reads trả rỗng/stub; review, notification và address item routes chưa có service runtime (trả 501 `NOT_IMPLEMENTED`). `DELETE /addresses/:id` trước đây trả 204 no-op; runtime hiện trả 501 để không báo thành công giả. `DELETE /cart/selected` đã được wire cho PostgreSQL runtime.
- **Ảnh hưởng:** `/orders`, review, notifications, seller fulfillment không thể chạy end-to-end.
- **Giải pháp:** wire concrete repositories/services vào `createRuntimeApp()`, thêm integration test gọi đúng runtime composition, sau đó cập nhật OpenAPI.
- **Đóng gap khi:** test list/detail order, review create, notification list/read, address CRUD pass trên database test.

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
- **Hiện trạng:** có bảng DB nhưng không có route.
- **Giải pháp:** public `GET /categories`; admin create/update/status với validation parent cycle và active status.
- **Fallback:** static config chỉ dùng development và chỉ chứa category UUID sao chép/xác minh từ seed hoặc DB thật của đúng environment. Không tự bịa/generate UUID: product filter so khớp trực tiếp `category_id` trong DB nên UUID không tồn tại trả mảng rỗng. Nếu chưa xác minh được ID thì ẩn filter.

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
- **Hiện trạng:** chỉ có lock/unlock user; không có list users/logs/shops/products và route moderate shop/product.
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
| Categories | `BLOCKED` | mock | GAP-05 |
| Cart mutation/selection | `READY` | Có | integration test |
| Cart display | `BLOCKED` | mock | GAP-03 |
| Address list/create | `READY` | Có | integration test |
| Address edit/default/delete | `BLOCKED` | UI/mock | GAP-01 |
| Voucher | `READY` | Có | decimal handling |
| Checkout core | `READY` | Có sau cart selection | idempotency E2E |
| Online provider payment | `BLOCKED` | UI prototype | GAP-02 |
| Order center | `BLOCKED` | mock | GAP-01 |
| Review submit/list | `BLOCKED` | UI/mock | GAP-01, GAP-04, GAP-09 |
| Notifications | `BLOCKED` | UI/mock | GAP-01, GAP-10 |
| Profile | `BLOCKED` | read-only metadata | GAP-07, GAP-09 |
| Seller create product | `PARTIAL` | form/URL images | GAP-05, GAP-09 |
| Seller fulfillment | `BLOCKED` | mock | GAP-01 |
| Seller KPI | `BLOCKED` | mock | GAP-12 |
| Admin | `BLOCKED` | mock + isolated mutations | GAP-08 |

## 4. Backend decisions cần chốt

1. Registration provisioning dùng trigger hay onboarding endpoint?
2. Online payment có nằm trong MVP không; provider nào và callback model gì?
3. Media upload dùng Supabase Storage trực tiếp hay backend presign?
4. Order query DTO chuẩn là snake_case read model nào?
5. Cart response có join display data hay FE gọi catalog bổ sung?

Cho tới khi các quyết định trên được chốt, FE phải giữ repository boundary và feature flags để tránh khóa kiến trúc vào mock.
