# Tiến độ FE — Người 2 (UI/UX, Shared UI và Account)

## Trạng thái hiện tại

- Phase/ticket: Phase 0 D-001–003; Phase 2 U-201–206; Phase 6 P-602/P-604–605/P-607b (UI mock/gated); Q-802/Q-803 scoped QA
- Cập nhật lần cuối: 2026-09-28
- Đang làm: Batch độc lập của Người 2 đã hoàn tất trong phạm vi; D-004 và dialog/contrast QA chờ điều kiện nghiệm thu còn lại
- Nhánh/PR: Chưa có
- Bị block bởi: D-004 chờ page sample của Người 3/4/5; P-601/P-603/P-606 chờ backend contract/runtime (GAP-07/GAP-01/GAP-09). Browser smoke phát hiện overflow trang chủ 320/360px (handoff Người 3) và copy/logo cũ ở login (handoff Người 1).
- Việc tiếp theo: Gửi/nhận handoff brand login với Người 1 và responsive homepage với Người 3; hoàn tất dialog interaction/contrast rồi mới đóng U/Q; chờ page samples để D-004

## Nhật ký theo ngày

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

Defect ngoài ownership Người 2 (chưa sửa chéo):

1. Người 3 — `/` tràn ngang ở 320/360px; tại 320px document rộng 367px và CTA header vượt mép phải.
2. Người 1 — `/login` còn ô biểu tượng `EC` và copy “E-Commerce Platform”; cần chuyển sang Dino text-only.

Chưa có browser-interaction evidence cho dialog ESC/backdrop/return-focus; chưa chạy screen reader hoặc contrast toàn màn bằng công cụ tự động. D-004 chờ page samples Người 3/4/5. Q-802/Q-803 chỉ đạt một phần trong phạm vi Người 2, không đóng gate toàn hệ thống.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| UI/UX rules + screen inventory | Người 1, 3, 4, 5 | Token, 14-route inventory, readiness/responsive/keyboard states | Đã viết; chờ consumer review | [Rules](../09-ui-ux-rules.md), [handoff](../10-ui-ux-handoff.md) |
| Shared UI + shell | Người 1, 3, 4, 5 | button/forms/dialog/toast/status/data states/navigation; source trong `frontend/src/components` | Typecheck/lint/test/build pass; browser QA theo Q-802/Q-803 ở trên | [Workspace](../../../frontend/README.md) |
| Profile/notifications UI | Người 1 | Read-only auth metadata, buyer-only notifications, demo gated; không gọi API thiếu | UI/role guard đã implement; API integration blocked | [Handoff 10](../10-ui-ux-handoff.md) |

## Việc được giao

- [x] D-001–003 — screen inventory, UI rules và route/owner UX handoff; D-004 còn chờ page samples.
- [ ] D-004 — visual review trang chủ, checkout, seller order, admin dashboard tại 360/1280px.
- [ ] U-201–206 — source implementation có; typecheck/lint/test/build pass; đóng sau browser QA issues đã ghi/handoff.
- [x] P-602 — read-only auth metadata (email/full name), phone/avatar không giả dữ liệu; profile mutations vẫn chờ GAP-07.
- [ ] P-604/P-605 — demo UI có nhãn và gated; API integration/bulk behavior chờ runtime/GAP-10.
- [ ] P-607b — upload UI được giải thích và khóa; chờ media contract P-606.
- [ ] Q-802 — đạt một phần trong phạm vi shell/profile/notifications; xem QA evidence ở trên, dialog/contrast/screen-reader còn mở; không đóng gate toàn dự án.
- [ ] Q-803 — đạt một phần trong phạm vi shell/profile/notifications; xem viewport và Chrome/Edge evidence ở trên; không đóng gate toàn dự án.
