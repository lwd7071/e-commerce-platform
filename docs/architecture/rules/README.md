# Architecture Rules

Đây là bộ quy tắc bắt buộc khi thiết kế và triển khai hệ thống thương mại điện tử. UI hiện tại chỉ là prototype và không phải nguồn quyết định kiến trúc.

## Nguồn và thứ tự ưu tiên

Khi có mâu thuẫn, áp dụng theo thứ tự:

1. Change Request có trạng thái **Approved** trong [`../../spec/changes/`](../../spec/changes/).
2. [`../../spec/schema-freeze-v1.md`](../../spec/schema-freeze-v1.md).
3. [`../../spec/00-original-spec.md`](../../spec/00-original-spec.md).
4. [`architecture-decisions.md`](architecture-decisions.md).
5. Các rule chuyên môn trong thư mục này.
6. Code hiện tại.

Code hoặc tài liệu cấp thấp hơn không được tự ý ghi đè quyết định ở cấp cao hơn.

## Mục lục

| Tài liệu | Trạng thái | Phạm vi |
|---|---|---|
| [`architecture-decisions.md`](architecture-decisions.md) | Approved | Ranh giới Next.js, Payload và Supabase |
| [`api-conventions.md`](api-conventions.md) | Approved | REST API, envelope, HTTP status, pagination và idempotency |
| [`db-schema-rules.md`](db-schema-rules.md) | Approved | Naming vật lý, constraint, index và migration |
| [`business-rules.md`](business-rules.md) | Approved | QD01-QD20 và phân bổ RBTV |
| [`auth-rbac-rls.md`](auth-rbac-rls.md) | Approved | Authentication, RBAC, ownership và RLS |
| [`order-workflow-transactions.md`](order-workflow-transactions.md) | Approved | Checkout, state machine, tồn kho, voucher và payment |
| [`error-observability.md`](error-observability.md) | Approved | Error catalog, logging, audit và dữ liệu nhạy cảm |
| [`testing-quality-gates.md`](testing-quality-gates.md) | Approved | Test bắt buộc và điều kiện merge/release |

## Quy tắc quản lý thay đổi

- Không sửa Schema Freeze v1 để phản ánh code mới.
- Mọi thay đổi bảng, cột, kiểu, constraint, state machine hoặc business rule phải có Change Request.
- Chỉ CR `Approved` mới được cập nhật vào rules, migration hoặc code.
- Mỗi rule thay đổi phải ghi rõ CR nguồn và test tương ứng.
- Tài liệu trong thư mục này dùng từ khóa **MUST**, **MUST NOT**, **SHOULD** theo nghĩa bắt buộc, cấm và khuyến nghị.

## Kiến trúc đã khóa

- Next.js là frontend.
- Payload/Node.js là REST backend và tầng nghiệp vụ.
- Supabase cung cấp Auth, PostgreSQL và Storage.
- Frontend không đọc hoặc ghi trực tiếp bảng nghiệp vụ.
- Supabase Auth là nguồn định danh; Payload xác minh JWT và tải role/status nghiệp vụ từ database.
- Schema Freeze v1 gồm 22 bảng và QD01-QD20 là nguồn chuẩn.

