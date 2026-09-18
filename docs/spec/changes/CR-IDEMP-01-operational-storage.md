# CR-IDEMP-01 — Operational idempotency storage

## Trạng thái

**Approved** — 2026-09-19. Đây là CR tài liệu độc lập, được ghi nhận trước khi đóng implementation T1.

## Quyết định

- `api_idempotency_records` là bảng vận hành, không phải bảng nghiệp vụ thứ 23.
- PostgreSQL là source of truth; T1 không thêm Redis.
- Advisory lock chỉ điều phối concurrency; composite primary key `(user_id, endpoint, idempotency_key)` là identity chuẩn.
- Record chỉ ghi khi transaction business hoàn tất; rollback không lưu record.
- Record hết hạn có thể được thay thế theo policy cleanup/insert của application.
- Migration đã phát hành giữ nguyên checksum; rollback dùng restore/database rollback plan, không sửa migration cũ.

## Review và phê duyệt

1. Owner Người 2 đề xuất CR.
2. Người 1 và Người 5 thực hiện review kỹ thuật mô phỏng theo vai trò reviewer ngoài owner.
3. Owner ghi nhận Approved, sau đó reviewer re-approve HEAD cuối theo quy trình T1 đã khóa.

Reviewer: Người 1, Người 5 (roleplay review); ngày: 2026-09-19.

## Phạm vi implementation

Migration `20260918170000_add_api_idempotency_records` tạo bảng vận hành với fingerprint SHA-256,
expiry check, composite primary key, FK tới `app_users` và index cleanup theo `expires_at`.
