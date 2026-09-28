# Tiến độ FE — Người 2 (UI/UX, Shared UI và Account)

## Trạng thái hiện tại

- Phase/ticket: Phase 0 D-001–003; Phase 2 U-201–206; Phase 6 P-602/P-604–605/P-607b (UI mock/gated)
- Cập nhật lần cuối: 2026-09-28
- Đang làm: Hoàn thiện shared UI, shell, profile/notifications và tài liệu handoff trong `frontend/`
- Nhánh/PR: Chưa có
- Bị block bởi: Người 1 cần tạo app scaffold/package/lockfile/config trong `frontend/` để chạy build, lint và browser QA; P-601/P-603/P-606 chờ backend contract/runtime (GAP-07/GAP-01/GAP-09); D-004 chờ page sample của Người 3/4/5
- Việc tiếp theo: Sau scaffold, chạy lint/typecheck/build, sửa lỗi tích hợp; auth role/metadata phải nhận qua contract của Người 1; hoàn tất Q-802/Q-803 và D-004 sau page samples

## Nhật ký theo ngày

### 2026-09-28 — D-001–003, U-201–206, P-602/P-604–605/P-607b

- Đã làm: Dựng tokens/global style, Button/IconButton, field controls/error summary, Dialog, ToastProvider, StatusBadge đủ 7 trạng thái, skeleton/empty/error, header/mobile dock, layout, profile và notification UI trong `frontend/src/`.
- Quyết định UI/contract: Giữ nguyên palette đã cung cấp; CTA chữ trắng dùng `#BF3A6F` đạt contrast, không glow. Profile metadata chỉ read-only; avatar bị khóa vì thiếu media contract. Notifications demo/local-state chỉ trong non-production; production báo runtime API chưa sẵn sàng (501), không gọi endpoint thật hoặc realtime. Bulk action giới hạn tối đa 20 ID và hiện chỉ cập nhật demo state; production không hiển thị.
- Test/kiểm tra: Đã đọc/đối chiếu route, readiness, UI rules và skill UI/UX; rà tĩnh code sau chỉnh sửa; `git diff --check -- docs/frontend-spec frontend` không phát hiện whitespace lỗi (chỉ cảnh báo chuẩn hóa LF/CRLF). Lint/typecheck/build/browser chưa chạy; `frontend/` chưa có package.json, lockfile, runner hay scaffold (Người 1 sở hữu).
- Handoff: Người 1 — auth role/metadata provider và scaffold; Người 3/4/5 — dùng token, shared component, shell và route handoff ở [file 10](../10-ui-ux-handoff.md). Chưa được xác nhận nhận.
- Blocker: Người 1: tạo app bootstrap và tooling trong `frontend/`; BE: wire notifications, profile API và media contract; Người 3/4/5: cung cấp page samples cho D-004.
- Còn lại: Compile QA, keyboard/screen-reader/browser QA, contrast thực tế toàn screen, auth role wiring, notification repository API/rollback và avatar upload sau khi dependency đóng.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| UI/UX rules + screen inventory | Người 1, 3, 4, 5 | Token, 14-route inventory, readiness/responsive/keyboard states | Đã viết; chờ consumer review | [Rules](../09-ui-ux-rules.md), [handoff](../10-ui-ux-handoff.md) |
| Shared UI + shell | Người 1, 3, 4, 5 | button/forms/dialog/toast/status/data states/navigation; source trong `frontend/src/components` | Đã implement; chưa compile-verified | [Workspace](../../../frontend/README.md) |
| Profile/notifications UI | Người 1 | Metadata shape, gated mock states; không gọi API thiếu | UI đã implement; API integration blocked | [Handoff 10](../10-ui-ux-handoff.md) |

## Việc được giao

- [x] D-001–003 — screen inventory, UI rules và route/owner UX handoff; D-004 còn chờ page samples.
- [ ] D-004 — visual review trang chủ, checkout, seller order, admin dashboard tại 360/1280px.
- [ ] U-201–206 — source implementation đã có; nghiệm thu lint/typecheck/build/visual bị block do chưa scaffold.
- [ ] P-602 — profile read-only shell có; chờ profile/auth source contract để hiển thị metadata thật.
- [ ] P-604/P-605 — demo UI có nhãn và gated; API integration/bulk behavior chờ runtime/GAP-10.
- [ ] P-607b — upload UI được giải thích và khóa; chờ media contract P-606.
- [ ] Q-802 — static source audit đã làm; keyboard/screen reader/contrast QA chưa chạy.
- [ ] Q-803 — responsive source styles đã có; browser QA chờ scaffold.
