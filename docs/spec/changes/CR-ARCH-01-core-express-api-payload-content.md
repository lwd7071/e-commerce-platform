# Change Request: CR-ARCH-01

## 1. Thông tin chung

| Trường | Nội dung |
|---|---|
| **Mã CR** | `CR-ARCH-01` |
| **Tiêu đề** | Phân định kiến trúc Core Backend REST API `/api/v1` (Node.js/Express) và Payload CMS Content Service |
| **Người đề xuất** | Người 1 — Platform và Integration Lead |
| **Ngày đề xuất** | 2026-09-17 |
| **Trạng thái** | `Proposed` (Chờ Reviewer kiến trúc chính thức ký duyệt) |
| **Tài liệu tham chiếu** | [architecture-decisions.md](../../architecture/rules/architecture-decisions.md), [backend-work-plan.md](../../architecture/backend-work-plan.md), [00-original-spec.md](../00-original-spec.md) |

---

## 2. Bối cảnh và Vấn đề

1. **Quy định hiện tại trong tài liệu:**
   - `architecture-decisions.md` Mục 2 và 3 gọi backend là *"Payload Node.js Backend"*.
   - `backend-work-plan.md` dòng 44 giao Người 1 *"Scaffold Payload/Node.js backend, cấu trúc module, package.json và TypeScript"*.
2. **Thực tế kỹ thuật phát sinh tại mốc T1:**
   - Toàn bộ 77 test cases và domain model đã được Người 3 (Catalog) và Người 4 (Buyer) phát triển bằng TypeScript thuần túy kết hợp repository ports, hoàn toàn không phụ thuộc hay gắn kết với Payload Collections / Payload ORM.
   - Cơ sở dữ liệu 22 bảng nghiệp vụ (Users, Products, Orders, Payments, v.v.) được đóng băng tại `schema-freeze-v1.md` và do Người 2 quản lý trực tiếp bằng Supabase PostgreSQL migrations.
   - Payload CMS (v2/v3) yêu cầu cấu hình Database Adapter (Postgres/Drizzle/MongoDB) ngay từ khi khởi động runtime. Tuy nhiên ở mốc T1, Người 2 **chưa bàn giao connection string và database thật** cho Người 1 (theo `backend-work-plan.md` dòng 52). Nếu ép scaffold Payload CMS full stack tại T1, Người 1 sẽ rơi vào tình trạng **bị block chéo ngay lập tức**.
   - `architecture-decisions.md` Mục 3 đã nêu rõ ranh giới chức năng: *"Payload CMS content chỉ quản lý banner, campaign, FAQ và nội dung marketing; không chứa logic checkout/order/payment."*

---

## 3. Nội dung Đề xuất (Phương án A — Được chọn)

Tách bạch rõ ràng giữa **Core Transactional Backend** và **Marketing Content Service**:

1. **Core Backend Engine (`/api/v1`):**
   - Xây dựng trên nền tảng **Node.js + Express modular architecture** do Người 1 sở hữu trong `src/platform`.
   - Đảm nhiệm toàn bộ REST API endpoints `/api/v1`, security middlewares (Auth, Request ID, Error handling, Redaction), bất biến hóa `RequestContext`, routing tới các domain service của Người 3, 4, 5 và điều phối giao dịch PostgreSQL thông qua client của Người 2.
   - Đảm bảo tính độc lập, hiệu năng cao, kiểm thử tự động cực nhanh qua Supertest và `node:test` mà không phụ thuộc vào CMS runtime.

2. **Payload CMS Content Service:**
   - Định vị là một **service vệ tinh phục vụ biên tập nội dung marketing** (Banner, FAQ, Campaign, Landing page).
   - Được dời việc scaffold sang **mốc T3**, sau khi toàn bộ Core Platform, Database migrations và Transaction flows đã hoàn thành ổn định.
   - Khi triển khai ở T3, Payload CMS sẽ sử dụng database schema riêng hoặc collection độc lập, tuyệt đối không can thiệp hay thay đổi 22 bảng nghiệp vụ cốt lõi của E-Commerce.

---

## 4. Các Phương án đã Cân nhắc

| Phương án | Mô tả | Ưu điểm | Nhược điểm / Rủi ro | Đánh giá |
|---|---|---|---|---|
| **Phương án A (Đề xuất chọn)** | Core REST API `/api/v1` dùng Node.js/Express modular; Payload CMS scaffold ở T3 cho marketing content. | Unblock Người 1 ngay ở T1; không phụ thuộc DB Người 2; bám sát 77 tests hiện có của Người 3/4; kiến trúc gọn, nhẹ, đúng chuẩn micro/modular service. | Cần cập nhật mô tả trong `architecture-decisions.md` và `backend-work-plan.md`. | **Chọn** |
| **Phương án B** | Scaffold Payload CMS full stack ngay tại T1. | Giữ nguyên chữ "Payload" trong mô tả ban đầu. | Bị block ngay ở T1 do thiếu DB; kéo thêm hàng tá dependency CMS nặng nề; xung đột với mô hình Domain Entity / Repository Port của Người 3 và 4. | **Từ chối** |

---

## 5. Phạm vi Ảnh hưởng

- **Phạm vi tác động:** Thư mục `src/platform`, `backend/package.json`, cấu hình runtime app khởi chạy API tại T1.
- **Phạm vi không tác động:** 
  - Hoàn toàn không sửa đổi 22 bảng trong `schema-freeze-v1.md`.
  - Không ảnh hưởng đến domain model, ports và 77 unit tests của Người 3 và Người 4.
  - Không thay đổi các hợp đồng đã khóa ở T1 (`RequestContext`, `api-conventions.md`, `error-observability.md`).

---

## 6. Điều kiện Phê duyệt

1. Core Express backend phải tuân thủ 100% các Architecture Rules đã Approved:
   - Base path `/api/v1`.
   - Response Envelopes chuẩn (`data`, `error`, `request_id`).
   - Strict log redaction (password, otp, token, secret, cvv, v.v.).
   - `RequestContext` bất biến và thực thi chốt chặn an ninh `QD03` (`USER_LOCKED`).
2. Tuyệt đối không để rò rỉ stack trace, database internals ra client.
3. Khi tích hợp Payload CMS ở T3, chỉ cấu hình quản trị marketing content, không chạm vào core transactional business logic.

---

## 7. Kế hoạch Cập nhật Tài liệu sau khi CR Được Duyệt

Ngay sau khi Reviewer ký duyệt `CR-ARCH-01: Approved`:
1. Cập nhật [architecture-decisions.md](../../architecture/rules/architecture-decisions.md):
   - Mục 2: Sơ đồ luồng thay thế nhãn `Payload Node.js Backend` thành `Node.js Core Backend (/api/v1) + Payload CMS Content (T3)`.
   - Mục 3: Cập nhật ranh giới Node.js Core Backend và Payload CMS.
2. Cập nhật [backend-work-plan.md](../../architecture/backend-work-plan.md):
   - Dòng 44: Cập nhật nhiệm vụ Người 1 thành *"Scaffold Node.js/Express core backend, cấu trúc module, package.json và TypeScript (theo CR-ARCH-01)"*.

---

## 8. Quy trình review và phê duyệt CR

CR này chỉ là PR tài liệu kiến trúc độc lập; không gộp implementation Express, auth, CI
hoặc route wiring vào cùng PR.

1. Người 1 mở PR với trạng thái `Proposed`.
2. Reviewer ngoài owner là Người 2 hoặc Người 5 thực hiện GitHub review kỹ thuật và chọn `Approve`.
3. Sau khi có approval, Người 1 thêm một commit ghi trạng thái `Approved`, reviewer, ngày
   và URL review vào chính CR này.
4. Reviewer re-approve đúng HEAD mới.
5. Chỉ sau bước 4 mới được merge CR PR và mở các implementation PR phụ thuộc.

Reviewer phải xác nhận các điểm kỹ thuật sau:

- Express core thực sự đảm nhiệm auth, RBAC, transaction, idempotency, logging và REST `/api/v1`.
- Payload chỉ bị hoãn sang T3 cho marketing content, không bị loại bỏ khỏi kiến trúc dài hạn.
- Không thay đổi Schema Freeze và không giảm bất kỳ security gate nào.
- Domain modules không phụ thuộc Express.
- Phương án rollback là: nếu CR bị từ chối thì không merge các PR Express integration tiếp theo.

### Approval record

Phần này được điền bằng commit riêng sau khi reviewer ngoài owner đã approve; không tự
chuyển trạng thái trong PR Proposed.

| Trường | Giá trị |
|---|---|
| **Trạng thái** | `Proposed` |
| **Reviewer** | Chưa có |
| **Ngày review** | Chưa có |
| **URL GitHub review** | Chưa có |
