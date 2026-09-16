# Nhật ký tiến độ — Người 1 (Platform và Integration Lead)

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

- [ ] Scaffold Payload/Node.js backend, cấu trúc module, `package.json` và TypeScript.
- [ ] Thiết lập test runner, lint, typecheck, build và CI skeleton.
- [ ] Cài API envelope, request ID, error middleware và health endpoint.
- [ ] Định nghĩa `RequestContext`, shared contract folder, naming convention và Auth repository interface; khóa contract dùng chung và soạn tài liệu API ban đầu.
- [ ] Sau khi Người 2 bàn giao migration `app_users`, seed User và database connection: xác minh Supabase JWT, chặn User `LOCKED` và chạy auth smoke test.
- [ ] Sau khi Người 3 khóa endpoint DTO và Catalog port: wiring route Catalog.
- [ ] Sau khi Người 4 khóa Cart/Voucher port: wiring route Cart/Voucher.
- [ ] Sau khi Người 5 khóa checkout/order command và response contract: wiring route checkout/order.
