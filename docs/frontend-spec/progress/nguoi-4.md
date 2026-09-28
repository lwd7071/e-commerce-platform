# Tiến độ FE — Người 4 (Buyer Cart và Checkout)

## Trạng thái hiện tại

- Phase/ticket: Chưa bắt đầu
- Cập nhật lần cuối: Chưa có
- Đang làm: Chưa bắt đầu
- Nhánh/PR: Chưa có
- Bị block bởi: Không
- Việc tiếp theo: B-402/B-404; cart/checkout states và contract fixture

## Nhật ký theo ngày

Chưa có cập nhật. Dùng [mẫu chung](./README.md#mẫu-cập-nhật-bắt-buộc) khi bắt đầu.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| Cart command/repository | Người 3 | Add/quantity/selection/delete input/error, fixture | Chưa bắt đầu | Chưa có |
| Checkout view-model/idempotency | Người 1, 5 | Decimal/ship/key snapshot, retry/409 cases | Chưa bắt đầu | Chưa có |

## Việc được giao

- [ ] B-402/B-403 — cart UI, quantity/selection/delete và rollback.
- [ ] B-404/B-405 — address list/create, edit/default/delete gating.
- [ ] B-406–408 — voucher preview, checkout và E2E với backend/test DB.
- [ ] Q-804 — Buyer/Seller critical E2E gate, phối hợp evidence với Người 5.
