# Tiến độ FE — Người 5 (Orders, Review và Admin)

## Trạng thái hiện tại

- Phase/ticket: FE Planning & Spec Reconciliation
- Cập nhật lần cuối: 2026-09-28
- Đang làm: Đã hoàn tất đóng Mốc T3 Backend. Đã rà soát đặc tả FE (02-pages-and-user-flow, 05-api-contract, 08-implementation-plan) cho các trang Orders (`/orders`), Chi tiết & Review (`/orders/[id]/review`), Cancel/Transition flows, và Admin Categories / Seller KPI.
- Nhánh/PR: thanh-vien-5
- Bị block bởi: Không
- Việc tiếp theo: Triển khai O-502/O-504/O-505 (buyer/seller orders timeline, cancel reason modal, transition actions) kết nối với API contract đã khóa.

## Nhật ký theo ngày

### 2026-09-28 (Khởi động FE & Đối soát Đặc tả Frontend Người 5)

- **Đã làm:**
  - Đồng bộ nhánh `dev` mới nhất: Kéo toàn bộ foundation FE mẫu (`ecommerce-web/src/app/orders/page.tsx`, `orders/[id]/review/page.tsx`, `admin/categories/page.tsx`, `seller/page.tsx`).
  - Đối soát API Contract (`docs/frontend-spec/05-api-contract.md`): Rà soát các endpoint Order Lifecycle mà Người 5 phụ trách (`POST /orders/{id}/cancel`, `POST /orders/{id}/confirm`, `POST /orders/{id}/transition`, `POST /orders/{id}/payments`), đảm bảo request/response payload, headers (Idempotency-Key) và error codes (`PAYMENT_STATE_INVALID`, `ORDER_CANCELLATION_NOT_ALLOWED`, `ORDER_INVALID_TRANSITION`) khớp 1-1 giữa Backend và Frontend.
  - Lập kế hoạch component cho Màn hình Orders & Timeline: chuẩn bị state transition helpers, cancellation dialog, reason input validation theo RB-LTT08.
- **Quyết định kỹ thuật:**
  - Tái sử dụng contract error code chuẩn hóa từ Backend envelope `{ success, data, error: { code, message }, meta }` cho các xử lý UI thông báo lỗi.
- **Blocker phát sinh:**
  - Không.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| Order status/actions + reason | Người 4 | State machine/role/409 fixture + test | Đã sẵn sàng | [backend/src/modules/order/domain/order-state-machine.ts](../../backend/src/modules/order/domain/order-state-machine.ts) |
| Admin/category consumer | Người 3 | Category adapter input, moderation/readiness | Sẵn sàng phối hợp | [docs/frontend-spec/05-api-contract.md](../05-api-contract.md) |
| Seller KPI/reporting UI | Người 1, 3 | Date range, timezone, server totals contract | Đã sẵn sàng (QD19) | [backend/src/modules/reporting/services/reporting.service.ts](../../backend/src/modules/reporting/services/reporting.service.ts) |

## Việc được giao

- [ ] O-502–505/O-507 — buyer/seller orders, cancel, transition, review UI.
- [ ] A-704/A-705/A-708 — admin dashboard, user lock/unlock, seller KPI khi API sẵn.
- [ ] A-709 — admin categories page, tiêu thụ category adapter A-700 của Người 3; nối API sau A-701.
- [ ] P-607c — review media UI khi P-606/GAP-09 đóng.
- [ ] Q-805 — RBAC/security gate cho direct URL/API.
