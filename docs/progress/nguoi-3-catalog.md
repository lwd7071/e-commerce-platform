# Nhật ký tiến độ — Người 3 (Catalog và Seller domain)

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

- [ ] Thiết kế domain model, DTO, validation và repository interface cho Shop, Category, Product, ProductVariant và ProductImage.
- [ ] Soạn endpoint contract cho public catalog và Seller catalog.
- [ ] Định nghĩa, công bố Catalog port cho Người 5: khóa variant, đọc giá, tồn và status.
- [ ] Viết unit test thuần cho price, stock, SKU và Seller ownership.
- [ ] Sau khi Người 1 hoàn thành scaffold và cấu trúc module: đặt Catalog module vào backend.
- [ ] Sau khi Người 1 mở shared contract structure: đưa Catalog port vào `src/contracts` qua owner.
- [ ] Sau khi Người 2 hoàn thành migration Shop/Product/Variant/Image và database client: chạy repository integration test.
- [ ] Sau khi Người 1 hoàn thành `RequestContext` và auth middleware contract: wiring authenticated endpoint.
