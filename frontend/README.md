# Frontend workspace

Đây là thư mục làm việc chính cho Frontend dùng chung của team. Mọi code FE mới được tạo trong `frontend/` theo ticket và ownership trong [implementation plan](../docs/frontend-spec/08-implementation-plan.md).

Trước khi code, đọc [Frontend spec](../docs/frontend-spec/README.md), đặc biệt file [UI/UX rules](../docs/frontend-spec/09-ui-ux-rules.md), rồi cập nhật đúng file trong [progress](../docs/frontend-spec/progress/README.md). `ecommerce-web/` là bản UI thử nghiệm, không phải workspace triển khai.

Scaffold Next.js đã được Người 1 tạo tại đây. Dùng Node `24.15.0` (theo `.nvmrc`) và npm `11.12.1`: chạy `npm ci`, sau đó `npm run dev` hoặc quality gates (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`). Backend và frontend dùng chung file `../.env` ở root; sao chép root `.env.example` thành root `.env` và điền các giá trị cần thiết. Next.js nạp các biến frontend public từ root env qua `next.config.ts`; không tạo `.env.local` riêng. Để thử luồng mock, bật `NEXT_PUBLIC_USE_MOCK=true` trong root `.env`. Người 2 sở hữu shared UI, global tokens/layout/navigation và `/profile`, `/notifications`; các page còn lại theo ownership trong implementation plan.

## Cấu trúc hiện tại

- `src/app/globals.css`, `layout.tsx`: tokens, global styles và shell chung.
- `src/components/ui/`: button, form controls, dialog, toast, status badge và data states.
- `src/components/navigation/`: header và mobile navigation.
- `src/features/profile/`, `src/features/notifications/`: UI theo readiness đã ghi trong spec.
- `src/app/profile/`, `src/app/notifications/`: route thuộc Người 2.

Không sửa `package.json`/lockfile nếu không thuộc Người 1. Không tạo bản sao hoặc tiếp tục phát triển prototype `ecommerce-web`.
