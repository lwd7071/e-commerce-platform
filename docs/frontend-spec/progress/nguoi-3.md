# Tiến độ FE — Người 3 (Catalog và Seller Catalog)

## Trạng thái hiện tại

- Phase/ticket: Chưa bắt đầu
- Cập nhật lần cuối: Chưa có
- Đang làm: Chưa bắt đầu
- Nhánh/PR: Chưa có
- Bị block bởi: Không
- Việc tiếp theo: B-301/B-302; kiểm catalog runtime và dựng list/detail states

## Nhật ký theo ngày

Chưa có cập nhật. Dùng [mẫu chung](./README.md#mẫu-cập-nhật-bắt-buộc) khi bắt đầu.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| Product card/detail + add-to-cart action | Người 4 | Variant/quantity input, error/guest returnTo, fixture | Chưa bắt đầu | Chưa có |
| Category adapter | Người 5 | UUID xác minh, tree/filter fallback, fixture | Chưa bắt đầu | Chưa có |
| Seller product/media adapter | Người 1, 5 | Owner-scoped DTO, upload readiness/flag | Chưa bắt đầu | Chưa có |

## Việc được giao

- [ ] B-301/B-302/B-305 — public catalog, detail, category fallback.
- [ ] B-401 — product detail add-to-cart action; bàn giao command cho Người 4.
- [ ] O-508/O-509 — seller product list và stock edit khi endpoint sẵn.
- [ ] P-607a — product upload khi P-606/GAP-09 đóng.
- [ ] A-700/A-702 — bàn giao category adapter sớm; sau đó nối category UI trên homepage/seller catalog.
