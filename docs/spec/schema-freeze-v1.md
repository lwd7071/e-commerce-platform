# Schema Freeze v1

> **Trạng thái: FROZEN.** Đây là version gốc được trích từ `Nhom04_ThietKeDuLieu.docx`. Mọi thay đổi đối với bảng, cột, kiểu dữ liệu, ràng buộc hoặc business rule phải được đề xuất bằng Change Request trong [`changes/`](changes/) và chỉ có hiệu lực khi CR ở trạng thái **Approved**.

## 1. Phạm vi và quyết định nền tảng

Schema Freeze v1 gồm 22 bảng nghiệp vụ trên PostgreSQL/Supabase. Supabase Auth quản lý xác thực; `User.UserID` sử dụng trực tiếp UUID của `auth.users.id`. Giá và tồn kho hiện hành chỉ lưu tại `ProductVariant`; sản phẩm không có phân loại vẫn có một default variant.

`OrderItem` lưu snapshot tên sản phẩm, biến thể và đơn giá; `Order` lưu snapshot địa chỉ giao hàng. Checkout nhiều shop được tách thành nhiều Order, mỗi Order thuộc đúng một Shop. Một Order dùng tối đa một voucher; một Order có thể có nhiều lần thử Payment nhưng tối đa một Payment `SUCCESS`. Dữ liệu có lịch sử giao dịch ưu tiên đổi trạng thái thay vì xóa vật lý.

## 2. Danh sách bảng

1. [User](#1-user)
2. [UserProfile](#2-userprofile)
3. [Address](#3-address)
4. [Shop](#4-shop)
5. [Category](#5-category)
6. [Product](#6-product)
7. [ProductImage](#7-productimage)
8. [ProductVariant](#8-productvariant)
9. [Cart](#9-cart)
10. [CartItem](#10-cartitem)
11. [Order](#11-order)
12. [OrderItem](#12-orderitem)
13. [OrderStatusHistory](#13-orderstatushistory)
14. [Payment](#14-payment)
15. [Shipment](#15-shipment)
16. [Voucher](#16-voucher)
17. [VoucherUsage](#17-voucherusage)
18. [Review](#18-review)
19. [ReviewImage](#19-reviewimage)
20. [Notification](#20-notification)
21. [ModerationRecord](#21-moderationrecord)
22. [AdminLog](#22-adminlog)

## 3. Chi tiết 22 bảng

### 1. User

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `UserID` | `UUID` | NOT NULL | Mã người dùng | PK, FK → auth.users(id); ON DELETE RESTRICT |
| `Email` | `VARCHAR(255)` | Email hợp lệ | Email nghiệp vụ | UNIQUE, NOT NULL; đồng bộ Supabase Auth |
| `Role` | `VARCHAR(20)` | {BUYER, SELLER, ADMIN} | Vai trò hệ thống | NOT NULL |
| `Status` | `VARCHAR(20)` | {ACTIVE, LOCKED} | Trạng thái tài khoản | NOT NULL |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| `UpdatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm cập nhật | Không lưu Password/PasswordHash; Supabase Auth quản lý |

**Quan hệ khóa ngoại**

- `UserID`: PK, FK → auth.users(id); ON DELETE RESTRICT

### 2. UserProfile

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `UserID` | `UUID` | NOT NULL | Mã người dùng | PK, FK → User.UserID |
| `FullName` | `VARCHAR(150)` | Chuỗi <= 150 | Họ tên |  |
| `Phone` | `VARCHAR(20)` | SĐT hợp lệ / NULL | Số điện thoại | Có thể NULL |
| `AvatarURL` | `TEXT` | URL / NULL | Ảnh đại diện | Supabase Storage |
| `UpdatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

**Quan hệ khóa ngoại**

- `UserID`: PK, FK → User.UserID

### 3. Address

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `AddressID` | `UUID` | NOT NULL | Mã địa chỉ | PK |
| `UserID` | `UUID` | NOT NULL | Chủ sở hữu địa chỉ | FK → User.UserID |
| `RecipientName` | `VARCHAR(150)` | Chuỗi không rỗng | Tên người nhận | NOT NULL |
| `Phone` | `VARCHAR(20)` | SĐT hợp lệ | Số điện thoại nhận | NOT NULL |
| `Province` | `VARCHAR(100)` | Chuỗi không rỗng | Tỉnh/Thành | NOT NULL |
| `District` | `VARCHAR(100)` | Chuỗi không rỗng | Quận/Huyện | NOT NULL |
| `Ward` | `VARCHAR(100)` | Chuỗi không rỗng | Phường/Xã | NOT NULL |
| `DetailAddress` | `VARCHAR(255)` | Chuỗi không rỗng | Địa chỉ chi tiết | NOT NULL |
| `IsDefault` | `BOOLEAN` | {TRUE, FALSE} | Địa chỉ mặc định | Mặc định FALSE; tối đa 1 default/User |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| `UpdatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

**Quan hệ khóa ngoại**

- `UserID`: FK → User.UserID

### 4. Shop

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `ShopID` | `UUID` | NOT NULL | Mã gian hàng | PK |
| `OwnerID` | `UUID` | NOT NULL | Chủ shop | FK → User.UserID; UNIQUE trong MVP |
| `ShopName` | `VARCHAR(150)` | Chuỗi không rỗng | Tên gian hàng | NOT NULL |
| `Description` | `TEXT` | Nội dung / NULL | Mô tả shop | Có thể NULL |
| `LogoURL` | `TEXT` | URL / NULL | Logo shop | Supabase Storage |
| `PickupAddress` | `VARCHAR(255)` | Chuỗi hợp lệ | Địa chỉ lấy hàng |  |
| `ContactPhone` | `VARCHAR(20)` | SĐT hợp lệ | Số điện thoại liên hệ |  |
| `Status` | `VARCHAR(20)` | {PENDING, ACTIVE, SUSPENDED, LOCKED} | Trạng thái shop | NOT NULL |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| `UpdatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm cập nhật | OwnerID UNIQUE là giả định MVP, không phải yêu cầu gốc |

**Quan hệ khóa ngoại**

- `OwnerID`: FK → User.UserID; UNIQUE trong MVP

### 5. Category

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `CategoryID` | `UUID` | NOT NULL | Mã danh mục | PK |
| `ParentCategoryID` | `UUID` | UUID / NULL | Danh mục cha | FK tự tham chiếu; NULL = cấp 1 |
| `CategoryName` | `VARCHAR(150)` | Chuỗi không rỗng | Tên danh mục | NOT NULL |
| `Description` | `TEXT` | Nội dung / NULL | Mô tả | Có thể NULL |
| `Status` | `VARCHAR(20)` | {ACTIVE, INACTIVE} | Trạng thái danh mục | NOT NULL |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm tạo | Tối đa 2 cấp trong MVP; Service kiểm tra |
| `UpdatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

**Quan hệ khóa ngoại**

- `ParentCategoryID`: FK tự tham chiếu; NULL = cấp 1

### 6. Product

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `ProductID` | `UUID` | NOT NULL | Mã sản phẩm | PK |
| `ShopID` | `UUID` | NOT NULL | Shop sở hữu sản phẩm | FK → Shop.ShopID |
| `CategoryID` | `UUID` | NOT NULL | Danh mục sản phẩm | FK → Category.CategoryID |
| `ProductName` | `VARCHAR(255)` | Chuỗi không rỗng | Tên sản phẩm | NOT NULL |
| `Description` | `TEXT` | Nội dung / NULL | Mô tả sản phẩm | Có thể NULL |
| `Status` | `VARCHAR(20)` | {DRAFT, ACTIVE, INACTIVE, HIDDEN} | Trạng thái sản phẩm | NOT NULL |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm tạo | Không lưu giá/tồn kho tại Product |
| `UpdatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm cập nhật | Giá/tồn kho nằm tại ProductVariant |

**Quan hệ khóa ngoại**

- `ShopID`: FK → Shop.ShopID
- `CategoryID`: FK → Category.CategoryID

### 7. ProductImage

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `ImageID` | `UUID` | NOT NULL | Mã ảnh sản phẩm | PK |
| `ProductID` | `UUID` | NOT NULL | Sản phẩm sở hữu ảnh | FK → Product.ProductID |
| `ImageURL` | `TEXT` | URL hợp lệ | Đường dẫn ảnh | Lưu file trên Supabase Storage |
| `SortOrder` | `INTEGER` | >= 0 | Thứ tự hiển thị |  |

**Quan hệ khóa ngoại**

- `ProductID`: FK → Product.ProductID

### 8. ProductVariant

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `VariantID` | `UUID` | NOT NULL | Mã biến thể | PK |
| `ProductID` | `UUID` | NOT NULL | Sản phẩm sở hữu biến thể | FK → Product.ProductID |
| `VariantName` | `VARCHAR(100)` | Chuỗi hợp lệ | Tên nhóm phân loại | Default variant dùng giá trị quy ước |
| `VariantValue` | `VARCHAR(150)` | Chuỗi hợp lệ | Giá trị phân loại |  |
| `SKU` | `VARCHAR(100)` | Chuỗi không rỗng | Mã SKU | Duy nhất trong phạm vi Shop; Service kiểm tra |
| `Price` | `NUMERIC(15,2)` | > 0 | Giá bán hiện hành | Nguồn giá duy nhất |
| `StockQuantity` | `INTEGER` | >= 0 | Tồn kho hiện hành | Nguồn tồn kho duy nhất |
| `Status` | `VARCHAR(20)` | {ACTIVE, INACTIVE} | Trạng thái biến thể | NOT NULL |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| `UpdatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

**Quan hệ khóa ngoại**

- `ProductID`: FK → Product.ProductID

### 9. Cart

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `CartID` | `UUID` | NOT NULL | Mã giỏ hàng | PK |
| `BuyerID` | `UUID` | NOT NULL | Chủ giỏ hàng | FK → User.UserID; UNIQUE |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| `UpdatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

**Quan hệ khóa ngoại**

- `BuyerID`: FK → User.UserID; UNIQUE

### 10. CartItem

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `CartItemID` | `UUID` | NOT NULL | Mã dòng giỏ hàng | PK |
| `CartID` | `UUID` | NOT NULL | Giỏ hàng sở hữu dòng | FK → Cart.CartID |
| `VariantID` | `UUID` | NOT NULL | Biến thể được chọn | FK → ProductVariant.VariantID |
| `Quantity` | `INTEGER` | >= 1 | Số lượng |  |
| `IsSelected` | `BOOLEAN` | {TRUE, FALSE} | Có được chọn checkout hay không |  |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm thêm | Hệ thống quản lý |
| `UpdatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm cập nhật | UNIQUE(CartID, VariantID) áp dụng cho dòng giỏ |

**Quan hệ khóa ngoại**

- `CartID`: FK → Cart.CartID
- `VariantID`: FK → ProductVariant.VariantID

### 11. Order

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `OrderID` | `UUID` | NOT NULL | Mã đơn hàng | PK |
| `BuyerID` | `UUID` | NOT NULL | Người mua | FK → User.UserID |
| `ShopID` | `UUID` | NOT NULL | Shop xử lý đơn | FK → Shop.ShopID |
| `RecipientName` | `VARCHAR(150)` | Chuỗi không rỗng | Tên người nhận | Snapshot |
| `RecipientPhone` | `VARCHAR(20)` | SĐT hợp lệ | Số điện thoại nhận | Snapshot |
| `Province` | `VARCHAR(100)` | Chuỗi không rỗng | Tỉnh/Thành | Snapshot |
| `District` | `VARCHAR(100)` | Chuỗi không rỗng | Quận/Huyện | Snapshot |
| `Ward` | `VARCHAR(100)` | Chuỗi không rỗng | Phường/Xã | Snapshot |
| `DeliveryAddress` | `VARCHAR(255)` | Chuỗi không rỗng | Địa chỉ chi tiết | Snapshot |
| `Subtotal` | `NUMERIC(15,2)` | >= 0 | Tiền hàng | Chốt khi tạo Order; bất biến |
| `DiscountAmount` | `NUMERIC(15,2)` | >= 0 | Số tiền giảm | Mặc định 0; chốt khi tạo Order |
| `ShippingFee` | `NUMERIC(15,2)` | >= 0 | Phí vận chuyển | Chốt khi tạo Order |
| `TotalAmount` | `NUMERIC(15,2)` | >= 0 | Tổng thanh toán | = Subtotal + ShippingFee - DiscountAmount; chốt khi tạo Order |
| `Status` | `VARCHAR(30)` | {PENDING_CONFIRMATION, CONFIRMED, PREPARING, SHIPPING, COMPLETED, CANCELLED, DELIVERY_FAILED} | Trạng thái đơn | NOT NULL |
| `CancelReason` | `TEXT` | Nội dung / NULL | Lý do hủy | Service bắt buộc khi Status = CANCELLED |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| `UpdatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

**Quan hệ khóa ngoại**

- `BuyerID`: FK → User.UserID
- `ShopID`: FK → Shop.ShopID

### 12. OrderItem

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `OrderItemID` | `UUID` | NOT NULL | Mã chi tiết đơn | PK |
| `OrderID` | `UUID` | NOT NULL | Đơn hàng chứa dòng hàng | FK → Order.OrderID |
| `ProductID` | `UUID` | NOT NULL | Sản phẩm đã mua | FK → Product.ProductID |
| `VariantID` | `UUID` | NOT NULL | Biến thể đã mua | FK → ProductVariant.VariantID |
| `ProductNameSnapshot` | `VARCHAR(255)` | Chuỗi không rỗng | Tên sản phẩm lúc mua | Snapshot |
| `VariantSnapshot` | `VARCHAR(255)` | Chuỗi / NULL | Mô tả biến thể lúc mua | Snapshot |
| `UnitPrice` | `NUMERIC(15,2)` | > 0 | Đơn giá lúc mua | Snapshot, bất biến |
| `Quantity` | `INTEGER` | >= 1 | Số lượng mua |  |
| `LineTotal` | `NUMERIC(15,2)` | >= 0 | Thành tiền dòng | = UnitPrice × Quantity |

**Quan hệ khóa ngoại**

- `OrderID`: FK → Order.OrderID
- `ProductID`: FK → Product.ProductID
- `VariantID`: FK → ProductVariant.VariantID

### 13. OrderStatusHistory

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `HistoryID` | `UUID` | NOT NULL | Mã lịch sử trạng thái | PK |
| `OrderID` | `UUID` | NOT NULL | Đơn hàng liên quan | FK → Order.OrderID |
| `OldStatus` | `VARCHAR(30)` | Trạng thái / NULL | Trạng thái trước | NULL với bản ghi khởi tạo |
| `NewStatus` | `VARCHAR(30)` | Miền trạng thái Order | Trạng thái mới | NOT NULL |
| `ChangedBy` | `UUID` | UUID / NULL | Tác nhân thay đổi | FK → User.UserID; ON DELETE SET NULL; NULL = hệ thống |
| `Reason` | `TEXT` | Nội dung / NULL | Lý do thay đổi | Có thể NULL tùy nghiệp vụ |
| `ChangedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm thay đổi | NOT NULL |

**Quan hệ khóa ngoại**

- `OrderID`: FK → Order.OrderID
- `ChangedBy`: FK → User.UserID; ON DELETE SET NULL; NULL = hệ thống

### 14. Payment

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `PaymentID` | `UUID` | NOT NULL | Mã thanh toán | PK |
| `OrderID` | `UUID` | NOT NULL | Đơn hàng được thanh toán | FK → Order.OrderID |
| `TransactionCode` | `VARCHAR(100)` | Chuỗi / NULL | Mã giao dịch | UNIQUE khi có giá trị; partial unique index |
| `Method` | `VARCHAR(20)` | {COD, ONLINE} | Phương thức thanh toán | NOT NULL |
| `Amount` | `NUMERIC(15,2)` | > 0 | Số tiền thanh toán | = Order.TotalAmount trong MVP |
| `Status` | `VARCHAR(20)` | {PENDING, SUCCESS, FAILED} | Trạng thái thanh toán | NOT NULL |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| `PaidAt` | `TIMESTAMPTZ` | Thời gian / NULL | Thời điểm thanh toán thành công | Bắt buộc khi Status = SUCCESS |
| `Note` | `TEXT` | Nội dung / NULL | Ghi chú giao dịch mô phỏng | Có thể NULL |

**Quan hệ khóa ngoại**

- `OrderID`: FK → Order.OrderID

### 15. Shipment

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `ShipmentID` | `UUID` | NOT NULL | Mã vận chuyển | PK |
| `OrderID` | `UUID` | NOT NULL | Đơn hàng liên quan | FK → Order.OrderID; UNIQUE |
| `CarrierName` | `VARCHAR(150)` | Chuỗi / NULL | Đơn vị vận chuyển mô phỏng |  |
| `TrackingCode` | `VARCHAR(100)` | Chuỗi / NULL | Mã vận đơn | UNIQUE khi có giá trị |
| `Status` | `VARCHAR(30)` | {PENDING, HANDED_OVER, SHIPPING, DELIVERED, FAILED} | Trạng thái vận chuyển | NOT NULL |
| `UpdatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm cập nhật gần nhất | Hệ thống quản lý |

**Quan hệ khóa ngoại**

- `OrderID`: FK → Order.OrderID; UNIQUE

### 16. Voucher

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `VoucherID` | `UUID` | NOT NULL | Mã định danh voucher | PK |
| `Code` | `VARCHAR(50)` | Chuỗi không rỗng | Mã voucher | UNIQUE, NOT NULL |
| `VoucherName` | `VARCHAR(150)` | Chuỗi không rỗng | Tên chương trình | NOT NULL |
| `Scope` | `VARCHAR(20)` | {PLATFORM, SHOP} | Phạm vi áp dụng | NOT NULL |
| `ShopID` | `UUID` | UUID / NULL | Shop sở hữu voucher | FK → Shop.ShopID; NULL với PLATFORM |
| `DiscountType` | `VARCHAR(20)` | {PERCENT, FIXED} | Kiểu giảm giá | NOT NULL |
| `DiscountValue` | `NUMERIC(15,2)` | > 0; PERCENT <= 100 | Giá trị giảm | CHECK |
| `MaxDiscount` | `NUMERIC(15,2)` | >= 0 / NULL | Mức giảm tối đa | Có thể NULL |
| `MinOrderValue` | `NUMERIC(15,2)` | >= 0 | Giá trị đơn tối thiểu |  |
| `Quantity` | `INTEGER` | >= 0 | Số lượt phát hành còn lại |  |
| `StartAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm bắt đầu | NOT NULL |
| `EndAt` | `TIMESTAMPTZ` | EndAt > StartAt | Thời điểm kết thúc | NOT NULL |
| `Status` | `VARCHAR(20)` | {ACTIVE, INACTIVE} | Trạng thái voucher | NOT NULL |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| `UpdatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

**Quan hệ khóa ngoại**

- `ShopID`: FK → Shop.ShopID; NULL với PLATFORM

### 17. VoucherUsage

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `UsageID` | `UUID` | NOT NULL | Mã lượt dùng voucher | PK |
| `VoucherID` | `UUID` | NOT NULL | Voucher được sử dụng | FK → Voucher.VoucherID |
| `OrderID` | `UUID` | NOT NULL | Đơn áp dụng voucher | FK → Order.OrderID; UNIQUE |
| `BuyerID` | `UUID` | NOT NULL | Người sử dụng | FK → User.UserID |
| `DiscountAmount` | `NUMERIC(15,2)` | >= 0 | Số tiền giảm thực tế | Phải = Order.DiscountAmount trong transaction tạo đơn |
| `UsedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm sử dụng | NOT NULL |

**Quan hệ khóa ngoại**

- `VoucherID`: FK → Voucher.VoucherID
- `OrderID`: FK → Order.OrderID; UNIQUE
- `BuyerID`: FK → User.UserID

### 18. Review

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `ReviewID` | `UUID` | NOT NULL | Mã đánh giá | PK |
| `BuyerID` | `UUID` | NOT NULL | Người mua đánh giá | FK → User.UserID |
| `ProductID` | `UUID` | NOT NULL | Sản phẩm được đánh giá | FK → Product.ProductID |
| `OrderItemID` | `UUID` | NOT NULL | Dòng đơn làm căn cứ đánh giá | FK → OrderItem.OrderItemID; UNIQUE |
| `Rating` | `SMALLINT` | {1,2,3,4,5} | Số sao đánh giá | CHECK 1–5 |
| `Content` | `TEXT` | Nội dung / NULL | Nhận xét của Buyer | Có thể NULL |
| `Status` | `VARCHAR(20)` | {VISIBLE, HIDDEN} | Trạng thái hiển thị | NOT NULL |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| `UpdatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm cập nhật | Hệ thống quản lý |

**Quan hệ khóa ngoại**

- `BuyerID`: FK → User.UserID
- `ProductID`: FK → Product.ProductID
- `OrderItemID`: FK → OrderItem.OrderItemID; UNIQUE

### 19. ReviewImage

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `ReviewImageID` | `UUID` | NOT NULL | Mã ảnh đánh giá | PK |
| `ReviewID` | `UUID` | NOT NULL | Đánh giá sở hữu ảnh | FK → Review.ReviewID |
| `ImageURL` | `TEXT` | URL hợp lệ | Đường dẫn ảnh | Lưu file trên Supabase Storage |
| `SortOrder` | `INTEGER` | >= 0 | Thứ tự hiển thị |  |

**Quan hệ khóa ngoại**

- `ReviewID`: FK → Review.ReviewID

### 20. Notification

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `NotificationID` | `UUID` | NOT NULL | Mã thông báo | PK |
| `RecipientID` | `UUID` | NOT NULL | Người nhận thông báo | FK → User.UserID |
| `Type` | `VARCHAR(30)` | {ORDER, PAYMENT, SHIPPING, VIOLATION, SYSTEM} | Loại thông báo | NOT NULL |
| `Title` | `VARCHAR(255)` | Chuỗi không rỗng | Tiêu đề | NOT NULL |
| `Content` | `TEXT` | Nội dung không rỗng | Nội dung thông báo | NOT NULL |
| `IsRead` | `BOOLEAN` | {TRUE, FALSE} | Đã đọc hay chưa | Mặc định FALSE |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm tạo | Hệ thống quản lý |
| `ReadAt` | `TIMESTAMPTZ` | Thời gian / NULL | Thời điểm đọc | Bắt buộc khi IsRead = TRUE |

**Quan hệ khóa ngoại**

- `RecipientID`: FK → User.UserID

### 21. ModerationRecord

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `ModerationID` | `UUID` | NOT NULL | Mã bản ghi kiểm duyệt | PK |
| `TargetType` | `VARCHAR(30)` | {USER, SHOP, PRODUCT, REVIEW, ORDER, VOUCHER, ...} | Loại đối tượng kiểm duyệt | Polymorphic |
| `TargetID` | `UUID` | NOT NULL | Mã đối tượng tương ứng | Không có FK vật lý; Service kiểm tra tồn tại |
| `Reason` | `TEXT` | Nội dung hợp lệ | Lý do xử lý | NOT NULL |
| `Action` | `VARCHAR(50)` | {HIDE, LOCK, UNLOCK, RESTORE, WARNING, ...} | Hành động xử lý | NOT NULL |
| `AdminID` | `UUID` | NOT NULL | Admin thực hiện | FK → User.UserID |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm xử lý | Hệ thống quản lý |

**Quan hệ khóa ngoại**

- `TargetID`: Không có FK vật lý; Service kiểm tra tồn tại
- `AdminID`: FK → User.UserID

### 22. AdminLog

| Cột | Kiểu | Miền giá trị hoặc ràng buộc | Ý nghĩa | Ghi chú |
|---|---|---|---|---|
| `LogID` | `UUID` | NOT NULL | Mã nhật ký | PK |
| `AdminID` | `UUID` | NOT NULL | Admin thực hiện | FK → User.UserID |
| `Action` | `VARCHAR(100)` | Chuỗi hợp lệ | Tên thao tác quản trị | NOT NULL |
| `TargetType` | `VARCHAR(30)` | Loại đối tượng | Loại đối tượng bị tác động | Polymorphic |
| `TargetID` | `UUID` | UUID / NULL | Mã đối tượng | NULL với thao tác toàn hệ thống |
| `Reason` | `TEXT` | Nội dung / NULL | Lý do hoặc ghi chú | Bắt buộc với thao tác có quy định lý do |
| `CreatedAt` | `TIMESTAMPTZ` | Thời gian hợp lệ | Thời điểm ghi log | Dữ liệu audit được lưu để truy vết |

**Quan hệ khóa ngoại**

- `AdminID`: FK → User.UserID

## 4. Business rules QD01-QD20

| Mã | Quy định |
|---|---|
| **QD01** | Email/tên đăng nhập phải duy nhất trong hệ thống. |
| **QD02** | Mật khẩu không lưu dạng văn bản thuần. |
| **QD03** | Tài khoản bị khóa không được thực hiện nghiệp vụ cần đăng nhập. |
| **QD04** | Người bán chỉ quản lý shop và sản phẩm thuộc quyền sở hữu của mình. |
| **QD05** | Giá sản phẩm phải lớn hơn 0. |
| **QD06** | Tồn kho không được nhỏ hơn 0. |
| **QD07** | Số lượng đặt mua không được vượt tồn kho tại thời điểm xác nhận đơn. |
| **QD08** | Giá trong đơn hàng là giá được chốt tại thời điểm đặt, không tự đổi khi seller đổi giá sau đó. |
| **QD09** | Voucher chỉ áp dụng khi còn hiệu lực, còn lượt và đạt giá trị đơn tối thiểu. |
| **QD10** | Tổng tiền thanh toán không được âm. |
| **QD11** | Chỉ được chuyển trạng thái đơn theo luồng trạng thái đã quy định. |
| **QD12** | Buyer chỉ được hủy đơn khi đơn đang ở trạng thái cho phép. |
| **QD13** | Seller chỉ được xử lý các đơn thuộc shop của mình. |
| **QD14** | Chỉ người đã mua sản phẩm trong đơn hoàn thành mới được đánh giá. |
| **QD15** | Điểm đánh giá từ 1 đến 5 sao. |
| **QD16** | Sản phẩm/shop có lịch sử giao dịch không xóa vật lý tùy tiện; ưu tiên đổi trạng thái. |
| **QD17** | Admin khi khóa tài khoản/shop/sản phẩm phải lưu lý do. |
| **QD18** | Không lưu thông tin thẻ ngân hàng thật trong hệ thống đồ án. |
| **QD19** | Dữ liệu thống kê doanh thu chỉ tính các đơn được xác định là hợp lệ/hoàn thành. |
| **QD20** | Các thao tác quản trị quan trọng cần được ghi nhật ký. |

## 5. Ràng buộc toàn vẹn

### RB-KC - Ràng buộc khóa chính

| Mã | Mô tả | Thành phần liên quan | Thực thi hoặc ghi chú |
|---|---|---|---|
| **RB-KC01** | Mỗi bảng User, UserProfile, Address, Shop, Category, Product, ProductImage, ProductVariant, Cart, CartItem, Order, OrderItem, OrderStatusHistory, Payment, Shipment, Voucher, VoucherUsage, Review, ReviewImage, Notification, ModerationRecord và AdminLog phải có khóa chính duy nhất và không NULL. | UserProfile, ProductVariant, ProductImage, OrderStatusHistory, ModerationRecord, VoucherUsage, ReviewImage, Notification, AdminLog, CartItem, OrderItem, Payment, Shipment, Voucher, Review, Address, Category, Product, Order, Shop, Cart, User | Database: PRIMARY KEY |
| **RB-KC02** | UserProfile.UserID vừa là PK vừa là FK → User.UserID để bảo đảm quan hệ 1:0..1. | UserProfile, User | Database: PRIMARY KEY |

### RB-KN - Ràng buộc khóa ngoại

| Mã | Mô tả | Thành phần liên quan | Thực thi hoặc ghi chú |
|---|---|---|---|
| **RB-KN01** | User.UserID tham chiếu auth.users.id. | User | Database: FOREIGN KEY |
| **RB-KN02** | Address.UserID → User.UserID. | Address, User | Database: FOREIGN KEY |
| **RB-KN03** | Shop.OwnerID → User.UserID. | Shop, User | Database: FOREIGN KEY |
| **RB-KN04** | Category.ParentCategoryID → Category.CategoryID, cho phép NULL. | Category | Database: FOREIGN KEY |
| **RB-KN05** | Product.ShopID → Shop.ShopID; Product.CategoryID → Category.CategoryID. | Category, Product, Shop | Database: FOREIGN KEY |
| **RB-KN06** | ProductImage.ProductID → Product.ProductID. | ProductImage, Product | Database: FOREIGN KEY |
| **RB-KN07** | ProductVariant.ProductID → Product.ProductID. | ProductVariant, Product | Database: FOREIGN KEY |
| **RB-KN08** | Cart.BuyerID → User.UserID. | Cart, User | Database: FOREIGN KEY |
| **RB-KN09** | CartItem.CartID → Cart.CartID; CartItem.VariantID → ProductVariant.VariantID. | ProductVariant, CartItem, Product, Cart | Database: FOREIGN KEY |
| **RB-KN10** | Order.BuyerID → User.UserID; Order.ShopID → Shop.ShopID. | Order, Shop, User | Database: FOREIGN KEY |
| **RB-KN11** | OrderItem.OrderID → Order.OrderID; ProductID → Product.ProductID; VariantID → ProductVariant.VariantID. | ProductVariant, OrderItem, Product, Order | Database: FOREIGN KEY |
| **RB-KN12** | OrderStatusHistory.OrderID → Order.OrderID; ChangedBy → User.UserID và cho phép NULL. | OrderStatusHistory, Order, User | Database: FOREIGN KEY |
| **RB-KN13** | Payment.OrderID → Order.OrderID. | Payment, Order | Database: FOREIGN KEY |
| **RB-KN14** | Shipment.OrderID → Order.OrderID. | Shipment, Order | Database: FOREIGN KEY |
| **RB-KN15** | Voucher.ShopID → Shop.ShopID và cho phép NULL. | Voucher, Shop | Database: FOREIGN KEY |
| **RB-KN16** | VoucherUsage.VoucherID → Voucher.VoucherID; OrderID → Order.OrderID; BuyerID → User.UserID. | VoucherUsage, Voucher, Order, User | Database: FOREIGN KEY |
| **RB-KN17** | Review.BuyerID → User.UserID; ProductID → Product.ProductID; OrderItemID → OrderItem.OrderItemID. | OrderItem, Review, Product, Order, User | Database: FOREIGN KEY |
| **RB-KN18** | ReviewImage.ReviewID → Review.ReviewID. | ReviewImage, Review | Database: FOREIGN KEY |
| **RB-KN19** | Notification.RecipientID → User.UserID. | Notification, User | Database: FOREIGN KEY |
| **RB-KN20** | ModerationRecord.AdminID và AdminLog.AdminID → User.UserID, NOT NULL. TargetID của cả hai bảng có thể NULL khi thao tác không gắn với một đối tượng cụ thể (ví dụ hành động toàn hệ thống); khi có giá trị, tính hợp lệ được kiểm tra tại Service theo TargetType tương ứng. Không khai báo FK vật lý cho ModerationRecord.TargetID/AdminLog.TargetID vì chúng tham chiếu động theo TargetType. | ModerationRecord, AdminLog, User | Database: FOREIGN KEY |

### RB-MG - Ràng buộc miền giá trị

| Mã | Mô tả | Thành phần liên quan | Thực thi hoặc ghi chú |
|---|---|---|---|
| **RB-MG01** | User.Role ∈ {BUYER, SELLER, ADMIN}. | User | Database CHECK hoặc Service validation |
| **RB-MG02** | User.Status ∈ {ACTIVE, LOCKED}. | User | Database CHECK hoặc Service validation |
| **RB-MG03** | ProductVariant.Price > 0. | ProductVariant, Product | Database CHECK hoặc Service validation |
| **RB-MG04** | ProductVariant.StockQuantity >= 0. | ProductVariant, Product | Database CHECK hoặc Service validation |
| **RB-MG05** | CartItem.Quantity >= 1. | CartItem, Cart | Database CHECK hoặc Service validation |
| **RB-MG06** | OrderItem.UnitPrice > 0; OrderItem.Quantity >= 1; OrderItem.LineTotal >= 0. | OrderItem, Order | Database CHECK hoặc Service validation |
| **RB-MG07** | Order.Subtotal, DiscountAmount, ShippingFee, TotalAmount >= 0. | Order | Database CHECK hoặc Service validation |
| **RB-MG08** | Review.Rating ∈ {1,2,3,4,5}. | Review | Database CHECK hoặc Service validation |
| **RB-MG09** | Voucher.Quantity >= 0; DiscountValue > 0; MinOrderValue >= 0; MaxDiscount >= 0 nếu có. | Voucher, Order | Database CHECK hoặc Service validation |
| **RB-MG10** | Payment.Amount > 0. | Payment | Database CHECK hoặc Service validation |
| **RB-MG11** | ProductImage.SortOrder và ReviewImage.SortOrder >= 0. | ProductImage, ReviewImage, Review, Product, Order | Database CHECK hoặc Service validation |
| **RB-MG12** | Các trường trạng thái chỉ nhận giá trị thuộc miền trạng thái đã định nghĩa cho User, Shop, Category, Product, ProductVariant, Order, Payment, Shipment, Voucher và Review. | ProductVariant, Payment, Shipment, Voucher, Review, Category, Product, Order, Shop, User | Database CHECK hoặc Service validation |

### RB-LTT - Ràng buộc liên thuộc tính

| Mã | Mô tả | Thành phần liên quan | Thực thi hoặc ghi chú |
|---|---|---|---|
| **RB-LTT01** | OrderItem.LineTotal = OrderItem.UnitPrice × OrderItem.Quantity. | OrderItem, Order | CHECK hoặc Service/transaction |
| **RB-LTT02** | Order.TotalAmount = Order.Subtotal + Order.ShippingFee - Order.DiscountAmount và Order.TotalAmount >= 0. | Order | CHECK hoặc Service/transaction |
| **RB-LTT03** | Voucher.StartAt < Voucher.EndAt. | Voucher | CHECK hoặc Service/transaction |
| **RB-LTT04** | Nếu Voucher.DiscountType = PERCENT thì 0 < DiscountValue <= 100. | Voucher | CHECK hoặc Service/transaction |
| **RB-LTT05** | Nếu Voucher.Scope = PLATFORM thì ShopID IS NULL; nếu Voucher.Scope = SHOP thì ShopID IS NOT NULL. | Voucher, Shop | CHECK hoặc Service/transaction |
| **RB-LTT06** | Nếu Payment.Status = SUCCESS thì PaidAt IS NOT NULL. | Payment | CHECK hoặc Service/transaction |
| **RB-LTT07** | Nếu Notification.IsRead = TRUE thì ReadAt IS NOT NULL. | Notification | CHECK hoặc Service/transaction |
| **RB-LTT08** | Khi Order.Status = CANCELLED, nghiệp vụ phải ghi CancelReason theo quy định hủy. | Order | CHECK hoặc Service/transaction |

### RB-LB - Ràng buộc liên bộ

| Mã | Mô tả | Thành phần liên quan | Thực thi hoặc ghi chú |
|---|---|---|---|
| **RB-LB01** | User.Email duy nhất trong hệ thống nghiệp vụ. | User | UNIQUE hoặc Service |
| **RB-LB02** | Shop.OwnerID UNIQUE trong MVP: một tài khoản sở hữu tối đa một Shop. Đây là giả định thiết kế MVP, không phải yêu cầu gốc. | Shop | UNIQUE hoặc Service |
| **RB-LB03** | Cart.BuyerID UNIQUE: một Buyer có tối đa một Cart. | Cart | UNIQUE hoặc Service |
| **RB-LB04** | UNIQUE(CartID, VariantID): một biến thể chỉ xuất hiện một dòng trong cùng Cart. | Cart | UNIQUE hoặc Service |
| **RB-LB05** | Mỗi User có tối đa một Address IsDefault = TRUE. | Address, User | UNIQUE hoặc Service |
| **RB-LB06** | Voucher.Code UNIQUE. | Voucher | UNIQUE hoặc Service |
| **RB-LB07** | VoucherUsage.OrderID UNIQUE: một Order sử dụng tối đa một voucher. | VoucherUsage, Voucher, Order | UNIQUE hoặc Service |
| **RB-LB08** | Shipment.OrderID UNIQUE: một Order có tối đa một Shipment trong MVP. | Shipment, Order | UNIQUE hoặc Service |
| **RB-LB09** | Review.OrderItemID UNIQUE: một OrderItem được đánh giá tối đa một lần trong MVP. | OrderItem, Review, Order | UNIQUE hoặc Service |
| **RB-LB10** | Mỗi Order có tối đa một Payment có Status = SUCCESS. | Payment, Order | UNIQUE hoặc Service |
| **RB-LB11** | SKU duy nhất trong phạm vi Shop. Vì ShopID không nằm trực tiếp trong ProductVariant, Service kiểm tra qua ProductVariant → Product → Shop. | ProductVariant, Product, Shop | UNIQUE hoặc Service |

### RB-LQH - Ràng buộc liên quan hệ

| Mã | Mô tả | Thành phần liên quan | Thực thi hoặc ghi chú |
|---|---|---|---|
| **RB-LQH01** | Order.Subtotal = tổng OrderItem.LineTotal của Order. | OrderItem, Order | Service/transaction |
| **RB-LQH02** | Order.TotalAmount = Order.Subtotal + Order.ShippingFee - Order.DiscountAmount. | Order | Service/transaction |
| **RB-LQH03** | Nếu Order có VoucherUsage thì VoucherUsage.DiscountAmount = Order.DiscountAmount. Nếu không có VoucherUsage thì Order.DiscountAmount = 0. | VoucherUsage, Voucher, Order | Service/transaction |
| **RB-LQH04** | Trong MVP, mỗi Payment của Order thanh toán 100% giá trị đơn: Payment.Amount = Order.TotalAmount. Ràng buộc này cần thay đổi nếu hệ thống mở rộng sang thanh toán từng phần, trả góp hoặc split payment. | Payment, Order | Service/transaction |
| **RB-LQH05** | Review chỉ được tạo khi Review.BuyerID = Order.BuyerID của Order chứa OrderItem tương ứng, Review.ProductID phù hợp với OrderItem.ProductID và Order.Status = COMPLETED tại thời điểm tạo Review. Lưu ý cho RB-LQH05: điều kiện COMPLETED chỉ kiểm tra khi tạo Review. Nếu sau đó Admin can thiệp trạng thái đơn theo QLDH-A, Review đã tồn tại không bị xóa hoặc vô hiệu hóa hồi tố trong MVP. | OrderItem, Review, Product, Order | Service/transaction |
| **RB-LQH06** | ProductVariant.StockQuantity không được âm sau khi tạo đơn. Số lượng đặt phải <= tồn kho tại thời điểm transaction xác nhận đơn. | ProductVariant, Product | Service/transaction |
| **RB-LQH07** | Seller chỉ được cập nhật Product, ProductVariant, Voucher và Order thuộc Shop do mình sở hữu. | ProductVariant, Voucher, Product, Order, Shop | Service/transaction |
| **RB-LQH08** | Doanh thu Seller/Admin chỉ được tổng hợp từ các Order thuộc trạng thái hợp lệ/COMPLETED theo quy định báo cáo. | Order | Service/transaction |

## 6. Phân chia trách nhiệm thực thi

**Database enforce:** khóa chính của 22 bảng; khóa ngoại thông thường; các UNIQUE, CHECK và partial unique index có thể biểu diễn trực tiếp trong PostgreSQL; các miền giá trị cơ bản như giá dương, tồn kho không âm, số lượng tối thiểu và rating 1-5.

**Service hoặc transaction enforce:** quyền sở hữu Buyer/Seller; category tối đa hai cấp; SKU duy nhất trong phạm vi Shop; tính hợp lệ của `TargetType + TargetID`; chuyển trạng thái Order; điều kiện voucher; điều kiện tạo Review; kiểm tra giá, tồn kho và trạng thái variant khi checkout; đối chiếu các tổng tiền liên bảng.

Các trường tài chính của Order được tính và chốt trong transaction tạo Order. `OrderItem` không hỗ trợ cập nhật nghiệp vụ sau khi Order đã tồn tại; không dùng trigger để liên tục tái tính các giá trị này.

## 7. Kiểm soát thay đổi

1. Tạo một file Change Request mới trong [`changes/`](changes/).
2. Ghi rõ lý do, phạm vi, ảnh hưởng dữ liệu, migration, API và business rules.
3. Change Request có thể ở trạng thái `Proposed`, `Approved` hoặc `Rejected`.
4. Chỉ Change Request `Approved` mới được áp dụng vào rules hoặc code.
5. Không sửa nội dung Schema Freeze v1 để che giấu lịch sử; phiên bản sau phải tham chiếu CR đã được duyệt.

Bản tài liệu nguồn đầy đủ: [`Nhom04_ThietKeDuLieu.docx`](../../Nhom04_ThietKeDuLieu.docx).
