# 03. Design system và UI components

> **Phiên bản:** 1.4.0
>
> **Trạng thái:** IMPLEMENTED IN `frontend/`; BROWSER QA IN PROGRESS

## 1. Art direction

Phong cách nền sáng trung tính, bề mặt mờ và sắc hồng làm điểm nhấn. Quy chuẩn token, typography, stack và handoff UI/UX nằm ở [09-ui-ux-rules.md](./09-ui-ux-rules.md). Không dùng glow/aura; tương phản và khả năng thao tác được ưu tiên khi chọn cặp màu.

## 2. Tokens

Token source of truth là `frontend/src/app/globals.css` (xem bộ CSS đầy đủ và ngoại lệ contrast ở file 09). Shared primitives/shell đang được nghiệm thu trong phạm vi Người 2; không lấy prototype `ecommerce-web/` làm nguồn.

| Token | Giá trị | Dùng cho |
|---|---:|---|
| `--primary` | `#FF7AAC` | Icon/điểm nhấn, không dùng làm chữ nhỏ trên nền trắng |
| `--primary-btn` | `#E85D94` | Sắc hồng brand, không ghép chữ trắng cỡ thường |
| `--primary-hover` | `#D4437D` | Hover |
| `--primary-active` | `#BF3A6F` | Pressed hoặc CTA chữ trắng cỡ thường |
| `--primary-surface` | `#FFF0F6` | Selected surface |
| `--primary-border` | `#FFD1E3` | Focus/selected border |
| `--background` | `#FBF8F9` | Page background |
| `--foreground` | `#221C1F` | Primary text |
| `--card` | `#FFFFFF` | Card/dialog |
| `--card-muted` | `#FAF6F8` | Secondary surface |
| `--border` | `#F0E6EA` | Border |
| `--subtext` | `#75686E` | Secondary text |
| `--radius` | `12px` | Radius mặc định |
| `--shadow` | `0 1px 2px rgba(34, 28, 31, 0.06)` | Shadow nhẹ, không glow |
| `--button-primary-bg` / `--button-primary-fg` | `#BF3A6F` / `#FFFFFF` | Cặp màu nút chính thống nhất |

Các class `.btn-matte-primary`, `.btn-matte-secondary`, `.matte-card`, `.matte-glass`, `.matte-dock` thuộc prototype. Page mới dùng token/component trong `frontend/`, không sao chép hardcoded color/glow từ prototype.

Khi cấu hình Tailwind `@theme`, dùng CSS variables làm nguồn chung và map utility theo vai trò (`bg-background`, `bg-card`, `text-foreground`, `border-border`, v.v.). Không tạo utility glow.

## 3. Typography và layout

- Font stack: Geist Sans qua `next/font`, fallback `Arial, sans-serif`; Geist Mono chỉ dùng cho nội dung kỹ thuật.
- Body: 16px, line-height tối thiểu 1.5.
- Caption: tối thiểu 12px; nội dung nghiệp vụ không dùng 11px.
- Container: `max-w-7xl`, padding ngang 16px mobile, 24px tablet, 32px desktop.
- Breakpoints theo Tailwind: `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`.
- Spacing dùng scale 4px; tránh arbitrary value nếu token chuẩn đáp ứng được.

## 4. Component contract

### Button

Variants: `primary | secondary | ghost | danger`. States bắt buộc: default, hover, active, focus-visible, disabled, loading. Khi loading phải giữ nguyên chiều rộng và có `aria-busy`. Mọi nút primary dùng cặp `--button-primary-bg`/`--button-primary-fg` theo file 09; không tạo biến thể CTA khác theo page.

### Form controls

`Input`, `Textarea`, `Select`, `Checkbox`, `Radio` phải hỗ trợ label, description, error, `aria-invalid`, focus ring, disabled/read-only và server validation message.

### Dialog

- `role="dialog"`, `aria-modal="true"`, có accessible name.
- Focus trap; ESC đóng; trả focus về trigger.
- Click backdrop chỉ đóng dialog không phá hủy dữ liệu; dialog nguy hiểm phải yêu cầu action rõ ràng.
- Khóa scroll nền.

### Toast

- Success dùng live region `polite`; lỗi quan trọng dùng `assertive` vừa phải.
- Toast không phải nơi duy nhất hiển thị lỗi form.
- Error có `request_id` trong phần chi tiết/copy action khi phù hợp.

### StatusBadge

Không chỉ dùng màu; luôn có text/icon.

| Status | Label |
|---|---|
| `PENDING_CONFIRMATION` | Chờ xác nhận |
| `CONFIRMED` | Đã xác nhận |
| `PREPARING` | Đang chuẩn bị |
| `SHIPPING` | Đang giao |
| `COMPLETED` | Hoàn thành |
| `CANCELLED` | Đã hủy |
| `DELIVERY_FAILED` | Giao thất bại |

### Data screen states

Mọi màn hình tải dữ liệu phải có skeleton, empty state, error + retry và trạng thái background revalidation không chặn toàn trang.

## 5. Responsive và accessibility

- Touch target tối thiểu 44×44px.
- Mobile bottom dock chỉ hiện dưới `md`, chừa `padding-bottom` và safe-area inset.
- Table chuyển thành card/list hoặc horizontal scroll có nhãn; không ép font nhỏ.
- Sticky action không che toast, keyboard hoặc nội dung cuối trang.
- Mục tiêu WCAG 2.2 AA; mọi thao tác dùng được bằng keyboard.
- Có skip link và landmark `header/nav/main/footer`.
- Tôn trọng `prefers-reduced-motion`.
- Ảnh sản phẩm có alt mô tả; ảnh trang trí dùng alt rỗng.

## 6. Component location

```text
src/components/ui/
├── button.tsx
├── input.tsx
├── dialog.tsx
├── status-badge.tsx
├── toast.tsx
├── skeleton.tsx
└── empty-state.tsx
```

Tách component theo từng vertical slice; không refactor toàn bộ UI trước khi có nhu cầu sử dụng thực tế.

## 7. MVP additions ngày 30/09/2026

- `FeatureUnavailable`: direct route của capability `BLOCKED` phải giải thích rõ, không render màn trắng hoặc fixture production.
- `ErrorSummary`: sau submit nhiều lỗi phải nhận focus, giữ inline errors và link tới field tương ứng.
- `FileUploadZone`: revoke object URL khi remove/unmount; production không được fallback URL ảnh giả.
- Product image dùng `next/image` với container có kích thước ổn định; alt mô tả sản phẩm, ảnh trang trí alt rỗng.
- Shared UX được hoàn thiện trong từng vertical slice. Việc tách `CheckoutScreen`/`SellerOrdersScreen` chỉ làm sau khi behavior tests đã xanh và không chặn MVP.
