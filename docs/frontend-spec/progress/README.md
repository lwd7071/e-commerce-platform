# Nhật ký tiến độ Frontend — 5 người

Đọc [implementation plan](../08-implementation-plan.md#phân-công-5-người-fe) và [UI/UX rules](../09-ui-ux-rules.md) trước khi nhận ticket. Mỗi người chỉ cập nhật file của mình; Người 1 quản lý bảng tổng quan và điều phối handoff trong README này. File progress là bằng chứng tiến độ, không thay thông báo trực tiếp hoặc review PR khi contract đổi.

| Người | Phạm vi | File | Trạng thái hiện tại (2026-09-30) |
|---|---|---|---|
| 1 | Platform, API, auth, tích hợp | [nguoi-1.md](./nguoi-1.md) | Không thấy feature lớn còn thiếu. Chốt vai trò tích hợp: xác nhận OpenAPI/capability readiness khớp, theo dõi các blocker và hỗ trợ release smoke cùng nhóm. |
| 2 | Storage, UI/UX, shared UI, QA | [nguoi-2.md](./nguoi-2.md) | Chạy seed/reset và Storage lifecycle/RLS/cleanup trên Supabase test được allowlist; xác nhận ảnh Storage thật dùng được trong E2E. Nối Notifications UI với API thật, kiểm thử authenticated Admin và hoàn tất production-host smoke/QA. Đồng bộ checklist trong plan với code/test đã có. |
| 3 | Catalog, media, seller products | [nguoi-3.md](./nguoi-3.md) | Các mục được báo cáo là hoàn tất. Hỗ trợ tích hợp/nghiệm thu media và luồng Seller E2E; xử lý defect nếu các bài chạy thật phát hiện. |
| 4 | Cart, checkout, review/notification services | [nguoi-4.md](./nguoi-4.md) | Các mục được báo cáo là hoàn tất. Hỗ trợ chạy checkout/review/notification trên môi trường tích hợp; phối hợp Người 5 kiểm chứng checkout → nhận hàng → review. |
| 5 | Orders, review, admin | [nguoi-5.md](./nguoi-5.md) | Chốt các mục còn mở trong plan: kiểm thử race tồn kho, hủy/hoàn tồn; timeline/Shipment/DELIVERY_FAILED; live Admin UI và RBAC E2E; Order → confirm-received → review E2E. Đặc biệt, ghi nhận rõ đọc Orders còn dùng in-memory mock do GAP-01 và một số repository Review/Admin/Order có fallback mock — xác nhận production không âm thầm fallback và các capability chưa live vẫn bị khóa. |

Các trạng thái trên phản ánh nhật ký cá nhân và code đã tích hợp; ticket có điều kiện backend hoặc E2E chỉ được coi là hoàn tất khi có evidence nghiệm thu tương ứng.

## Mẫu cập nhật bắt buộc

Giữ nguyên tiêu đề và thứ tự các mục trong cả 5 file. Khi bắt đầu làm thật, điền `Trạng thái hiện tại`, thêm mục `### YYYY-MM-DD — <ticket>` mới ở đầu `Nhật ký theo ngày`, rồi cập nhật checklist. Không điền ngày giả. Mục không phát sinh ghi `Không`; chưa chạy test ghi `Chưa chạy`, không ghi pass.

~~~markdown
# Tiến độ FE — Người N (<vai trò>)

## Trạng thái hiện tại

- Phase/ticket: <phase + ID, hoặc Chưa bắt đầu>
- Cập nhật lần cuối: <YYYY-MM-DD, hoặc Chưa có>
- Đang làm: <đầu ra cụ thể, hoặc Chưa bắt đầu>
- Nhánh/PR: <link hoặc Chưa có>
- Bị block bởi: <owner + đầu ra + từ ngày, hoặc Không>
- Việc tiếp theo: <ticket/đầu ra>

## Nhật ký theo ngày

### YYYY-MM-DD — <ticket>

- Đã làm: <file/module + hành vi; hoặc Không>
- Quyết định UI/contract: <quyết định + lý do + người duyệt; hoặc Không>
- Test/kiểm tra: <lệnh hoặc case + pass/fail/chưa chạy + evidence>
- Handoff: <gửi ai + interface/fixture/PR + trạng thái nhận; hoặc Không>
- Blocker: <cần ai làm gì, điều kiện gỡ, từ ngày; hoặc Không>
- Còn lại: <việc cụ thể>

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| <tên> | <người> | <mô tả> | Nháp/Đã bàn giao/Đã nhận | <link> |

## Việc được giao

- [ ] <ticket ID> — <đầu ra; checkbox chỉ đánh dấu khi nghiệm thu>
~~~

## Quy tắc kiểm tra tiến độ

- Một ticket hoàn thành khi đáp ứng acceptance criteria ở file 08, có PR/commit và evidence test/QA phù hợp. Mock UI phải ghi rõ flag và backend gap; không tự coi là tích hợp thật.
- Blocker phải nêu owner cung cấp, đầu ra cần nhận, tiêu chí nghiệm thu và ngày bắt đầu. Khi gỡ, ghi vào nhật ký ngày đó; trong lúc chờ tiếp tục phần mock/fixture/test thuộc ownership.
- Thay đổi API hoặc token/component chung phải có người sở hữu và người tiêu thụ xác nhận trước khi merge. Handoff ghi interface, fixture request/response/error và test; chỉ link PR không đủ.
- Người 1 cập nhật cột trạng thái tổng quan khi nhận update từ owner. Không sửa hoặc xóa nhật ký cũ của người khác.
