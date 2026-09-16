# Nhật ký tiến độ — Người 2 (Database và Supabase)

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

- [ ] Chuyển đủ 22 bảng Schema Freeze v1 thành migration SQL; xác định PK, FK, CHECK, UNIQUE và partial unique index bắt buộc.
- [ ] Soạn RLS default-deny policy, seed tối thiểu, Supabase Auth/Storage configuration mẫu và `.env.example`.
- [ ] Xác định interface cho database client, transaction helper và test database.
- [ ] Sau khi Người 1 hoàn thành scaffold và cấu trúc config: tích hợp migration, database client và transaction helper.
- [ ] Sau khi Người 1 hoàn thành test runner và CI skeleton: tích hợp migration CI.
- [ ] Sau khi Người 1 khóa `RequestContext` và identity repository interface: chạy auth seed và identity sync test.
- [ ] Sau khi Người 3, 4 và 5 công bố query pattern: kiểm tra query/index theo từng domain.
