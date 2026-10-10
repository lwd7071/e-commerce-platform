# Nhật ký tiến độ Backend — Tổng quan

## Nhật ký MVP theo role

- [MVP User/Buyer implementation log](./mvp-user-buyer.md)
- [MVP User/Seller implementation log](./mvp-user-seller.md) — cập nhật 2026-10-01; các capability chính đã được triển khai, acceptance tổng thể vẫn IN_PROGRESS.
- [MVP User/Admin implementation log](./mvp-user-admin.md) — Admin Portal đang được hoàn thiện theo CR-ADMIN-01.

Nguồn phân công và dependency: [Kế hoạch Backend T1/T2/T3](../architecture/backend-work-plan.md).

## Cách đọc dành cho AI

- Thư mục này có một file nhật ký cho mỗi người theo ownership trong kế hoạch Backend. Khi cần biết ai đang làm gì hoặc đang chờ ai, đọc file của người đó; không suy đoán từ bảng tổng quan.
- `Trạng thái hiện tại` ở đầu file người là trạng thái mới nhất do owner ghi. `Nhật ký theo ngày` cung cấp bằng chứng và lý do của thay đổi. Nếu `Cập nhật lần cuối: Chưa có`, hãy báo **chưa có log mới**, không coi các checkbox là việc đã làm.
- `Contract đang sở hữu` ghi trạng thái **bàn giao** của port/interface. Nó không thay thế contract đã khóa trong [kế hoạch Backend](../architecture/backend-work-plan.md), Architecture Rules, code hoặc Change Request `Approved`. Thay đổi chưa được duyệt chỉ có trạng thái `Đề xuất` và chưa có hiệu lực.
- Bảng tổng quan bên dưới là bản tóm tắt cập nhật thủ công. Nếu bảng khác file người, ưu tiên file người về **tiến độ** và báo rõ README chưa được đồng bộ. Không dùng nhật ký tiến độ để suy diễn rằng contract hoặc Schema Freeze đã được phê duyệt.
- Khi trả lời về test, chỉ báo `pass`/`fail` nếu một mục nhật ký có mã QD/RB (nếu áp dụng), loại test và kết quả thực tế.

## Bảng tổng quan

Người 1 cập nhật bảng này khi có thay đổi lớn hoặc tại review cuối mỗi T; không cần sửa sau từng dòng nhật ký.

| Người | Domain | Mốc hiện tại | Blocker | Cập nhật cuối |
|---|---|---|---|---|
| [Người 1](nguoi-1-platform.md) | Platform/Integration | T3 hoàn tất | Không | 2026-09-28 |
| [Người 2](nguoi-2-database.md) | Database/Supabase | T3 hoàn tất | Không | 2026-09-28 |
| [Người 3](nguoi-3-catalog.md) | Catalog/Seller | T3 hoàn tất | Không | 2026-09-28 |
| [Người 4](nguoi-4-buyer-domain.md) | Buyer domain | T3 hoàn tất | Không | 2026-09-28 |
| [Người 5](nguoi-5-transaction.md) | Transaction core | T3 hoàn tất | Không | 2026-09-28 |

## T3 final review — 2026-09-28

> **Phạm vi:** T3 backend hardening/quality gates đã hoàn tất. Điều này không đồng nghĩa mọi capability HTTP mà FE cần đều đã được triển khai hoặc nối vào runtime. Bản audit runtime ngày 2026-09-29 nằm tại [FE–BE API contract](../frontend-spec/05-api-contract.md) và [gap analysis](../frontend-spec/07-gap-analysis.md); các route/stub/service wiring ở đó phản ánh code hiện tại, không thay đổi kết quả hoàn tất T3 bên dưới.

- **Người 1:** Giải quyết T3-P1-01 (chuẩn hóa OpenAPI 3.1, loại bỏ duplicate prefix, audit & test 3 Order operations: confirm/transition/payments), vá lỗ hổng Rate Limiter bypass qua trust proxy, bổ sung scripts `dev` / `start`.
- **Người 2:** Nghiệm thu Migration Rebuild sạch 22 bảng + 1 bảng vận hành `api_idempotency_records`, kiểm thử hồi quy bảo toàn lịch sử giao dịch (QD16 - RESTRICT), công cụ Schema Fingerprint Backup/Restore, và Concurrency Test Harness.
- **Người 3:** Giải quyết T3-P3-01 (đồng bộ hóa kiểm tra & tạo SKU per Shop bằng Row Lock `FOR UPDATE` trong transaction), tối ưu hóa Bulk Insert giảm 90% thời gian benchmark, 17/17 tests hardening pass trên PostgreSQL thật.
- **Người 4:** Triển khai `PostgresEventIdempotencyStore` kiến trúc Two-Tier Defense chống duplicate notification, kiểm thử Crash Recovery & Multi-Instance trên PostgreSQL thật, bàn giao Test Handover Matrix T3-P4-02.
- **Người 5:** Đóng toàn diện 4 findings T3-P5-01/02/03/04 (khóa hàng chống restock trùng khi hủy đơn, chặn race condition khi retry payment, ghi nhận history audit), 32/32 tests transaction pass trên PostgreSQL thật, module Reporting tuân thủ QD19.
- **Tích hợp & Quality Gates trên nhánh `dev`:**
  - Merge thành công toàn bộ 4 nhánh feature (`feat/t3-p1-security-openapi`, `feat/t3-nguoi-3-catalog`, `t3-p4-buyer`, `thanh-vien-5`).
  - Diagnose toàn diện: Khắc phục triệt để các cảnh báo ESLint (`@typescript-eslint/no-explicit-any`, unused variables) và lỗi logic thiếu `reason` khi Admin confirm đơn hàng.
  - `npm run test:node`: **593/593 tests PASS (100%)**.
  - `npm run typecheck`: **0 errors**.
  - `npm run lint` (`--max-warnings=0`): **0 errors, 0 warnings (100% clean)**.
  - `npm run build`: **Bundle thành công** (`dist/app.js` 156.3kb).

## T1 final review — 2026-09-19

- Người 1: CI local PostgreSQL `17.6`, runtime JWT thật, route matrix và auth smoke workflow.
- Người 2: Schema Freeze 22 bảng, RLS acceptance và operational idempotency migration đã deploy Supabase.
- Người 3: Catalog cursor contract, ownership và checkout snapshot đã bàn giao.
- Người 4: Address/Cart/Voucher PostgreSQL repositories và transaction-scoped adapters đã bàn giao.
- Người 5: Checkout persistence, advisory idempotency lock, bounded retry và order handlers đã bàn giao.
- Gate đã kiểm chứng: typecheck, build, lint không lỗi, native/Vitest suites và remote schema suite.
- Auth smoke thật chạy trên push `dev/main`; yêu cầu các secret `SUPABASE_TEST_*` tương ứng trong repository settings.
- `.ecommerce-web-git-backup/` được giữ nguyên, không stage và không xóa.

## Template chuẩn

Giữ nguyên tên và thứ tự các mục sau trong cả năm file. Khi bắt đầu ghi nhật ký thật, thêm ngày mới ở đầu phần `Nhật ký theo ngày`. Với trường không phát sinh trong ngày, ghi `Không`; không để trống. Không ghi ngày giả khi chưa làm việc.

~~~markdown
# Nhật ký tiến độ — Người <n> (<Vai trò>)

## Trạng thái hiện tại

- Mốc: T1 / T2 / T3
- Cập nhật lần cuối: YYYY-MM-DD
- Đang làm: <một dòng, hoặc Chưa bắt đầu>
- Bị block bởi: <ai + đầu ra cần chờ + từ ngày nào, hoặc Không>

## Nhật ký theo ngày

### YYYY-MM-DD

- Đã làm:
  - <việc cụ thể, gắn module/file nếu có; hoặc Không>
- Quyết định kỹ thuật:
  - <quyết định> — Lý do: <ngắn gọn; hoặc Không>
- Contract/port thay đổi:
  - <tên> — <thay đổi> — Trạng thái: Đề xuất/Đã duyệt — Ảnh hưởng: <ai; hoặc Không>
- Blocker phát sinh:
  - <mô tả> — Cần: <ai/đầu ra> — Từ ngày: <YYYY-MM-DD; hoặc Không>
- Test đã viết:
  - <mã QD/RB nếu có> — <loại test> — Kết quả: pass/fail; hoặc Không

## Contract đang sở hữu

| Tên | Trạng thái bàn giao | Version/ngày khóa | Người tiêu thụ |
|---|---|---|---|
| <tên> | Đề xuất/Đã khóa | <version/ngày hoặc Chưa có> | <người> |

## Việc còn lại trong mốc hiện tại

- [ ] <việc từ kế hoạch Backend thuộc ownership của mình>
~~~

## Quy tắc cập nhật

- Mỗi người chỉ sửa file của mình. Người 1 quản lý bảng tổng quan README; không sửa nhật ký của người khác.
- Ghi cuối ngày làm việc hoặc cuối phiên code; không cần ghi thời gian thực. Cập nhật `Trạng thái hiện tại` cùng lúc với nhật ký ngày mới.
- Giữ nguyên nhật ký cũ, thêm mục ngày mới ở đầu phần nhật ký. Không gộp hoặc xóa lịch sử khi chưa có quy định lưu trữ riêng.
- Contract thay đổi ảnh hưởng người khác: ghi vào file owner **và** báo trực tiếp qua kênh chat của nhóm. Nhật ký không thay thế thông báo tức thời, review contract hoặc quy trình Change Request.
- Test ghi mã QD/RB nếu có, loại test và kết quả thực tế. Blocker ghi rõ đang chờ ai, đầu ra nào và từ ngày nào; khi được gỡ, cập nhật trạng thái và ghi vào nhật ký ngày đó.
- Checkbox chỉ được đánh dấu hoàn thành khi có đầu ra kiểm chứng được. Khi chuyển T, lấy danh sách việc của mốc mới từ kế hoạch Backend; không tự đổi ownership hoặc contract.
