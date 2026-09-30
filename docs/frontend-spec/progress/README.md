# Nhật ký tiến độ Frontend — 5 người

Đọc [implementation plan](../08-implementation-plan.md#phân-công-5-người-fe) và [UI/UX rules](../09-ui-ux-rules.md) trước khi nhận ticket. Mỗi người chỉ cập nhật file của mình; Người 1 quản lý bảng tổng quan và điều phối handoff trong README này. File progress là bằng chứng tiến độ, không thay thông báo trực tiếp hoặc review PR khi contract đổi.

| Người | Phạm vi | File | Trạng thái hiện tại (2026-09-30) |
|---|---|---|---|
| 1 | Platform, API, auth, tích hợp | [nguoi-1.md](./nguoi-1.md) | Progress cá nhân báo hoàn tất Block 0, Workstream A/C và quality gates (253 FE, 619 BE theo lượt chạy được ghi trong file Người 1). Số test không cùng lượt chạy với Người 2/4 (242 FE); xem từng file để biết phạm vi/lệnh của từng lần kiểm tra. |
| 2 | Storage/E2E, UI/UX, shared UI, Profile/Notifications | [nguoi-2.md](./nguoi-2.md) | Product/avatar Storage upload, Profile và Notifications đã nối; Supabase test E2E và QA evidence được ghi ở file cá nhân (2026-09-30). Còn Review image upload thật, generated OpenAPI FE types và release checks: authenticated keyboard/Admin cross-browser, GitHub cleanup workflow dispatch/secrets, backend-host smoke. Snapshot test không đồng thời với các owner khác. |
| 3 | Catalog, seller catalog, category | [nguoi-3.md](./nguoi-3.md) | Seller product/media/category routes và UI có trong source; Seller live upload/create/stock/hide-show E2E trên Supabase test đã pass theo evidence 2026-09-30. Phân biệt test-project pass với backend production-host smoke còn mở. |
| 4 | Cart, address, voucher, checkout | [nguoi-4.md](./nguoi-4.md) | Progress cá nhân báo đã nối Review/Notification services trong runtime và checkout DB integration suite. API contract trước đó ghi trạng thái 501 đã lỗi thời; production/test-project smoke chưa được khẳng định ở đây. |
| 5 | Orders, review, admin | [nguoi-5.md](./nguoi-5.md) | Có Orders/Review/Admin UI và confirm-received route/API theo progress; một số repository có mock fallback. Chưa thấy Buyer order→review hoặc Admin RBAC E2E trong `frontend/e2e`; các acceptance tương ứng vẫn cần evidence, không nên gọi toàn cụm “100% live”. |

Các trạng thái trên tách implementation source khỏi nghiệm thu runtime/E2E. Số liệu test là snapshot theo từng owner/lượt chạy, không phải một kết quả đồng thời của toàn repo. Ticket có điều kiện backend, môi trường thật hoặc E2E chỉ được coi là hoàn tất khi có evidence nghiệm thu tương ứng.

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
