# Frontend Specification & API Contract

> **Dự án:** E-Commerce Platform  
> **Phiên bản:** 1.1.0  
> **Cập nhật:** 28/09/2026  
> **Trạng thái:** READY FOR FE FOUNDATION — FEATURE INTEGRATION SUBJECT TO READINESS MATRIX

## Mục đích

Bộ tài liệu này là nguồn hướng dẫn để triển khai Frontend `ecommerce-web` và kết nối với Backend `backend`. Tài liệu phân biệt rõ:

- `AVAILABLE`: route tồn tại và được wire trong runtime production.
- `PARTIAL`: route tồn tại nhưng response/behavior chưa đủ cho UI.
- `RUNTIME_BLOCKED`: route có trong router nhưng runtime chưa inject service/repository cần thiết.
- `MISSING`: chưa có route.
- `TARGET`: thiết kế mong muốn, chưa phải contract hiện hành.

Không được tích hợp một tính năng `RUNTIME_BLOCKED` hoặc `MISSING` mà không dùng mock adapter hoặc hoàn thành backend dependency tương ứng.

## Tài liệu

1. [Project overview](./01-project-overview.md) — phạm vi, kiến trúc, nguyên tắc và Definition of Ready.
2. [Pages and user flows](./02-pages-and-user-flow.md) — 14 route, behavior, UI states và các luồng chính.
3. [Design system](./03-design-system.md) — token, component states, responsive và accessibility.
4. [Data model](./04-data-model.md) — wire DTO, view-model và quy tắc chuyển đổi dữ liệu.
5. [API contract](./05-api-contract.md) — contract backend hiện hành, payload, response và error handling.
6. [FE–BE mapping](./06-fe-be-mapping.md) — ánh xạ action → API → adapter → trạng thái sẵn sàng.
7. [Gap analysis](./07-gap-analysis.md) — blocker và quyết định cần thực hiện.
8. [Implementation plan](./08-implementation-plan.md) — backlog theo phase, dependency và acceptance criteria.

## Source of truth

Khi có mâu thuẫn, ưu tiên theo thứ tự:

1. Runtime code và integration test chạy qua `createRuntimeApp()`.
2. Contract parser/router trong backend.
3. OpenAPI được backend sinh tại `/api/v1/openapi.json`.
4. Bộ tài liệu này.
5. Mock data và JSX hiện tại của Frontend.

Các thay đổi contract phải cập nhật tối thiểu file 04, 05, 06, 07 và task liên quan trong file 08.

## Definition of Ready cho một feature FE

Một feature chỉ được coi là sẵn sàng triển khai khi:

- Route và role đã xác định.
- Request, response và error code có ví dụ cụ thể.
- Runtime backend đã được kiểm chứng, hoặc mock adapter đã được chấp thuận.
- Có loading, empty, error, unauthorized và retry behavior.
- Có acceptance criteria kiểm thử được.
- Không phụ thuộc vào field/endpoint mang nhãn `TARGET`, `MISSING` hoặc `RUNTIME_BLOCKED` mà không có fallback.

## Quy ước tiền tệ và thời gian

- Wire API giữ số tiền dạng decimal string nếu backend trả từ PostgreSQL `NUMERIC`.
- Convention chung là snake_case; một số response legacy như `GET/POST /addresses` hiện trả camelCase và được ghi rõ trong contract/adapters.
- Adapter FE chuyển sang integer VND hoặc một money type thống nhất trước khi render/tính toán; không tính tiền trực tiếp bằng floating point.
- Timestamp truyền bằng ISO 8601 UTC, hiển thị theo locale `vi-VN` và timezone người dùng.
