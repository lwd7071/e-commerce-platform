# 10. UI/UX handoff theo route

> **Owner:** Người 2 cho token/shared UI; từng route có page owner ở file 08. <br>
> **Workspace:** `frontend/` (không sửa prototype `ecommerce-web/`). <br>
> **Mục tiêu:** đủ khung bố cục, vai trò, dữ liệu, trạng thái và responsive để từng owner có thể implement mà không tự suy diễn contract.

## Quy ước dùng chung

- Dùng header chung desktop, mobile dock ở màn hình hẹp, skip link và `main` landmark. Active route phải thể hiện cả bằng màu lẫn `aria-current="page"`.
- Mobile tối thiểu 360px; ở 320px không được tạo tràn ngang ngoài thành phần bảng có chủ đích. CTA và controls tối thiểu 44px. Sticky header/dock không che focus hoặc nội dung cuối trang.
- Mỗi màn dữ liệu có skeleton/loading, empty, error+retry, unauthorized, null/partial data và pending mutation. Không dùng dữ liệu demo lẫn với production.
- Form có label nhìn thấy được, lỗi inline gắn với field bằng `aria-describedby`/`aria-invalid`, summary khi nhiều lỗi và focus summary sau submit lỗi. Giữ lại input khi API lỗi.
- Không dùng màu đơn độc để biểu đạt trạng thái. Tôn trọng reduced motion, visible focus, keyboard và contrast theo [09](./09-ui-ux-rules.md).
- Header/navigation hiện nhận `role` qua prop; Người 1 nối role/auth thực sau F-105/F-106. Đây chưa phải authorization guard; BE vẫn là nguồn quyết định quyền.

## Inventory và handoff

| Route | Role/owner | Bố cục và hành động chính | Loading/empty/error/permission | Mobile/keyboard | Data/gap |
|---|---|---|---|---|---|
| `/` | Public — Người 3 | Header/search; hero tĩnh; category; product grid; pagination/load more. CTA mở chi tiết hoặc add đúng variant. | Skeleton card; empty có sửa filter; error retry; ẩn category khi thiếu UUID thật. | Grid 2 cột co về 1; search ở header desktop và có phương án trong trang mobile; dock luôn không che cuối list. | Catalog API partial; không giả rating/sold/category UUID. |
| `/products/[id]` | Public — Người 3 | Gallery/placeholder; title/price/stock/variant; quantity; add-to-cart. | Loading detail; not-found; unavailable stock; API error retry; guest login returnTo. | Gallery trên info; variant bằng keyboard; CTA full-width. | Detail thiếu images/shop/review; ẩn section chưa có data. |
| `/login` | Public-only — Người 1 | Form email/password; show password; submit; help/forgot chỉ khi flow configured. | Pending; invalid credential generic; locked/missing app user; service unavailable. | Form 1 cột; label + errors; focus field/summary hợp lý. | Supabase config/bootstrap. |
| `/register` | Public-only — Người 1 | Email/password/confirm/name; account type chỉ khi onboarding được chốt. | Blocked/coming later; không giả thành công. | Form 1 cột, errors và pending. | GAP-AUTH-ONBOARDING; production submit tắt. |
| `/cart` | Buyer — Người 4 | Selected items; quantity/remove; subtotal/checkout summary. | Loading; empty có CTA về catalog; unavailable/error; stale item rollback. | Item card thay table; tổng tiền cuối trang không che dock; nút checkout dễ chạm. | Cart response thiếu dữ liệu gắn product; dùng adapter/mock tới GAP-03. |
| `/checkout` | Buyer — Người 4 | Address; item summary; voucher theo shop; COD/ONLINE; server quote; submit. | Address missing/create; voucher rejection tại field/summary; submit pending; timeout giữ snapshot+key để retry; success orders. | 1 cột; summary có thể thu gọn; không sticky che form. | Shipping `0`, không tự cộng phí; payload và idempotency theo 02/05. |
| `/orders` | Buyer — Người 5 | Status tabs; order list/card; cancel qua dialog có reason bắt buộc. | Loading; empty; error; cancel 409 refresh; unauthorized. | Cards thay grid/table; dialog mobile vừa viewport. | GET orders RUNTIME_BLOCKED tới GAP-01. |
| `/orders/[id]/review` | Buyer — Người 5 | Chỉ item đủ điều kiện; rating; nội dung; preview ảnh gated. | No eligible items; submit pending; service chưa wire báo rõ; lỗi field. | Rating keyboard accessible; ảnh preview có remove khi API sẵn. | Review service và media GAP-01/GAP-09. |
| `/notifications` | Buyer — Người 2 | Filter tất cả/chưa đọc; list; mark one; bulk chỉ khi implement bounded item calls hoặc BE có endpoint. | Loading; empty; runtime 501; unauthorized; mutation rollback khi nối thật. | List card; controls 44px; count có text. | Runtime 501; không realtime. Demo hiện chỉ non-production và local state; production gated. |
| `/profile` | Authenticated — Người 2 | Avatar; name/phone/email; edit/save chỉ khi profile contract; address shortcut. | Loading metadata; absent metadata; error; signed-out prompt; save disabled đến GAP-07. | Summary trên form; fields 1 cột; file input chỉ bật khi media contract. | Metadata tạm thời không phải business profile; avatar gated GAP-09. |
| `/seller` | Seller — Người 5 | Queue, bảng product/stock, KPI section. | Skeleton; empty; API blocked; unauthorized; mutation pending/refetch. | Bảng thành cards hoặc horizontal scroller có label; KPI không ước tính. | Orders/stats blocked; stock mutation sẵn theo contract. |
| `/seller/products/new` | Seller — Người 3 | Basic info; category; variants; image URL/upload placeholder; submit. | Validation; category empty/blocked; row add/remove; upload unavailable. | Form 1 cột; variant rows không ép chữ nhỏ. | `stock_quantity` khi create; category UUID phải từ DB; media GAP-09. |
| `/admin` | Admin — Người 5 | Dashboard/tabs user/shop/product/log; lock/unlock cần reason. | Empty/mock marked; permission; API list error; pending/refetch. | KPI stack; tables chuyển list/card hoặc labeled scroll. | Lists/moderation gaps 08; production mock off. |
| `/admin/categories` | Admin — Người 5 | Tree/list; create/edit/status. | Empty; form validation; conflict/error; unauthorized. | Tree có disclosure accessible; action menu keyboard. | Category API missing; local mock only, production disabled. |

## Component contract Người 2 bàn giao

- `Button`: variant `primary | secondary | ghost | danger`, loading/disabled, icon slots; mặc định `type="button"` để tránh submit nhầm.
- Form controls: `FormField`, `TextInput`, `TextArea`, `SelectInput`, `ErrorSummary`. Consumer tự truyền `describedBy` trỏ tới help text; error id tự nối theo `<id>-error`.
- `Dialog`: native modal semantics, accessible title, ESC/backdrop/close và browser-managed focus/scroll containment. Với destructive operation, consumer quyết định có cho đóng khi pending hay không.
- `ToastProvider/useToast`: success/info polite, lỗi alert; form errors phải ở cạnh field, không chỉ toast.
- `StatusBadge`: enum 7 trạng thái đúng file 03; không tự mở rộng enum từ view model.
- `Skeleton`, `EmptyState`, `ErrorState`: primitive dùng chung; retry callback do feature owner sở hữu.
- `SiteHeader`, `MobileDock`: `role?: BUYER | SELLER | ADMIN | null`; hiện chưa gắn auth provider, không thay route guard. Search submit GET `/?q=...`.

## Decision cần owner xác nhận khi tích hợp

1. Người 1 thêm scaffold trong `frontend/`, chạy lint/typecheck/build và xác nhận version/package thực tế; shared component chưa được coi là compile-verified cho tới lúc đó.
2. Người 1 truyền auth role và metadata xuống shell/Profile. Không đọc metadata trực tiếp từ client trong Người 2 khi chưa có provider contract.
3. Notifications chỉ đổi mock repository sang API khi 501 runtime wiring đã pass; bulk action không gọi endpoint chưa tồn tại. Lúc nối API, xử lý từng ID tối đa 20 mỗi batch hoặc chờ GAP-10.
4. Người 3/4/5 cung cấp page sample trước khi Người 2 đóng D-004 ở 360/1280px.
