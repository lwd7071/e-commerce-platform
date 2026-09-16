# Nhật ký tiến độ — Người 4 (Buyer supporting domain)

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

- [ ] Thiết kế model, DTO, validation và repository interface cho Profile, Address, Cart, Voucher, Review và Notification.
- [ ] Định nghĩa, công bố Cart port và Voucher port cho Người 5.
- [ ] Soạn endpoint contract cho Buyer supporting domain và mock fixture theo Schema Freeze.
- [ ] Viết unit test thuần cho cart quantity, voucher rule, rating và default address.
- [ ] Sau khi Người 1 hoàn thành scaffold và cấu trúc module: đặt Buyer modules vào backend.
- [ ] Sau khi Người 1 mở shared contract structure: đưa Cart/Voucher port vào `src/contracts` qua owner.
- [ ] Sau khi Người 2 hoàn thành migration các bảng liên quan và database client: chạy repository integration test.
- [ ] Sau khi Người 1 khóa `RequestContext`: wiring endpoint cần kiểm tra ownership.
- [ ] Sau khi Người 5 khóa Order query/state contract: tích hợp Review với Order thật.
