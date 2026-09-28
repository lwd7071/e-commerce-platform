# 03. Design system và UI components

> **Phiên bản:** 1.1.0  
> **Trạng thái:** IMPLEMENTATION TARGET

## 1. Art direction

Phong cách **Matte Velvet Luxury** dùng nền sáng trung tính, bề mặt mờ, sắc hồng làm điểm nhấn và chuyển động nhẹ. Hiệu ứng không được làm giảm độ tương phản hoặc khả năng thao tác.

## 2. Tokens

Các token hiện có trong `ecommerce-web/src/app/globals.css`:

| Token | Giá trị | Dùng cho |
|---|---:|---|
| `--primary` | `#FF7AAC` | CTA, active icon |
| `--primary-hover` | `#E85D94` | Hover |
| `--primary-active` | `#D4437D` | Pressed |
| `--primary-surface` | `#FFF0F6` | Selected surface |
| `--primary-border` | `#FFD1E3` | Focus/selected border |
| `--primary-glow` | `rgba(255,122,172,.28)` | Glow có kiểm soát |
| `--background` | `#FBF8F9` | Page background |
| `--foreground` | `#221C1F` | Primary text |
| `--card-bg` | `#FFFFFF` | Card/dialog |
| `--card-matte` | `#FAF6F8` | Secondary surface |
| `--card-border` | `#F0E6EA` | Border |
| `--subtext` | `#82757B` | Secondary text |

Tên class hiện hành là `.btn-matte-primary`, `.btn-matte-secondary`, `.matte-card`, `.matte-glass`, `.matte-dock`. Không dùng `.velvet-button` trừ khi class này được thêm chính thức.

Khi cấu hình Tailwind `@theme`, giữ CSS variables làm source of truth và map sang utility `bg-primary`, `text-primary`, `border-card`, `shadow-glow`.

## 3. Typography và layout

- Font stack: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- Body: 15–16px, line-height tối thiểu 1.5.
- Caption: tối thiểu 12px; nội dung nghiệp vụ không dùng 11px.
- Container: `max-w-7xl`, padding ngang 16px mobile, 24px tablet, 32px desktop.
- Breakpoints theo Tailwind: `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`.
- Spacing dùng scale 4px; tránh arbitrary value nếu token chuẩn đáp ứng được.

## 4. Component contract

### Button

Variants: `primary | secondary | ghost | danger`. States bắt buộc: default, hover, active, focus-visible, disabled, loading. Khi loading phải giữ nguyên chiều rộng và có `aria-busy`.

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
