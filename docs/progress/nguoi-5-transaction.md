# Nhật ký tiến độ — Người 5 (Transaction core)

## Trạng thái hiện tại

- Mốc: T1
- Cập nhật lần cuối: Chưa có
- Đang làm: Chưa bắt đầu
- Bị block bởi: Không

## Nhật ký theo ngày

Chưa có nhật ký công việc.

## Contract đang sở hữu

| Tên | Trạng thái bàn giao | Version/ngày khóa | Người tiêu thụ |
|---|---|---|---|

Chưa có mục bàn giao được xác nhận trong nhật ký này.

## Việc còn lại trong mốc hiện tại

- [ ] Xây domain service thuần cho ba state machine Order, Payment và Shipment.
- [ ] Viết unit test cho mọi transition hợp lệ, transition bị cấm và terminal state.
- [ ] Thiết kế checkout command/result, transaction boundary, danh sách bước checkout và idempotency interface.
- [ ] Khóa endpoint contract tạo Order, cancel, transition và retry Payment.
- [ ] Dùng mock Catalog, Cart và Voucher port để kiểm thử orchestration contract.
- [ ] Sau khi Người 3 khóa Catalog port và Người 4 khóa Cart/Voucher port: ráp checkout orchestration với các port thật.
- [ ] Sau khi Người 2 hoàn thành migration và transaction helper: làm persistence, transaction integration và idempotency storage thật.
- [ ] Sau khi Người 1 hoàn thành scaffold, API envelope và `RequestContext`: wiring endpoint.
