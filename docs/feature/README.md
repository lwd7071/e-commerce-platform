# Feature implementation reports

Thư mục này lưu báo cáo của từng thành viên cho 5 feature mở rộng của E-Commerce Platform. Mỗi feature có **một file báo cáo riêng** để dễ theo dõi, review và bàn giao.

## Danh sách báo cáo

| # | Feature | File báo cáo |
|---|---|---|
| 1 | Dòng tiền sàn & ví người bán (Escrow & Seller Wallet) | [`01-escrow-seller-wallet.md`](01-escrow-seller-wallet.md) |
| 2 | Tích hợp đơn vị vận chuyển (GHN/GHTK) | [`02-shipping-integration.md`](02-shipping-integration.md) |
| 3 | Phân cấp Buyer & Shop (Tiering & Loyalty) | [`03-tiering-loyalty.md`](03-tiering-loyalty.md) |
| 4 | Chat Buyer–Seller, trợ lý AI và Seller Live Chat | [`04-chat-ai-live-chat.md`](04-chat-ai-live-chat.md) |
| 5 | Flash Sale & chống bán vượt tồn | [`05-flash-sale-inventory.md`](05-flash-sale-inventory.md) |

## Cách cập nhật

1. Thành viên phụ trách feature tạo/cập nhật đúng file được phân công trong bảng trên. Nếu nhóm muốn chia một feature cho nhiều người, thống nhất một owner cập nhật báo cáo chung để tránh ghi đè hoặc thông tin mâu thuẫn.
2. Ghi lại công việc **đã thực sự hoàn thành**. Phân biệt rõ `Đã triển khai`, `Đang làm`, `Đang thử nghiệm`, `Đề xuất` và `Chưa làm`; không đánh dấu hoàn thành chỉ vì đã có thiết kế hoặc migration.
3. Mỗi kết luận cần có dấu vết kiểm chứng: đường dẫn file, migration/API/PR/commit, lệnh kiểm tra và kết quả. Ghi rõ phần nào chưa chạy hoặc còn phụ thuộc môi trường.
4. Thêm nhật ký mới lên đầu mục **Nhật ký cập nhật**, giữ nguyên lịch sử cũ. Cập nhật trạng thái tổng quan cùng lúc.
5. Viết ngắn gọn, cụ thể; dùng ngày `YYYY-MM-DD`. Mục không áp dụng ghi `Không`, mục chưa biết ghi `Chưa xác định` kèm người cần chốt nếu có.
6. Không đưa secret, token, mật khẩu, dữ liệu khách hàng thật hay thông tin ngân hàng thật vào báo cáo. Dùng tên biến môi trường và dữ liệu giả đã ẩn danh.

## Mẫu báo cáo cho mỗi feature

Sao chép mẫu này vào file feature tương ứng. Xóa nội dung hướng dẫn trong ngoặc vuông khi điền.

```markdown
# Báo cáo: [Tên feature]

## Owner và trạng thái

- Owner: [Tên thành viên]
- Người phối hợp: [Tên hoặc Không]
- Trạng thái: Chưa bắt đầu / Đang làm / Đang review / Hoàn thành / Blocked
- Cập nhật lần cuối: YYYY-MM-DD
- Nhánh / PR / commit: [link hoặc mã; nếu chưa có ghi Chưa có]

## Mục tiêu và phạm vi

- Mục tiêu: [Feature giải quyết vấn đề gì]
- Trong phạm vi: [Các luồng đã thống nhất]
- Ngoài phạm vi: [Phần chưa làm hoặc để giai đoạn sau]

## Đã thực hiện

- [Thay đổi cụ thể] — Bằng chứng: [đường dẫn file, API, migration, PR/commit]
- Nếu chưa có: Chưa bắt đầu.

## Thiết kế / quyết định kỹ thuật

- [Quyết định] — Lý do: [ngắn gọn]
- Thay đổi contract/schema: [mô tả + trạng thái Đề xuất/Đã duyệt; hoặc Không]
- Tương thích dữ liệu cũ / rollback: [cách xử lý; hoặc Không áp dụng]

## Kiểm tra và kết quả

| Kiểm tra | Lệnh / CI job | Kết quả | Bằng chứng / ghi chú |
|---|---|---|---|
| [Unit/integration/typecheck/lint/migration/manual] | [lệnh hoặc link] | PASS / FAIL / Chưa chạy | [link log, nguyên nhân nếu fail] |

## An toàn và tình huống lỗi

- Phân quyền / dữ liệu nhạy cảm: [cách bảo vệ; hoặc Không áp dụng]
- Retry, request trùng, race condition: [cách xử lý; hoặc Không áp dụng]
- Hủy, hoàn tiền, timeout, rollback: [cách xử lý; hoặc Không áp dụng]
- Rủi ro còn lại: [mô tả; hoặc Không]

## Việc còn lại và blocker

- [ ] [Việc cụ thể] — Owner: [tên] — Dự kiến: [ngày hoặc Chưa xác định]
- Blocker: [đang chờ ai/đầu ra nào; từ ngày nào; hoặc Không]

## Nhật ký cập nhật

### YYYY-MM-DD

- Đã làm: [việc đã hoàn thành hoặc Không]
- Kiểm tra: [kết quả thực tế hoặc Chưa chạy]
- Tiếp theo / blocker: [việc tiếp theo hoặc Không]
```

## Gợi ý nội dung theo feature

Các ý dưới đây là phạm vi cần báo cáo/đối chiếu, **không khẳng định chúng đã được triển khai hoặc đã được duyệt**. Ghi rõ quyết định thực tế của nhóm nếu khác.

### 1. Escrow & Seller Wallet

Báo cáo vòng đời tiền từ thanh toán, giữ tiền, điều kiện và thời điểm quyết toán, phí sàn, bút toán ví, yêu cầu rút tiền và duyệt payout. Nêu cách bảo đảm mỗi sự kiện chỉ ghi nhận một lần, xử lý hủy/hoàn/chargeback, đối soát và quyền truy cập số dư. Không ghi thông tin tài khoản ngân hàng thật.

### 2. GHN/GHTK

Báo cáo nhà vận chuyển và môi trường tích hợp, chuẩn hóa địa chỉ, cách tính phí, tạo vận đơn, lưu mã vận đơn, xác minh chữ ký webhook, ánh xạ trạng thái, retry và xử lý webhook trùng/thứ tự sai. Không đưa API key vào tài liệu.

### 3. Tiering & Loyalty

Báo cáo tier Buyer/Shop, điều kiện lên/xuống hạng, cách tính chi tiêu/điểm, thời điểm cộng/trừ, xử lý hoàn/hủy đơn, lịch sử điều chỉnh, quyền lợi và điều kiện voucher. Nêu rõ cái gì tự động và cái gì do admin cập nhật.

### 4. Chat AI & Seller Live Chat

Báo cáo luồng mở chat từ sản phẩm, quyền truy cập hội thoại, lưu và tải lịch sử, realtime/reconnect, trạng thái hand-off, thông báo Seller, chế độ khi Seller offline và chống gửi trùng. Với AI, ghi rõ nguồn context, giới hạn dữ liệu/PII, hành vi khi không tìm thấy câu trả lời, nhãn trả lời tự động và cách tránh bịa thông tin.

### 5. Flash Sale & Inventory

Báo cáo lịch và điều kiện Flash Sale, cách giữ/trừ/hoàn tồn, cơ chế chống oversell, giới hạn lượt mua, idempotency, hết hạn giữ hàng và đối soát Redis với database nếu dùng Redis. Ghi kết quả kiểm tra tải/concurrency kèm mức tải và môi trường; không tuyên bố chịu được “hàng nghìn người” nếu chưa có số liệu đo.

## Quy tắc review và bàn giao

- Chỉ owner cập nhật trạng thái và nhật ký của feature mình phụ trách; thay đổi contract ảnh hưởng feature khác cần thông báo các owner liên quan và ghi link quyết định/review.
- Đưa thay đổi schema qua migration theo quy ước repo; không sửa migration đã phát hành hoặc chạy lệnh reset/push schema tùy tiện.
- Không ghi PASS nếu không có kết quả chạy thực tế. Nếu CI chưa chạy, ghi `Chưa chạy`; nếu chạy một phần, liệt kê chính xác phần đó.
- Feature chỉ chuyển sang `Hoàn thành` khi phạm vi thống nhất đã có bằng chứng triển khai, kiểm tra phù hợp, tài liệu bàn giao và blocker được giải quyết hoặc chấp nhận rõ ràng.
