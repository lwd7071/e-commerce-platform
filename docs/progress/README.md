# Nhật ký tiến độ Backend — Tổng quan

Nguồn phân công và dependency: [Kế hoạch Backend T1/T2/T3](../architecture/backend-work-plan.md).

## Cách đọc dành cho AI

- Thư mục này có một file nhật ký cho mỗi người theo ownership trong kế hoạch Backend. Khi cần biết ai đang làm gì hoặc đang chờ ai, đọc file của người đó; không suy đoán từ bảng tổng quan.
- `Trạng thái hiện tại` ở đầu file người là trạng thái mới nhất do owner ghi. `Nhật ký theo ngày` cung cấp bằng chứng và lý do của thay đổi. Nếu `Cập nhật lần cuối: Chưa có`, hãy báo **chưa có log mới**, không coi các checkbox là việc đã làm.
- `Contract đang sở hữu` ghi trạng thái **bàn giao** của port/interface. Nó không thay thế contract đã khóa trong [kế hoạch Backend](../architecture/backend-work-plan.md), Architecture Rules, code hoặc Change Request `Approved`. Thay đổi chưa được duyệt chỉ có trạng thái `Đề xuất` và chưa có hiệu lực.
- Bảng tổng quan bên dưới là bản tóm tắt cập nhật thủ công. Nếu bảng khác file người, ưu tiên file người về **tiến độ** và báo rõ README chưa được đồng bộ. Không dùng nhật ký tiến độ để suy diễn rằng contract hoặc Schema Freeze đã được phê duyệt.
- Khi trả lời về test, chỉ báo `pass`/`fail` nếu một mục nhật ký có mã QD/RB (nếu áp dụng), loại test và kết quả thực tế.

## Bảng tổng quan

Người 1 cập nhật bảng này khi có thay đổi lớn hoặc tại review cuối mỗi T; không cần sửa sau từng dòng nhật ký.

| Người | Domain | Mốc hiện tại | Blocker | Cập nhật cuối |
|---|---|---|---|---|
| [Người 1](nguoi-1-platform.md) | Platform/Integration | T1 | Không | Chưa có |
| [Người 2](nguoi-2-database.md) | Database/Supabase | T1 | Không | Chưa có |
| [Người 3](nguoi-3-catalog.md) | Catalog/Seller | T1 | Không | Chưa có |
| [Người 4](nguoi-4-buyer-domain.md) | Buyer domain | T1 | Không | Chưa có |
| [Người 5](nguoi-5-transaction.md) | Transaction core | T1 | Không | Chưa có |

## Template chuẩn

Giữ nguyên tên và thứ tự các mục sau trong cả năm file. Khi bắt đầu ghi nhật ký thật, thêm ngày mới ở đầu phần `Nhật ký theo ngày`. Với trường không phát sinh trong ngày, ghi `Không`; không để trống. Không ghi ngày giả khi chưa làm việc.

~~~markdown
# Nhật ký tiến độ — Người <n> (<Vai trò>)

## Trạng thái hiện tại

- Mốc: T1 / T2 / T3
- Cập nhật lần cuối: YYYY-MM-DD
- Đang làm: <một dòng, hoặc Chưa bắt đầu>
- Bị block bởi: <ai + đầu ra cần chờ + từ ngày nào, hoặc Không>

## Nhật ký theo ngày

### YYYY-MM-DD

- Đã làm:
  - <việc cụ thể, gắn module/file nếu có; hoặc Không>
- Quyết định kỹ thuật:
  - <quyết định> — Lý do: <ngắn gọn; hoặc Không>
- Contract/port thay đổi:
  - <tên> — <thay đổi> — Trạng thái: Đề xuất/Đã duyệt — Ảnh hưởng: <ai; hoặc Không>
- Blocker phát sinh:
  - <mô tả> — Cần: <ai/đầu ra> — Từ ngày: <YYYY-MM-DD; hoặc Không>
- Test đã viết:
  - <mã QD/RB nếu có> — <loại test> — Kết quả: pass/fail; hoặc Không

## Contract đang sở hữu

| Tên | Trạng thái bàn giao | Version/ngày khóa | Người tiêu thụ |
|---|---|---|---|
| <tên> | Đề xuất/Đã khóa | <version/ngày hoặc Chưa có> | <người> |

## Việc còn lại trong mốc hiện tại

- [ ] <việc từ kế hoạch Backend thuộc ownership của mình>
~~~

## Quy tắc cập nhật

- Mỗi người chỉ sửa file của mình. Người 1 quản lý bảng tổng quan README; không sửa nhật ký của người khác.
- Ghi cuối ngày làm việc hoặc cuối phiên code; không cần ghi thời gian thực. Cập nhật `Trạng thái hiện tại` cùng lúc với nhật ký ngày mới.
- Giữ nguyên nhật ký cũ, thêm mục ngày mới ở đầu phần nhật ký. Không gộp hoặc xóa lịch sử khi chưa có quy định lưu trữ riêng.
- Contract thay đổi ảnh hưởng người khác: ghi vào file owner **và** báo trực tiếp qua kênh chat của nhóm. Nhật ký không thay thế thông báo tức thời, review contract hoặc quy trình Change Request.
- Test ghi mã QD/RB nếu có, loại test và kết quả thực tế. Blocker ghi rõ đang chờ ai, đầu ra nào và từ ngày nào; khi được gỡ, cập nhật trạng thái và ghi vào nhật ký ngày đó.
- Checkbox chỉ được đánh dấu hoàn thành khi có đầu ra kiểm chứng được. Khi chuyển T, lấy danh sách việc của mốc mới từ kế hoạch Backend; không tự đổi ownership hoặc contract.
