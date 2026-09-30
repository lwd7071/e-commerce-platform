# 10. UI/UX handoff theo route

> **Phiên bản:** 1.4.0 — MVP freeze 30/09/2026

> **Owner:** Người 2 cho token/shared UI; từng route có page owner ở file 08. <br>
> **Workspace:** `frontend/` (không sửa prototype `ecommerce-web/`). <br>
> **Mục tiêu:** đủ khung bố cục, vai trò, dữ liệu, trạng thái và responsive để từng owner có thể implement mà không tự suy diễn contract.

## Quy ước dùng chung

- Dùng header chung desktop, mobile dock ở màn hình hẹp, skip link và `main` landmark. Active route phải thể hiện cả bằng màu lẫn `aria-current="page"`.
- Mobile tối thiểu 360px; ở 320px không được tạo tràn ngang ngoài thành phần bảng có chủ đích. CTA và controls tối thiểu 44px. Sticky header/dock không che focus hoặc nội dung cuối trang.
- Mỗi màn dữ liệu có skeleton/loading, empty, error+retry, unauthorized, null/partial data và pending mutation. Không dùng dữ liệu demo lẫn với production.
- Form có label nhìn thấy được, lỗi inline gắn với field bằng `aria-describedby`/`aria-invalid`, summary khi nhiều lỗi và focus summary sau submit lỗi. Giữ lại input khi API lỗi.
- Không dùng màu đơn độc để biểu đạt trạng thái. Tôn trọng reduced motion, visible focus, keyboard và contrast theo [09](./09-ui-ux-rules.md).
- `AppShell` lấy role từ `AuthProvider`; header/navigation lọc menu theo role. `ProtectedPage` hỗ trợ allowed roles để tạo unauthorized UX; FE guard không phải bảo mật và BE vẫn là nguồn quyết định quyền.
- Brand dùng chữ `Dino` làm wordmark text-only, không logo/emoji. Owner page chịu trách nhiệm thay copy cũ trong page của mình theo hợp đồng ở file 08/09.

### Navigation matrix đang được nối qua AuthProvider

| Trạng thái/role | Menu chính |
|---|---|
| Guest | Khám phá; nút Đăng nhập |
| Buyer | Khám phá, Giỏ hàng, Đơn hàng, Thông báo, Tài khoản |
| Seller | Khám phá, Kênh người bán, Tài khoản |
| Admin | Khám phá, Quản trị, Danh mục, Tài khoản |

`aria-current="page"` đánh dấu route hiện hành. `/profile` dành cho mọi role đã đăng nhập; `/notifications` chỉ Buyer. Role guard FE là UX, backend tiếp tục cưỡng chế quyền.

## Inventory và handoff

| Route | Role/owner | Bố cục và hành động chính | Loading/empty/error/permission | Mobile/keyboard | Data/gap |
|---|---|---|---|---|---|
| `/` | Public — Người 3 | Header/search; hero tĩnh; category; product grid; pagination/load more. CTA mở chi tiết hoặc add đúng variant. | Skeleton card; empty có sửa filter; error retry; ẩn category khi thiếu UUID thật. | Grid 2 cột co về 1; search ở header desktop và có phương án trong trang mobile; dock luôn không che cuối list. | Catalog API partial; không giả rating/sold/category UUID. |
| `/products/[id]` | Public — Người 3 | Gallery/placeholder; title/price/stock/variant; quantity; add-to-cart. | Loading detail; not-found; unavailable stock; API error retry; guest login returnTo. | Gallery trên info; variant bằng keyboard; CTA full-width. | Detail thiếu images/shop/review; ẩn section chưa có data. |
| `/login` | Public-only — Người 1 | Form email/password; show password; submit; help/forgot chỉ khi flow configured. | Pending; invalid credential generic; locked/missing app user; service unavailable. | Form 1 cột; label + errors; focus field/summary hợp lý. | Supabase config/bootstrap. |
| `/register` | Public-only — Người 1 | Email/password/confirm/name; account type chỉ khi onboarding được chốt. | Blocked/coming later; không giả thành công. | Form 1 cột, errors và pending. | GAP-AUTH-ONBOARDING; production submit tắt. |
| `/cart` | Buyer — Người 4 | Selected items; quantity/remove; subtotal/checkout summary. | Loading; empty có CTA về catalog; unavailable/error; stale item rollback. | Item card thay table; tổng tiền cuối trang không che dock; nút checkout dễ chạm. | Enriched cart live; API lỗi không fallback fixture. |
| `/checkout` | Buyer — Người 4 | Address; item summary; voucher theo shop; COD/ONLINE; server quote; submit. | Address missing/create; voucher rejection tại field/summary; submit pending; timeout giữ snapshot+key để retry; success orders. | 1 cột; summary có thể thu gọn; không sticky che form. | Shipping `0`, không tự cộng phí; payload và idempotency theo 02/05. |
| `/orders` | Buyer — Người 5 | Status tabs; timeline; cancel; Buyer confirm received ở SHIPPING. | Loading; empty; error; 409 refresh; unauthorized; shipment missing conflict. | Cards thay grid/table; dialog mobile vừa viewport. | Order reads live; timeline/confirm-received theo C-101–C-106. |
| `/orders/[id]/review` | Buyer — Người 5 | Chỉ item của Order COMPLETED; rating/content; tối đa 3 ảnh. | No eligible items; submit pending; duplicate/blocked/error states. | Rating keyboard accessible; preview remove/revoke URL. | Text/rating live sau ReviewService; media chờ capability B. |
| `/notifications` | Buyer — Người 2 | Filter tất cả/chưa đọc; API list/read; bounded bulk tối đa 20 item. | Loading/error/retry; empty; unauthorized; mark-one rollback; partial rollback khi 429. | List card; controls 44px; count có text. | API repository và OpenAPI DTO đã có; production mặc định BLOCKED cho đến khi `NEXT_PUBLIC_NOTIFICATIONS_API=live`; không fallback demo. Chưa chạy authenticated browser/host smoke, không realtime. |
| `/profile` | Authenticated — Người 2 | Email read-only; full name/phone qua Profile API; avatar upload bằng `media_id`. | Phân biệt loading, signed-out, missing profile và API error; save/upload lỗi giữ input; avatar phản ánh URL server sau reload. | Summary trên form; fields 1 cột; avatar preview accessible. | Product/avatar media live; avatar E2E qua Supabase test pass. |
| `/seller` | Seller — Người 5 | Queue, bảng product/stock, KPI section. | Skeleton; empty; API blocked; unauthorized; mutation pending/refetch. | Bảng thành cards hoặc horizontal scroller có label; KPI không ước tính. | Orders/stats blocked; stock mutation sẵn theo contract. |
| `/seller/products/new` | Seller — Người 3 | Basic info; category; variants; upload 1–5 ảnh finalized; submit. | Validation; Shop PENDING/LOCKED; upload retry/remove; create rollback/cleanup. | Form 1 cột; variant rows không ép chữ nhỏ. | Category UUID thật; media IDs; Shop phải ACTIVE. |
| `/admin` | Admin — Người 5 | Dashboard/tabs user/shop/product/log; lock/unlock cần reason. | Empty/mock marked; permission; API list error; pending/refetch. | KPI stack; tables chuyển list/card hoặc labeled scroll. | Lists/moderation gaps 08; production mock off. |
| `/admin/categories` | Admin — Người 5 | Tree/list; create/edit/status. | Empty; form validation; conflict/error; unauthorized. | Tree có disclosure accessible; action menu keyboard. | Category API missing; local mock only, production disabled. |

## Component contract Người 2 bàn giao

- `Button`: variant `primary | secondary | ghost | danger`, loading/disabled, icon slots; mặc định `type="button"` để tránh submit nhầm.
- Form controls: `FormField`, `TextInput`, `TextArea`, `SelectInput`, `ErrorSummary`. `FormField` tự gắn help/error ID vào `aria-describedby` và `aria-invalid`; control cần có `id` trùng field ID.
- `Dialog`: native modal semantics, accessible title, ESC/backdrop/close và browser-managed focus/scroll containment. Với destructive operation, consumer quyết định có cho đóng khi pending hay không.
- `ToastProvider/useToast`: success/info polite, lỗi alert; form errors phải ở cạnh field, không chỉ toast.
- `StatusBadge`: enum 7 trạng thái đúng file 03; không tự mở rộng enum từ view model.
- `Skeleton`, `EmptyState`, `ErrorState`: primitive dùng chung; retry callback do feature owner sở hữu.
- `SiteHeader`, `MobileDock`: menu theo Guest/Buyer/Seller/Admin từ role hiện hành; brand text `Dino`; route guard vẫn là UX, không thay authorization phía BE. Search submit GET `/?q=...`.

## Decision cần owner xác nhận khi tích hợp

1. Nền scaffold/API/auth/repository/test runner đã tồn tại (commit `5ace145`); không tạo lại hoặc sửa package/lockfile ngoài ownership Người 1.
2. `AuthProvider` cấp role và metadata cho shell/Profile; chỉ đọc email/full name, không xem đó là business profile contract.
3. Notifications đổi sang API khi runtime wiring pass; bulk UI gọi từng item tối đa 20, concurrency 4, partial rollback và dừng queue khi 429; không tự tạo bulk endpoint.
4. Homepage, checkout và Seller orders đã được Người 2 rà ở 360/1280px; xem handoff trong `progress/nguoi-2.md`. Admin dashboard chưa có route/page nên D-004 chỉ còn chờ sample Admin; Q-802/Q-803 chỉ đạt trong phạm vi đã kiểm, không đóng gate toàn hệ thống.

## Handoff bổ sung đã khóa

| Route/flow | Owner | Bổ sung bắt buộc |
|---|---|---|
| `/register`, `/complete-profile` | 1 | Seller onboarding tạo Shop `PENDING`; hiển thị chờ duyệt; refresh `/auth/me` sau onboarding |
| `/seller/products/new` | 3 | Upload 1–5 ảnh thật trước create product; lỗi upload giữ form; Shop chưa ACTIVE nhận unavailable state |
| `/seller/products` | 3 | Search/filter/create/stock và ACTIVE↔INACTIVE; không có production mock fallback |
| `/orders` | 5 | Timeline từ history DTO; Buyer SHIPPING có “Đã nhận hàng”; cancel actions đúng actor/status |
| `/orders/[id]/review` | 5 | Chỉ mở cho item thuộc Order COMPLETED; text/rating không chờ media, ảnh tối đa 3 |
| `/products/[id]` | 3 | Sau review integration hiển thị rating average/count và review list thật |
| `/notifications` | 2 | REST thật; mark tối đa 20 với concurrency 4, partial failure và rollback |
| `/admin`, `/admin/shops` | 5 | Live APIs; Admin target không có lock action; moderation mutation phải tạo audit |
| `/admin/categories` | 5 | CRUD/status API thật; không tạo ID local; tree tối đa hai cấp |

Khi capability chưa live, menu/CTA bị ẩn trong production; direct URL phải dùng `FeatureUnavailable`. Development được dùng fake repository nhưng phải gắn badge demo.
