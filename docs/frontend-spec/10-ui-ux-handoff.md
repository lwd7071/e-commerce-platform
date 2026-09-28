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
| `/cart` | Buyer — Người 4 | Selected items; quantity/remove; subtotal/checkout summary. | Loading; empty có CTA về catalog; unavailable/error; stale item rollback. | Item card thay table; tổng tiền cuối trang không che dock; nút checkout dễ chạm. | Cart response thiếu dữ liệu gắn product; dùng adapter/mock tới GAP-03. |
| `/checkout` | Buyer — Người 4 | Address; item summary; voucher theo shop; COD/ONLINE; server quote; submit. | Address missing/create; voucher rejection tại field/summary; submit pending; timeout giữ snapshot+key để retry; success orders. | 1 cột; summary có thể thu gọn; không sticky che form. | Shipping `0`, không tự cộng phí; payload và idempotency theo 02/05. |
| `/orders` | Buyer — Người 5 | Status tabs; order list/card; cancel qua dialog có reason bắt buộc. | Loading; empty; error; cancel 409 refresh; unauthorized. | Cards thay grid/table; dialog mobile vừa viewport. | GET orders RUNTIME_BLOCKED tới GAP-01. |
| `/orders/[id]/review` | Buyer — Người 5 | Chỉ item đủ điều kiện; rating; nội dung; preview ảnh gated. | No eligible items; submit pending; service chưa wire báo rõ; lỗi field. | Rating keyboard accessible; ảnh preview có remove khi API sẵn. | Review service và media GAP-01/GAP-09. |
| `/notifications` | Buyer — Người 2 | Filter tất cả/chưa đọc; list; mark one; bounded bulk demo tối đa 20 item. | Loading; empty; runtime 501; unauthorized; mutation rollback khi nối thật. | List card; controls 44px; count có text. | Runtime 501; không realtime. Demo chỉ non-production/local state; production gated và không gọi endpoint 501. |
| `/profile` | Authenticated — Người 2 | Read-only auth metadata (name/email); phone/avatar chỉ hiển thị chưa có dữ liệu/API; address shortcut chỉ khi destination sẵn sàng. | Loading metadata; absent metadata; error; signed-out prompt; mutation disabled đến GAP-07. | Summary trên form; fields 1 cột; avatar initials tới khi media contract. | Auth metadata không phải business profile; avatar URL không render, upload gated GAP-09. |
| `/seller` | Seller — Người 5 | Queue, bảng product/stock, KPI section. | Skeleton; empty; API blocked; unauthorized; mutation pending/refetch. | Bảng thành cards hoặc horizontal scroller có label; KPI không ước tính. | Orders/stats blocked; stock mutation sẵn theo contract. |
| `/seller/products/new` | Seller — Người 3 | Basic info; category; variants; image URL/upload placeholder; submit. | Validation; category empty/blocked; row add/remove; upload unavailable. | Form 1 cột; variant rows không ép chữ nhỏ. | `stock_quantity` khi create; category UUID phải từ DB; media GAP-09. |
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
3. Notifications chỉ đổi mock repository sang API khi 501 runtime wiring đã pass; bulk action không gọi endpoint chưa tồn tại. Lúc nối API, xử lý từng ID tối đa 20 mỗi batch hoặc chờ GAP-10.
4. Người 3/4/5 cung cấp page sample trước khi Người 2 đóng D-004 ở 360/1280px; Q-802/Q-803 có thể đạt riêng cho shell/profile/notifications nhưng không đóng gate toàn hệ thống.
