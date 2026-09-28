# Frontend Specification & API Contract

> **Dự án:** E-Commerce Platform  
> **Phiên bản:** 1.1.0  
> **Cập nhật:** 28/09/2026  
> **Trạng thái:** READY FOR FE FOUNDATION — FEATURE INTEGRATION SUBJECT TO READINESS MATRIX

## Mục đích

Bộ tài liệu này là nguồn hướng dẫn để triển khai Frontend trong `frontend/` và kết nối với Backend `backend/`. `ecommerce-web/` chỉ là bản test/prototype, không tiếp tục sửa hoặc dùng làm app triển khai. Tài liệu phân biệt rõ:

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
9. [UI/UX rules](./09-ui-ux-rules.md) — màu, font, stack, interaction, responsive và design handoff.
10. [UI/UX handoff](./10-ui-ux-handoff.md) — bố cục, trạng thái, navigation và owner cho từng route.
11. [Progress FE](./progress/README.md) — nhật ký và bằng chứng bàn giao của 5 người.

QA trong phạm vi Người 2: [UI QA report](./qa-nguoi-2-ui.md) — quality gates, browser/viewport, defects và handoff theo owner.

## Bắt đầu làm FE

Mỗi người đọc README này → file 01–10 cần cho ticket → [phân công 5 người](./08-implementation-plan.md#phân-công-5-người-fe) → [quy tắc progress](./progress/README.md). Tiếp theo đọc [README workspace](../../frontend/README.md), kiểm tra hướng dẫn repo áp dụng cho `frontend/`, rồi mới sửa code. Scaffold Next.js, package/lockfile, API client, AuthProvider, repository/adapters và Vitest đã có trong `frontend/` (commit nền `5ace145`); không tạo lại hoặc sửa package/lockfile nếu không thuộc Người 1. Dùng Node `22.20.0` theo `.nvmrc` và npm 11. Không cài package hoặc chạy app bằng `ecommerce-web/`. Chọn ticket có owner/readiness rõ và cập nhật progress trước khi bắt đầu.

Thương hiệu hiển thị toàn FE là **Dino**: wordmark chỉ là chữ `Dino`, không logo/biểu tượng/emoji; không đổi tên repo, package, API hoặc database. Người 1 cập nhật copy ở login/register; Người 3 cập nhật banner/footer/catalog thuộc page mình; Người 2 giữ header/metadata/profile; Người 4/5 dùng Dino cho nội dung mới. D-004 soát các page mẫu trước khi nhân rộng style. Feature chưa có API runtime dùng mock repository theo cùng interface và tắt ở production. Không biến prototype hoặc dữ liệu giả thành contract.

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
- Convention chung là snake_case; các ngoại lệ runtime camelCase gồm response Address và Voucher (list/evaluate), được ghi theo endpoint trong contract/adapters. Lỗi 501 cũng dùng ErrorEnvelope chuẩn; parser vẫn phải chịu được body rỗng/không phải JSON và code chưa biết.
- Adapter FE chuyển sang integer VND hoặc một money type thống nhất trước khi render/tính toán; không tính tiền trực tiếp bằng floating point.
- Timestamp truyền bằng ISO 8601 UTC, hiển thị theo locale `vi-VN` và timezone người dùng.
