# Tiến độ FE — Người 1 (Platform và Integration Lead)

## Trạng thái hiện tại

- Phase/ticket: Chưa bắt đầu
- Cập nhật lần cuối: Chưa có
- Đang làm: Chưa bắt đầu
- Nhánh/PR: Chưa có
- Bị block bởi: Không
- Việc tiếp theo: C-001/C-003/C-004, F-101/F-102; bàn giao API client và repository interface

## Nhật ký theo ngày

Chưa có cập nhật. Dùng [mẫu chung](./README.md#mẫu-cập-nhật-bắt-buộc) khi bắt đầu.

## Handoff/contract đang sở hữu

| Tên | Consumer | Đầu ra/fixture/test | Trạng thái | Link |
|---|---|---|---|---|
| API client + AppError/envelope | Người 3, 4, 5 | Parser 204/timeout/error, request_id, fixture | Chưa bắt đầu | Chưa có |
| Auth/route guard | Người 2, 3, 4, 5 | Session/role/returnTo behavior + test | Chưa bắt đầu | Chưa có |
| Mock/API repository switch | Người 2, 3, 4, 5 | Interface, flag, contract test | Chưa bắt đầu | Chưa có |

## Việc được giao

- [ ] C-001/C-003–005 — phối hợp contract, flag, repository boundary, quyết định FE-BE.
- [ ] F-101–107 — env, API client, adapters, auth, route guards, mock/API switch.
- [ ] B-303/B-304 — login thật, registration UI có gating.
- [ ] Q-801/Q-806–808 — build/lint, resilience, drift, release mocks.
