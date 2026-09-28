# E-Commerce Frontend

Frontend Next.js cho Buyer, Seller và Admin. Tài liệu làm việc nằm tại [`docs/frontend-spec`](../docs/frontend-spec/README.md); phân công 5 người và thứ tự thực hiện nằm trong [implementation plan](../docs/frontend-spec/08-implementation-plan.md).

## Trước khi bắt đầu code

1. Đọc [README frontend spec](../docs/frontend-spec/README.md) và bộ file `01`–`09`; với ticket của mình, đối chiếu kỹ [route/flow](../docs/frontend-spec/02-pages-and-user-flow.md), [API contract](../docs/frontend-spec/05-api-contract.md), [gap/readiness](../docs/frontend-spec/07-gap-analysis.md), [implementation plan](../docs/frontend-spec/08-implementation-plan.md) và [UI/UX rules](../docs/frontend-spec/09-ui-ux-rules.md).
2. Xem owner/file ownership trong plan; đọc [`AGENTS.md`](./AGENTS.md) và tài liệu Next.js cài ở `node_modules/next/dist/docs/` trước khi sửa code. Chọn ticket trong phạm vi mình, xác định endpoint thật hay mock repository, và ghi việc đang làm vào [progress cá nhân](../docs/frontend-spec/progress/README.md).
3. Nếu cần sửa API client, global CSS, shared UI hoặc page của người khác, bàn giao yêu cầu cho owner trước. Ghi contract, ví dụ response/error và điều kiện nghiệm thu trong ticket/progress.

## Chạy local

Yêu cầu Node `22.20.x`, npm `11.x` theo `package.json`. Backend chạy cổng `3001`, FE chạy cổng `3000`.

```powershell
cd ecommerce-web
Copy-Item .env.example .env.local
npm install
npm run dev
```

Điền `NEXT_PUBLIC_API_BASE_URL` và cấu hình Supabase publishable trong `.env.local` khi tích hợp auth; không đưa secret/service-role key vào biến `NEXT_PUBLIC_*`. API contract runtime có ở `http://localhost:3001/api/v1/openapi.json`. Trang local: `http://localhost:3000`.

## Kiểm tra và cập nhật tiến độ

Chạy `npm run lint` và `npm run build` cho thay đổi ảnh hưởng FE. Test unit/contract/E2E theo gate của ticket khi runner được thiết lập ở Phase 1. Ghi kết quả thực tế, commit/PR, handoff và blocker vào đúng một file `docs/frontend-spec/progress/nguoi-N.md`; không đánh dấu hoàn thành nếu chỉ có UI prototype hoặc mock chưa được gắn feature flag.
