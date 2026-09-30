# Kiểm thử MVP theo luồng và vai trò

Thư mục này dùng để phối hợp kiểm thử các luồng nghiệp vụ Dino MVP, ghi nhận lỗi có thể tái hiện, sửa lỗi và lưu bằng chứng. Phạm vi nghiệp vụ chuẩn nằm trong [Quy tắc nghiệp vụ theo vai trò](../architecture/role-business-rules.md); các state machine và quy tắc chi tiết được liên kết từ tài liệu đó.

## Cách làm

1. Đọc quy tắc cho role và luồng được phân công trước khi kiểm thử.
2. Ghi điều kiện, dữ liệu test và trạng thái ban đầu; dùng tài khoản/dữ liệu test riêng.
3. Đi hết luồng theo thứ tự như người dùng thực hiện. Kiểm tra giao diện, request/response, trạng thái lưu và quyền truy cập.
4. Với mỗi lỗi: ghi bước tái hiện, kết quả mong đợi/thực tế, mức độ ảnh hưởng và bằng chứng. Liên kết issue/PR/commit nếu có.
5. Sửa trong phạm vi được giao, chạy lại ca lỗi và các luồng liên quan. Không tự thay đổi business rule đã chốt; đề xuất Change Request khi cần.
6. Cập nhật file tiến độ cá nhân và bảng tổng hợp trong `plan.md`.

## Trạng thái dùng chung

`Chưa bắt đầu` · `Đang làm` · `Bị chặn` · `Đã sửa, chờ kiểm tra lại` · `Đã xác minh` · `Không phải lỗi / cần quyết định nghiệp vụ`.

## Mẫu báo cáo

Sao chép khung này vào file tiến độ được giao cho từng ca kiểm thử hoặc lỗi. Mỗi dòng/báo cáo phải đủ thông tin để người khác tái hiện.

```md
### [ID] Tên luồng hoặc lỗi
- Trạng thái: Chưa bắt đầu | Đang làm | Bị chặn | Đã sửa, chờ kiểm tra lại | Đã xác minh | Không phải lỗi / cần quyết định nghiệp vụ
- Người thực hiện:
- Ngày cập nhật:
- Role và tài khoản/dữ liệu test:
- Quy tắc tham chiếu: (mục/ mã rule trong role-business-rules.md hoặc tài liệu liên quan)
- Điều kiện ban đầu:
- Các bước thực hiện:
  1.
- Kết quả mong đợi:
- Kết quả thực tế:
- Bằng chứng: (ảnh, log/request id, video hoặc đường dẫn)
- Mức độ: Blocker | Cao | Vừa | Thấp
- Nguyên nhân (nếu đã xác định):
- Cách sửa / liên kết issue, PR hoặc commit:
- Kiểm tra lại: (ca đã chạy, kết quả, môi trường, ngày)
- Rủi ro/công việc tiếp theo:
```

## Quy ước phân loại mức độ

- **Blocker:** không thể tiếp tục luồng cốt lõi, dữ liệu sai/mất, hoặc vi phạm nghiêm trọng quyền truy cập.
- **Cao:** luồng nghiệp vụ chính thất bại nhưng còn đường vòng hạn chế.
- **Vừa:** chức năng phụ hoặc một tình huống phổ biến lỗi, có cách xử lý tạm.
- **Thấp:** hiển thị, nội dung hoặc tình huống ít gặp, không làm sai dữ liệu nghiệp vụ.

Không đưa dữ liệu cá nhân/thông tin bí mật vào báo cáo. Dùng ID giả lập hoặc che thông tin nhạy cảm trong bằng chứng.
