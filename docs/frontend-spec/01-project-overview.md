# 01. Tổng quan dự án và kiến trúc kỹ thuật

> **Phiên bản:** 1.1.0  
> **Trạng thái:** READY FOR FE FOUNDATION

## 1. Phạm vi

E-Commerce Platform là marketplace đa người bán với bốn nhóm người dùng: Guest, Buyer, Seller và Admin. Frontend cần hỗ trợ khám phá sản phẩm, giỏ hàng, checkout tách đơn theo shop, quản lý đơn, đánh giá, thông báo, seller portal và admin moderation.

Phạm vi bản triển khai đầu tiên:

- Buyer core flow là ưu tiên cao nhất.
- Seller fulfillment triển khai sau khi order query runtime được wire.
- Admin và profile được phát triển bằng mock adapter cho tới khi backend bổ sung API đọc dữ liệu.
- VietQR/Momo/Card, chat và realtime notification chưa thuộc contract backend hiện hành.

## 2. Tech stack đã kiểm chứng

### Backend

- Node.js 22, TypeScript 5.8, Express 4.
- PostgreSQL/Supabase, Prisma 7 dùng cho migration và client dependency; schema nghiệp vụ hiện nằm chủ yếu trong SQL migrations.
- Supabase JWT RS256/JWKS, RBAC `BUYER | SELLER | ADMIN`.
- API base URL `/api/v1`.

### Frontend

- Next.js 16.3.5 App Router, React 19.2.8, TypeScript 5.8.
- Tailwind CSS 4 và CSS variables tại `ecommerce-web/src/app/globals.css`.
- `lucide-react` cho icon.
- Chưa có Supabase client SDK, API client, query cache hoặc production state layer.

## 3. Kiến trúc FE mục tiêu

```text
src/
├── app/                    # route composition, loading/error/not-found
├── components/
│   ├── ui/                # Button, Input, Dialog, Badge, Skeleton...
│   └── features/          # catalog, cart, checkout, orders...
├── lib/
│   ├── auth/              # Supabase browser/server helpers
│   ├── api/               # fetch client, endpoint modules, errors
│   ├── adapters/          # snake_case wire DTO -> camelCase view-model
│   └── money/             # parse/format money safely
├── mocks/                 # adapters có cùng interface với API modules
└── types/                 # wire DTO và shared view-model
```

Nguyên tắc:

- Component không gọi `fetch` trực tiếp.
- Wire DTO giữ nguyên snake_case; UI dùng camelCase view-model.
- Không dùng converter snake_case đệ quy toàn cục vì dễ làm sai field động; viết adapter theo endpoint.
- Error được chuẩn hóa thành `AppError { status, code, message, details, requestId }`.
- Auth guard ở FE chỉ phục vụ UX; backend vẫn là nơi thực thi bảo mật.

## 4. Authentication và onboarding

Frontend lấy Supabase access token và gửi `Authorization: Bearer <access_token>`.

Backend xác minh JWT rồi tìm user trong bảng `app_users`. Nếu JWT hợp lệ nhưng chưa có `app_users`, request vẫn bị từ chối. Supabase `signUp` chưa đủ để hoàn tất đăng ký ứng dụng. Cần database trigger/function hoặc backend onboarding endpoint để tạo `app_users` và `user_profiles`.

Đăng ký Seller còn cần workflow tạo shop và trạng thái duyệt. Client không được tự gán `ADMIN`; việc chọn `SELLER` phải được backend kiểm soát. Cho tới khi chốt workflow, `/login` có thể tích hợp Supabase, còn `/register` dùng mock/feature flag và được đánh dấu blocked.

## 5. RBAC

| Role | Quyền chính |
|---|---|
| Guest | Xem catalog và product detail công khai |
| Buyer | Cart, address, voucher, checkout, order của mình, review, notification |
| Seller | Tạo sản phẩm, cập nhật tồn kho, xử lý order thuộc shop |
| Admin | Lock/unlock user; các màn đọc danh sách vẫn cần API bổ sung |

Route guard mục tiêu:

- Public-only: `/login`, `/register`.
- Buyer: `/cart`, `/checkout`, `/orders`, `/orders/[id]/review`, `/notifications`.
- Authenticated: `/profile`.
- Seller: `/seller`, `/seller/products/new`.
- Admin: `/admin`, `/admin/categories`.

## 6. API envelope

Success:

```json
{ "data": {}, "request_id": "req_..." }
```

Paginated:

```json
{
  "data": [],
  "meta": { "limit": 20, "has_more": false, "next_cursor": null },
  "request_id": "req_..."
}
```

Error:

```json
{
  "error": { "code": "VALIDATION_FAILED", "message": "...", "details": null },
  "request_id": "req_..."
}
```

Không dựa vào field `success`; client phải dựa vào HTTP status và sự hiện diện của `data`/`error`.

## 7. Checkout invariant quan trọng

- Cart selection là server state `is_selected`.
- Checkout không nhận danh sách item từ client.
- `POST /checkout` bắt buộc `Idempotency-Key`.
- Payment method hiện tại chỉ có `COD | ONLINE`.
- Order khởi tạo ở `PENDING_CONFIRMATION`.
- Payment record `PENDING` được tạo cùng checkout; `/orders/:id/payments` hiện là retry payment, không phải API tạo QR.

## 8. Definition of Done chung cho FE

- TypeScript và lint pass.
- Không còn mock literal nằm trực tiếp trong page; mock phải qua repository/adapter.
- Mỗi data screen có loading, empty, error và retry state.
- Mutation chống submit lặp và hiển thị error theo `error.code`.
- Route/role được guard, nhưng không coi FE guard là authorization.
- Responsive từ 360px đến desktop, keyboard usable, focus visible.
- Core flow có integration/E2E test theo readiness thực tế.
