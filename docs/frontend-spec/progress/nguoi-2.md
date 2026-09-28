# Tiến độ FE — Người 2 (UI/UX, Shared UI và Account)

## Trạng thái hiện tại

- Phase/ticket: Phase 0 D-001–003; Phase 2 U-201–206; Phase 6 P-602/P-604–605/P-607b (UI mock/gated); Q-802/Q-803 scoped QA
- Cập nhật lần cuối: 2026-09-28
- Đang làm: U-201–206 và QA độc lập cho shared shell/profile/notifications đã hoàn tất; P-604/P-605/P-607b vẫn gated theo readiness backend
- Nhánh/PR: Chưa có
- Bị block bởi: D-004 chờ page mẫu checkout (Người 4), seller orders và admin dashboard (Người 5); P-601/P-603/P-606 chờ backend contract/runtime (GAP-07/GAP-01/GAP-09). Contrast ở login/register cần Người 1 và màu trạng thái seller cần Người 3 xử lý tại page của họ.
- Việc tiếp theo: Ghi nhận/nhận handoff contrast từ Người 1/3; tiếp tục D-004 khi checkout, seller orders và admin dashboard có page mẫu; chạy lại gate theo Node 22.20.0 khi môi trường đó sẵn.

## Nhật ký theo ngày

### 2026-09-28 — U-203, Q-802, Q-803 (QA sau merge catalog)

- Đã làm:
  - Sửa định vị `.dialog` trong `frontend/src/app/globals.css`: khai báo `position: fixed`, `inset: 0`, `margin: auto` để modal không còn bị Tailwind reset dồn về góc trên trái.
  - Chạy browser smoke bằng Chrome 153 với mock session, không thêm file QA hay dependency.
- Quyết định UI/contract: Giữ native `<dialog>`; dùng cơ chế modal/focus containment/ESC của trình duyệt và lớp CSS chung, không thêm thư viện dialog.
- Test/kiểm tra:
  - `npm run typecheck`, `npm run lint`, `npm test` (4 files/15 tests), `npm run build`: PASS trên Node 24.15.0/npm 11.12.1. Repo yêu cầu Node 22.20.0 nên lượt này là kiểm tra bổ sung, chưa thay thế gate trên đúng Node.
  - Chrome mock browser: Dialog nằm giữa viewport; focus vào dialog khi mở; Tab giữ focus bên trong; Escape đóng và trả focus về nút mở; click backdrop đóng và trả focus. Không có JS exception trong smoke.
  - Chrome responsive smoke: `/` không tràn ngang tại 320/360/768/1280px; `/profile` và `/notifications` không tràn tại 360px. Reduced motion bật làm animation skeleton gần như tắt (`0.00001s`).
  - Contrast audit: `#E11D48` trên `#FFF1F2` đạt 4.28:1 (dưới 4.5:1) trong auth error copy; `#059669` trên `#ECFDF5` đạt 3.58:1 và `#D97706` trên `#FFFBEB` đạt 3.07:1 cho status text seller. Đây là page của Người 1/3, không sửa chéo ownership.
- Handoff: Người 1 — dùng foreground đỏ đậm hơn cho nội dung lỗi login/register; Người 3 — dùng màu text trạng thái success/warning đậm hơn trên status surface. Trang chủ trước đây ghi nhận overflow 320/360px, hiện smoke ở bốn viewport đều không còn overflow sau merge catalog.
- Blocker: D-004 chưa thể review đủ checkout, seller orders và admin dashboard vì các route/page mẫu này chưa có trong `frontend/src/app/`.
- Còn lại: Chờ đúng owner xử lý các contrast handoff; tiếp tục D-004 khi đủ page mẫu; không đóng Q-802/Q-803 toàn hệ thống.

### 2026-09-28 — D-001–003, U-201–206, P-602/P-604–605/P-607b, Q-802/Q-803

- Đã làm: Hoàn thiện tokens/global style, Button/IconButton, field controls/error summary, Dialog, ToastProvider, StatusBadge đủ 7 trạng thái, skeleton/empty/error, header/mobile dock, layout, role navigation, profile read-only và notification UI trong `frontend/src/`. Header/metadata/profile fallback dùng Dino text-only. FormField tự nối helper/error ARIA; notifications chỉ Buyer; profile chỉ dùng auth name/email và initials, không render avatar URL.
- Quyết định UI/contract: Giữ nguyên palette đã cung cấp; CTA chữ trắng dùng `#BF3A6F` đạt contrast, không glow. Profile metadata chỉ read-only; avatar bị khóa vì thiếu media contract. Notifications demo/local-state chỉ trong non-production; production báo runtime API chưa sẵn sàng (501), không gọi endpoint thật hoặc realtime. Bulk action giới hạn tối đa 20 ID và hiện chỉ cập nhật demo state; production không hiển thị.
- Test/kiểm tra: Nền `5ace145`; Node 22.20.0/npm 11. `npm ci` pass (415 packages; audit báo 2 moderate vulnerabilities); typecheck pass; ESLint source và 6 file TS đã sửa pass bằng CLI tương đương; Vitest 3 files/12 tests pass; production build pass. Browser smoke và defect evidence ghi ở mục [QA evidence](#qa-evidence). CUA không khởi tạo được nên dùng Chrome/Edge headless cài sẵn và Playwright cache ngoài repo; không sửa package/lockfile.
- Handoff: Người 1 — login/register cần đổi brand copy/wordmark sang Dino text-only; Người 3 — trang chủ có horizontal overflow ở 320/360px và brand/copy cần đổi Dino; Người 3/4/5 — dùng tokens, shared components và route handoff ở [file 10](../10-ui-ux-handoff.md). Chưa được xác nhận nhận.
- Blocker: BE — notifications/profile APIs và media contract; Người 3/4/5 — page samples cho D-004. Không còn blocker scaffold/auth wiring.
- Còn lại: Contrast screen-wide và dialog interaction cần browser QA evidence; notification API/rollback và avatar upload chỉ làm khi dependency backend sẵn.

### QA evidence

Quality gates dùng Node `22.20.0`/npm 11: `npm ci` pass (415 packages); typecheck pass; ESLint source pass bằng CLI tương đương (lượt cuối `npm run lint` không kết thúc trong thời gian hợp lý, không tính riêng); Vitest 3 files/12 tests pass; Next production build pass. `npm ci` audit ghi nhận 2 moderate vulnerabilities.

| Kiểm tra | Chrome | Edge |
|---|---|---|
| `/profile` và `/notifications` không tràn ngang ở 320/360/768/1280px | Pass | Pass |
| Guest redirect từ hai route giữ `returnTo` | Pass | Pass |
| Buyer: header chữ Dino, auth name/email trên profile; notifications demo, filter, mark-one, bulk tối đa 20 | Pass | Pass |
| Seller/Admin: ẩn menu notifications và URL trực tiếp hiện unauthorized | Pass | Pass |
| Tab đầu focus skip link; reduced-motion tắt shimmer; không có page errors trong luồng đã chạy | Pass | Pass |

Source audit: controls/buttons cao tối thiểu 44px, dock links 54px, form help/error nối `aria-describedby`/`aria-invalid`, toast có live region và close button có accessible name.

Defect/handoff ngoài ownership Người 2 (không sửa chéo):

1. Người 3 — contrast status success/warning trong seller product screen lần lượt 3.58:1 và 3.07:1 trên surface; dùng semantic foreground đậm hơn. Overflow trang chủ đã không tái hiện ở QA sau merge: 320/360/768/1280px đều không tràn.
2. Người 1 — `/login` và `/register` dùng danger text trên danger surface đạt 4.28:1; đổi sang foreground đỏ đậm hơn. Handoff cũ về copy/logo login Dino text-only vẫn cần owner xác nhận đã xử lý.

Đã có browser-interaction evidence cho dialog ESC/backdrop/return-focus. Chưa chạy screen reader; contrast đã tính cho các cặp token/usage nêu trên, chưa audit toàn bộ mọi route. D-004 chờ page samples Người 4/5. Q-802/Q-803 đạt trong phạm vi shared shell/profile/notifications, không đóng gate toàn dự án.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| UI/UX rules + screen inventory | Người 1, 3, 4, 5 | Token, 14-route inventory, readiness/responsive/keyboard states | Đã viết; chờ consumer review | [Rules](../09-ui-ux-rules.md), [handoff](../10-ui-ux-handoff.md) |
| Shared UI + shell | Người 1, 3, 4, 5 | button/forms/dialog/toast/status/data states/navigation; source trong `frontend/src/components` | Typecheck/lint/test/build pass; browser QA theo Q-802/Q-803 ở trên | [Workspace](../../../frontend/README.md) |
| Profile/notifications UI | Người 1 | Read-only auth metadata, buyer-only notifications, demo gated; không gọi API thiếu | UI/role guard đã implement; API integration blocked | [Handoff 10](../10-ui-ux-handoff.md) |

## Việc được giao

- [x] D-001–003 — screen inventory, UI rules và route/owner UX handoff; D-004 còn chờ page samples.
- [ ] D-004 — visual review trang chủ, checkout, seller order, admin dashboard tại 360/1280px.
- [x] U-201–206 — source implementation, quality gates và browser QA trong phạm vi shared UI đã có evidence; xem nhật ký ngày 2026-09-28.
- [x] P-602 — read-only auth metadata (email/full name), phone/avatar không giả dữ liệu; profile mutations vẫn chờ GAP-07.
- [ ] P-604/P-605 — demo UI có nhãn và gated; API integration/bulk behavior chờ runtime/GAP-10.
- [ ] P-607b — upload UI được giải thích và khóa; chờ media contract P-606.
- [x] Q-802 — đạt trong phạm vi shared shell/profile/notifications, gồm dialog keyboard/focus; contrast defect của page owner khác đã handoff; không đóng gate toàn dự án.
- [x] Q-803 — đạt trong phạm vi shared shell/profile/notifications; browser smoke 320/360/768/1280 và homepage sau merge; không đóng gate toàn dự án.
