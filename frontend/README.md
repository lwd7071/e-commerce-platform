# Frontend workspace

Đây là thư mục làm việc chính cho Frontend dùng chung của team. Mọi code FE mới được tạo trong `frontend/` theo ticket và ownership trong [implementation plan](../docs/frontend-spec/08-implementation-plan.md).

Trước khi code, đọc [Frontend spec](../docs/frontend-spec/README.md), đặc biệt file [UI/UX rules](../docs/frontend-spec/09-ui-ux-rules.md), rồi cập nhật đúng file trong [progress](../docs/frontend-spec/progress/README.md). `ecommerce-web/` là bản UI thử nghiệm, không phải workspace triển khai.

App scaffold mới sẽ được Người 1 khởi tạo tại thư mục này theo stack trong UI/UX rules. Người 2 sở hữu shared UI, global tokens/layout/navigation và `/profile`, `/notifications`; các page còn lại theo ownership trong implementation plan.

## Cấu trúc hiện tại

- `src/app/globals.css`, `layout.tsx`: tokens, global styles và shell chung.
- `src/components/ui/`: button, form controls, dialog, toast, status badge và data states.
- `src/components/navigation/`: header và mobile navigation.
- `src/features/profile/`, `src/features/notifications/`: UI theo readiness đã ghi trong spec.
- `src/app/profile/`, `src/app/notifications/`: route thuộc Người 2.

Chưa chạy app/build được cho đến khi scaffold, package và scripts do Người 1 quản lý được thêm. Không tạo bản sao hoặc tiếp tục phát triển prototype `ecommerce-web`.
