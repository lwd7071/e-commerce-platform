# CR-ADMIN-01 — Hoàn thiện Admin Portal

## Trạng thái

**Approved** — 2026-10-01, Chủ dự án yêu cầu triển khai nguyên văn plan Admin Portal trong hội thoại Codex; các quyết định phạm vi và test seams đã được chốt trước khi thực thi.

## Owner và review

- Owner: Chủ dự án.
- Phê duyệt: chỉ thị trực tiếp “PLEASE IMPLEMENT THIS PLAN” ngày 2026-10-01 áp dụng cho toàn bộ contract và quyết định trong plan chi tiết ngay trước đó.
- Không giả lập reviewer kỹ thuật độc lập.

## Lý do

Admin hiện có một số route và màn hình nhưng còn thiếu acceptance live, audit viewer, báo cáo toàn sàn và các capability trong spec gốc. Admin repositories có đường fallback fixture khi API lỗi; category UI còn xóa vật lý; màn dashboard gom dữ liệu theo cách chưa phù hợp list lớn. Spec gốc yêu cầu Admin quản lý user, shop, category, product/nội dung, order, voucher toàn sàn, thông báo, báo cáo và nhật ký.

## Quyết định được duyệt

1. Admin Portal hoàn thiện các capability: user, shop, category, Product/Review moderation, Order operations, PLATFORM voucher, notification campaign theo nhóm, reporting và audit viewer.
2. Category chỉ tạo/sửa/đổi `ACTIVE`/`INACTIVE`; không xóa vật lý Category.
3. MVP này không bổ sung luồng Buyer/Seller gửi báo cáo vi phạm. Admin moderation list không hiển thị số báo cáo không có nguồn dữ liệu. Báo cáo vi phạm đếm `moderation_records` và gắn nhãn là lượt xử lý.
4. Admin có thể xem voucher toàn sàn nhưng chỉ tạo/sửa/bật/tắt voucher `PLATFORM` (`shop_id IS NULL`). Voucher `SHOP` tiếp tục thuộc Seller. Voucher đã có usage chỉ được đổi status.
5. Admin gửi thông báo nội bộ tới một audience `BUYER` hoặc `SELLER` tại một thời điểm. Recipient set được chụp tại lúc tạo campaign từ user ACTIVE có role khớp; user tạo sau đó không được thêm vào campaign. Không gửi email/SMS/push.
6. Campaign gửi theo batch có thể resume sau restart; mỗi recipient nhận tối đa một Notification nhờ event ID ổn định và unique constraint hiện có. Request tạo campaign dùng `Idempotency-Key`.
7. Báo cáo mặc định 30 ngày gần nhất và nhận khoảng ngày do caller chọn. User/shop/product tổng hiện tại; Order theo ngày đặt; GMV, top shop và top Product chỉ lấy Order `COMPLETED` theo ngày hoàn tất (QD19). Nhóm ngày theo `Asia/Ho_Chi_Minh`, lưu timestamp UTC. Đồng hạng được sắp xếp bằng ID ổn định.
8. Order intervention dùng đúng state machine hiện hành. Admin command yêu cầu reason, ghi `order_status_history` và `admin_logs` cùng transaction, optimistic check/row lock ngăn race; không cập nhật trực tiếp status hoặc snapshot.
9. Các moderation/write nhạy cảm cập nhật domain row, `moderation_records` nếu phù hợp và `admin_logs` cùng transaction. Audit failure rollback toàn bộ.
10. API dùng `/api/v1/admin`, role ADMIN ở backend, envelope/request ID/pagination/error conventions hiện hành. Pagination envelope là `{ data, meta: { next_cursor, has_more, limit }, request_id }`.
11. Campaign là dữ liệu vận hành bổ sung, không thay đổi 22 bảng nghiệp vụ đã đóng băng. Migration chỉ được thêm mới theo Prisma Migrate; không sửa Schema Freeze hoặc migration đã phát hành.
12. UI dùng API live khi không bật mock flag; live error không fallback sang fixture. Test dùng public REST, public user actions và browser E2E đã được chốt trong hội thoại.

## Thay đổi dữ liệu/API dự kiến

- Thêm bảng `admin_notification_campaigns`: campaign ID, actor, target role, title/content, trạng thái xử lý, counts, timestamps và idempotency identity.
- Thêm bảng `admin_notification_campaign_recipients`: campaign ID, user ID snapshot, delivery state/attempt metadata, timestamp; unique `(campaign_id, user_id)` và FK có delete policy được test.
- Dùng cột `notifications.event_id` hiện có làm idempotency key cho từng delivery; không tạo duplicate Notification khi worker retry.
- Thêm API list/detail/command dưới `/admin` cho moderation, campaign, audit và reporting theo OpenAPI. Giữ endpoint `/admin/users`, `/admin/shops`, `/admin/categories` tương thích trong migration contract hoặc version-compatible adapter.
- Chỉ thêm indexes phục vụ query đã có `EXPLAIN` và test dữ liệu đủ lớn.

## Tài liệu cần đồng bộ

- Architecture rules: role business rules, RBAC, Business Rules, API conventions, DB schema rules, error observability, Order workflow và testing quality gates.
- Frontend API contract, FE/BE mapping, gap analysis và implementation plan.
- OpenAPI, generated FE API types, `docs/progress/mvp-user-admin.md` và progress index.
- Không sửa `docs/spec/schema-freeze-v1.md`.

## Acceptance và traceability

- **QD03:** user bị khóa không còn gọi được protected API bằng phiên cũ.
- **QD11/QD20:** Order intervention hợp lệ, sai transition trả conflict; history và audit commit/rollback nguyên tử.
- **QD16:** không xóa Category hoặc dữ liệu có lịch sử giao dịch.
- **QD17/QD20/RB-KN20:** moderation yêu cầu reason, target hợp lệ, bảo vệ Admin target và rollback khi audit fail.
- **QD09/RB-LTT05:** voucher PLATFORM có `shop_id=NULL`; voucher SHOP không bị Admin write qua contract này; checkout tính đúng và usage không cho sửa điều kiện.
- **QD19:** GMV/top shop/top Product chỉ tính Order COMPLETED; date boundary theo timezone đã khóa.
- Campaign: audience snapshot đúng role và status, idempotency replay, crash/restart giữa batch không mất hoặc gửi trùng recipient, request chỉ ADMIN.
- RBAC: Guest/Buyer/Seller bị chặn cả Admin page lẫn API; User LOCKED bị chặn theo Auth middleware.
- API: cursor ổn định, unknown fields/sort/filter bị từ chối, envelope/request ID chuẩn, error không lộ SQL/secret.
- FE: live failure không trả fixture; modal reason/error/focus đúng; dashboard chart có bảng dữ liệu thay thế; navigation/filter/page state dùng được bằng bàn phím và viewport được nêu trong UI skill.
- TDD: với từng hành vi mới ghi test red trước implementation, green sau; PostgreSQL thật cho transaction/race; UI tests tại HTTP boundary; Playwright test luồng browser.

## Migration và triển khai

- Migration cần chạy trên database trống và test schema trước khi deploy.
- Không chạy migration/seed test vào production. Chỉ deploy sau khi target project/environment được xác minh theo quy trình migration safety hiện hành.
- Campaign worker phải resume từ DB state khi process khởi động; không dựa vào in-memory queue làm nguồn trạng thái duy nhất.

