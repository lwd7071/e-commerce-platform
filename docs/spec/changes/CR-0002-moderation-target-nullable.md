# CR-0002 — Cho phép TargetID NULL cho ModerationRecord

- **Trạng thái:** Approved
- **Ngày:** 2026-09-16
- **Owner:** Người 2 — Database và Supabase

## Nội dung đề xuất

Cho phép `moderation_records.target_id` nhận `NULL` khi thao tác kiểm duyệt
không gắn với đối tượng cụ thể. Khi có giá trị, Service kiểm tra
`target_type + target_id`; không tạo foreign key vật lý cho cặp polymorphic.

## Lý do

Schema Freeze mô tả cột `TargetID` là `NOT NULL`, trong khi RB-KN20 cho phép
`TargetID` của ModerationRecord và AdminLog NULL cho thao tác toàn hệ thống.
Phương án này thống nhất với RB-KN20 nhưng cần phê duyệt trước migration.

## Điều kiện áp dụng

Chỉ áp dụng sau khi trạng thái được đổi thành **Approved**. Không sửa Schema
Freeze v1 để che giấu lịch sử thay đổi.
