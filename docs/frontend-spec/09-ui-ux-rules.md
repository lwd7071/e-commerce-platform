# 09. Quy chuẩn UI/UX khi triển khai Frontend

> **Phiên bản:** 1.4.0 — MVP freeze 30/09/2026

> **Trạng thái:** Design handoff cho 5 owner FE
> **Phạm vi:** `frontend/` — Buyer, Seller, Admin. `ecommerce-web/` chỉ là prototype tham khảo, không sửa.
> **Owner:** Người 2; thay đổi ảnh hưởng domain cần owner page tương ứng duyệt

> **Brand contract:** Tên hiển thị là **Dino**; wordmark chỉ là chữ `Dino`, không logo/biểu tượng/emoji. Người 1 cập nhật login/register, Người 3 cập nhật banner/footer/catalog thuộc page mình; Người 4/5 dùng Dino cho nội dung mới. Không đổi tên repo/package/API/database.

## 1. Nguồn quyết định

File này khóa rule hiển thị, tương tác và stack dự kiến. [02](./02-pages-and-user-flow.md) xác định route/luồng, [03](./03-design-system.md) xác định component contract, [04–07](./README.md) xác định dữ liệu/API/readiness, [08](./08-implementation-plan.md) xác định owner và thứ tự triển khai, [10](./10-ui-ux-handoff.md) là handoff theo route. `sodoUI.md` ở gốc repo là sơ đồ tham khảo; chức năng ngoài 14 route hoặc chưa có API phải ghi gap trước khi đưa vào plan. `ecommerce-web/` chỉ tham khảo, không phải workspace hay contract; khi xung đột, token và hành vi ở tài liệu này được ưu tiên. Người 2 ghi quyết định token/component trong progress; owner page ghi nơi tiêu thụ.

## 2. Stack và ranh giới kỹ thuật

| Hạng mục | Quy định |
|---|---|
| Framework | Next.js App Router 16.3.5, React 19.2.8, TypeScript strict theo scaffold hiện có trong `frontend/`. Không lấy config/node_modules hoặc sửa `ecommerce-web/`. |
| Styling mục tiêu | Tailwind CSS 4 + CSS variables trong `frontend/src/app/globals.css`. Token là nguồn chung; không hardcode hex trong page/component mới. |
| Font/icon | `next/font` Geist Sans cho UI, Geist Mono chỉ cho mã/ID kỹ thuật. Icon dùng SVG registry tại `frontend/src/components/ui/icon.tsx` để không thêm package ngoài ownership Người 1. Không trộn bộ icon/font khác giữa các page. |
| Auth và API | Supabase Auth client, `Authorization: Bearer`, API client/error parser, AuthProvider, repository/adapters và mock/API switch đã có trong `frontend/`; kiểm tra runtime readiness trước mỗi API integration. |
| Server data | Tách server state khỏi local UI state bằng feature repository/hooks hiện có. TanStack Query chưa được chọn/cài; không thêm cache dependency nếu chưa chốt với Người 1. |
| Form | Field validation phải khớp backend 05; lỗi server hiển thị tại field hoặc form. Không thêm form/schema package trước khi thống nhất dependency với Người 1. |
| Quality gates | `frontend/package.json` có scripts `typecheck`, `lint`, `test`, `build`; Vitest runner đã có. Dùng Node `24.15.0` theo `.nvmrc` và npm `11.12.1`. Không dùng scripts prototype, không ghi test là pass nếu chưa chạy. |

## 3. Màu và token bắt buộc

Người 2 đã đưa bảng sau vào `frontend/src/app/globals.css` trong U-201. Tên token không tự đổi ở từng feature.

```css
:root {
  /* Brand */
  --primary: #FF7AAC;
  --primary-btn: #E85D94;
  --primary-hover: #D4437D;
  --primary-active: #BF3A6F;
  --primary-surface: #FFF0F6;
  --primary-border: #FFD1E3;

  /* Neutrals */
  --background: #FBF8F9;
  --foreground: #221C1F;
  --card: #FFFFFF;
  --card-muted: #FAF6F8;
  --border: #F0E6EA;
  --subtext: #75686E;

  /* Semantic */
  --success: #059669;
  --success-border: #B2E5C8;
  --success-surface: #ECFDF5;
  --danger: #E11D48;
  --danger-surface: #FFF1F2;
  --danger-border: #FECDD3;
  --warning: #D97706;
  --warning-surface: #FFFBEB;
  --warning-border: #FDE68A;
  --info: #0E7490;
  --info-surface: #ECFEFF;
  --info-border: #A5F3FC;

  /* Shape */
  --radius: 12px;
  --shadow: 0 1px 2px rgba(34, 28, 31, 0.06);

  /* Component aliases: một kiểu nút chính cho toàn FE */
  --button-primary-bg: var(--primary-active);
  --button-primary-fg: #FFFFFF;
}
```

| Cách dùng | Rule |
|---|---|
| `--primary` | Icon/điểm nhấn trang trí, badge, border nhấn; chỉ báo trạng thái phải có text/icon hoặc shape kèm theo. |
| `--primary-btn` | Sắc hồng brand sáng hơn trong palette; không dùng làm nền nút chính với chữ trắng cỡ thường. Nếu dùng trong thành phần khác, phải kiểm tra contrast. |
| `--button-primary-bg` / `--button-primary-fg` | Nút chính thống nhất: nền `#BF3A6F`, chữ trắng semibold. Hover giữ cặp màu này và dùng thay đổi viền/độ sáng nhẹ; active có thể giảm scale rất nhẹ. |
| `--primary-hover`, `--primary-active` | Màu tương tác/brand; chỉ chọn cặp màu chữ/nền đạt contrast tại từng state. |
| `--success`, `--danger`, `--warning`, `--info` | Icon/border/status surface. Text nhỏ phải được đo contrast riêng trên nền thực tế; có thể dùng `--foreground` hoặc token `*-text` đậm hơn. Semantic status viền dùng token `*-border` đã khai báo; không đổi các token palette gốc. |
| `--shadow` | Shadow mặc định cho card/popover; không glow, aura hồng, gradient nền trang hoặc bóng lớn cho UI mới. |

**Chốt CTA cho cả 5 người:** `#E85D94` với chữ trắng chỉ khoảng **3.27:1**, không đạt WCAG AA cho nhãn nút cỡ thông thường (cần 4.5:1). Nút chính dùng `--button-primary-bg` (`#BF3A6F`) và `--button-primary-fg` (trắng), khoảng **5.19:1**. Source dùng màu này cho CTA và visible focus; kiểm tra hover/disabled/focus bằng browser vẫn là QA cần chạy sau khi có scaffold. Không dùng màu như tín hiệu duy nhất. Thay đổi kiểu CTA chung phải qua Người 2 và được cập nhật ở đây trước khi áp dụng cho các page.

## 4. Typography, spacing, layout

- Geist Sans dùng cho heading, body, form, table; fallback `Arial, sans-serif` nếu font không tải. Kiểm tra dấu tiếng Việt trên Windows/mobile trong U-201. Geist Mono chỉ dùng code, ID hoặc log kỹ thuật.
- Body `16px`/line-height `1.5`; heading theo scale `24/20/18px` tùy cấp; label/button `14–16px` semibold; caption/helper tối thiểu `12px`, nội dung nghiệp vụ tối thiểu `14px`. Số tiền dùng tabular numerals và nhấn mạnh bằng weight, không chỉ màu.
- Spacing theo bội số 4px (`4, 8, 12, 16, 24, 32, 48`); card padding `16px` mobile, `24px` desktop; radius mặc định `12px`, avatar/chip tròn dùng radius riêng theo vai trò.
- Mobile bắt đầu từ `360px`; breakpoint Tailwind `sm 640`, `md 768`, `lg 1024`, `xl 1280`. Container tối đa `1280px`, gutter `16px` mobile, `24px` tablet, `32px` desktop. Không ép bảng dữ liệu thành chữ nhỏ để vừa mobile.
- Header và bottom dock có vùng safe-area; sticky action không che keyboard, thông báo, nội dung cuối trang. Touch target tối thiểu `44×44px`.

## 5. Component và tương tác

| Component | Quy định bắt buộc |
|---|---|
| Button | `primary/secondary/ghost/danger`; primary luôn dùng cặp `--button-primary-bg`/`--button-primary-fg`. Có default/hover/active/focus-visible/disabled/loading. Chỉ một CTA chính trong một vùng quyết định. Loading giữ width, chặn submit trùng và thông báo trạng thái. |
| Form | Label luôn hiển thị; helper/error gắn bằng `aria-describedby`; lỗi dùng text + icon/border, `aria-invalid`. Giữ input người dùng khi API lỗi; không đoán field backend chưa hỗ trợ. |
| Card/list/table | Cùng token card/border/shadow; trên mobile chuyển bảng thành list/card hoặc scroll ngang có nhãn. Số căn phải, action dễ chạm. |
| Dialog | Accessible name, focus trap, ESC khi an toàn, trả focus về trigger, khóa scroll nền; destructive action cần xác nhận rõ. |
| Toast/alert | Success `polite`, lỗi quan trọng `assertive`; lỗi form tồn tại cạnh field, không chỉ trong toast. Có `request_id` ở chi tiết lỗi khi API cung cấp. |
| StatusBadge | Text/icon + màu; dùng đúng 7 order states trong file 03. Seller chỉ thấy action transition hợp lệ. |
| Data screen | Có loading/skeleton, empty + hướng tiếp theo, lỗi + retry, unauthorized, dữ liệu null/partial, background refetch; không hiển thị mock như dữ liệu thật trong production. |

## 6. Luồng và handoff UX theo owner

Người 2 ghi một bản mô tả hoặc wireframe cho mỗi route trước khi owner triển khai UI mới: mục tiêu màn hình, thứ tự vùng nội dung, CTA, trạng thái 360px/desktop, điều hướng keyboard, và dữ liệu/API hoặc mock nguồn. Owner feature ghi link/mô tả đó trong ticket và progress của mình.

| Luồng | Owner page | Phải thể hiện |
|---|---|---|
| Public catalog → product detail → add to cart | 3 | Filter/search URL, chọn variant, giá/tồn, guest returnTo, category chưa sẵn sàng. |
| Login/registration | 1 | Session/returnTo, invalid credential, locked user, đăng ký chưa ready. |
| Cart → address/voucher → checkout | 4 | Selected items, lỗi validation, tiền/ship theo BE, idempotency retry và request mơ hồ. |
| Buyer order → review; seller fulfillment | 5 | Reason bắt buộc, transition tuần tự, action theo role, trạng thái review chưa wire. |
| Profile/notifications | 2 | Empty/error, dữ liệu read-only khi API thiếu, mark-read có rollback, không hứa realtime. |
| Seller products/category; admin moderation/KPI | 3 / 5 | Quyền theo role, dữ liệu mock có gắn nhãn dev, filter/sort từ API thật, không ước tính tài chính ở client. |

## 7. Nghiệm thu UI/UX

- Kiểm tra light theme trên 360/768/1280px, Chrome/Edge và keyboard-only; không bắt buộc dark mode ở scope này.
- WCAG 2.2 AA mục tiêu: text thường ≥4.5:1, text lớn/UI/focus indicator ≥3:1; focus-visible, skip link, landmarks, reduced motion, alt phù hợp. Người 2 kiểm tra toàn hệ thống; owner page sửa lỗi phần mình.
- Motion chỉ dùng khi có ích cho feedback, khoảng 150–200ms; tôn trọng `prefers-reduced-motion`. Không autoplay/animation lặp làm nhiễu thao tác.
- Ticket chỉ đóng khi UI states, responsive, keyboard, role và dữ liệu/contract qua review; evidence và tồn đọng ghi vào `docs/frontend-spec/progress/nguoi-N.md`.

## 8. Readiness và media UX cho MVP

- Development mock phải có badge “Dữ liệu demo”; production không được render fixture.
- Capability `BLOCKED`: ẩn navigation/action khi người dùng không thể hoàn thành; direct URL dùng `FeatureUnavailable` có hướng quay lại.
- Capability `LIVE` nhưng request lỗi: ErrorState + retry + request ID; không fallback mock.
- Seller `PENDING|SUSPENDED|LOCKED` thấy shop status và lý do không thể mutation; không hiển thị CTA giả thành công.
- Order `SHIPPING` của Buyer có CTA “Đã nhận hàng”; Seller không thấy action `COMPLETED` hoặc `DELIVERY_FAILED`.
- File upload phải có progress, retry, remove, preview alt, revoke object URL và giữ form khi upload lỗi.
- Axe release gate là 0 critical/serious nhưng không thay keyboard-only/manual accessibility review.
- Breakpoint MVP bắt buộc: 360/768/1280px. Chrome là browser release chính; Edge smoke login/checkout/admin.
