"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Store,
  BarChart3,
  Clock,
  Truck,
  AlertTriangle,
  Plus,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";

interface ShopOrder {
  id: string;
  buyerName: string;
  phone: string;
  address: string;
  productName: string;
  variant: string;
  qty: number;
  total: number;
  status: "PENDING_CONFIRMATION" | "CONFIRMED" | "PREPARING" | "SHIPPING" | "COMPLETED" | "CANCELLED";
  createdAt: string;
}

interface ShopProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  sold: number;
  status: "ACTIVE" | "INACTIVE";
  image: string;
}

export default function SellerPage() {
  const [activeTab, setActiveTab] = useState<"orders" | "products" | "vouchers">("orders");

  const [orders, setOrders] = useState<ShopOrder[]>([
    {
      id: "DH-2026-001",
      buyerName: "Nguyễn Trung Hải",
      phone: "0912***456",
      address: "P. Linh Chiểu, TP. Thủ Đức, TP.HCM",
      productName: "Áo sơ mi Linen dáng suông Minimalist",
      variant: "Be Cát / Size M",
      qty: 1,
      total: 289000,
      status: "PENDING_CONFIRMATION",
      createdAt: "16/09/2026 08:15",
    },
    {
      id: "DH-2026-002",
      buyerName: "Trần Đăng Thắng",
      phone: "0988***123",
      address: "P. Bến Nghé, Quận 1, TP.HCM",
      productName: "Áo sơ mi Linen dáng suông Minimalist",
      variant: "Trắng Kem / Size L",
      qty: 2,
      total: 578000,
      status: "CONFIRMED",
      createdAt: "16/09/2026 07:45",
    },
    {
      id: "DH-2026-003",
      buyerName: "Nông Văn Cường",
      phone: "0934***789",
      address: "P. Tân Định, Quận 1, TP.HCM",
      productName: "Quần âu ống suông sợi tự nhiên",
      variant: "Xám Tro / Size 31",
      qty: 1,
      total: 340000,
      status: "PREPARING",
      createdAt: "15/09/2026 21:10",
    },
    {
      id: "DH-2026-004",
      buyerName: "Lê Minh Tuấn",
      phone: "0903***555",
      address: "Q. Hải Châu, TP. Đà Nẵng",
      productName: "Áo sơ mi Linen dáng suông Minimalist",
      variant: "Xanh Olive / Size M",
      qty: 1,
      total: 310000,
      status: "SHIPPING",
      createdAt: "15/09/2026 14:20",
    },
  ]);

  const [products, setProducts] = useState<ShopProduct[]>([
    {
      id: "p-1",
      name: "Áo sơ mi Linen dáng suông Minimalist",
      sku: "MORI-LN-BE-M",
      price: 289000,
      stock: 15,
      sold: 142,
      status: "ACTIVE",
      image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=200",
    },
    {
      id: "p-2",
      name: "Áo sơ mi Linen dáng suông Minimalist (Kem)",
      sku: "MORI-LN-WT-L",
      price: 289000,
      stock: 3,
      sold: 88,
      status: "ACTIVE",
      image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=200",
    },
    {
      id: "p-3",
      name: "Quần âu ống suông sợi tự nhiên",
      sku: "MORI-TROUSER-GR-31",
      price: 340000,
      stock: 22,
      sold: 95,
      status: "ACTIVE",
      image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=200",
    },
    {
      id: "p-4",
      name: "Áo Blazer Linen nhẹ tay cộc",
      sku: "MORI-BLAZER-BE-F",
      price: 490000,
      stock: 0,
      sold: 64,
      status: "INACTIVE",
      image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=200",
    },
  ]);

  const [shopVouchers] = useState([
    { code: "MORI10K", value: "10.000₫", min: "250.000₫", used: "45/100", status: "Đang chạy" },
    { code: "MORI5PCT", value: "5% (Tối đa 30k)", min: "400.000₫", used: "82/100", status: "Đang chạy" },
  ]);

  const fmtPrice = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(amount) + "₫";
  };

  const advanceOrderStatus = (orderId: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        if (ord.status === "PENDING_CONFIRMATION") return { ...ord, status: "CONFIRMED" };
        if (ord.status === "CONFIRMED") return { ...ord, status: "PREPARING" };
        if (ord.status === "PREPARING") return { ...ord, status: "SHIPPING" };
        if (ord.status === "SHIPPING") return { ...ord, status: "COMPLETED" };
        return ord;
      })
    );
  };

  const cancelOrder = (orderId: string) => {
    const reason = prompt("Nhập lý do hủy/từ chối đơn:");
    if (!reason) return;
    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, status: "CANCELLED" } : ord))
    );
  };

  return (
    <div className="min-h-screen bg-[#FBF8F9] text-[#221C1F] pb-20">
      {/* HEADER KÊNH NGƯỜI BÁN */}
      <header className="bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#F2E8EC] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-9 h-9 rounded-xl bg-[#FAF6F8] hover:bg-[#FFF0F6] flex items-center justify-center text-[#7E7077] hover:text-[#FF7AAC] transition-colors border border-[#F2E8EC]" title="Về trang mua sắm">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-[#221C1F] tracking-tight">
                Mori<span className="text-[#FF7AAC]">.</span>
              </span>
              <div className="pl-3 border-l border-[#F2E8EC]">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xs font-bold text-[#221C1F] leading-none">Mori Studio Official</h1>
                  <span className="bg-[#FFF0F6] text-[#FF7AAC] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#FFD1E3]">Mori Mall</span>
                </div>
                <span className="text-[11px] text-[#7E7077]">Kênh Người Bán • Mã shop: SHOP-001</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/admin" className="text-xs text-[#7E7077] hover:text-[#221C1F] px-3.5 py-2 rounded-xl border border-[#F2E8EC] flex items-center gap-1.5 bg-white hover:bg-[#FFF0F6] transition-colors font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-[#FF7AAC]" />
              Trang Admin
            </Link>
            <Link href="/" className="btn-matte-primary text-xs !py-2 !px-3.5">
              Xem gian hàng ↗
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 mt-8 space-y-6">
        {/* METRIC STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="matte-card p-5">
            <div className="flex items-center justify-between text-xs text-[#7E7077]">
              <span>Doanh thu tháng</span>
              <BarChart3 className="w-4 h-4 text-[#FF7AAC]" />
            </div>
            <div className="text-xl font-bold text-[#221C1F] mt-2">12.850.000₫</div>
            <p className="text-[11px] text-[#059669] font-medium mt-1">↑ +18% so với tháng trước</p>
          </div>

          <div className="matte-card p-5">
            <div className="flex items-center justify-between text-xs text-[#7E7077]">
              <span>Đơn chờ xử lý</span>
              <Clock className="w-4 h-4 text-[#FF7AAC]" />
            </div>
            <div className="text-xl font-bold text-[#FF7AAC] mt-2">
              {orders.filter(o => o.status === "PENDING_CONFIRMATION").length} đơn
            </div>
            <p className="text-[11px] text-[#7E7077] mt-1">Cần chuẩn bị đóng gói sớm</p>
          </div>

          <div className="matte-card p-5">
            <div className="flex items-center justify-between text-xs text-[#7E7077]">
              <span>Đang vận chuyển</span>
              <Truck className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold text-[#221C1F] mt-2">
              {orders.filter(o => o.status === "SHIPPING").length} đơn
            </div>
            <p className="text-[11px] text-[#7E7077] mt-1">Bàn giao đơn vị giao hàng</p>
          </div>

          <div className="matte-card p-5">
            <div className="flex items-center justify-between text-xs text-[#7E7077]">
              <span>Cảnh báo tồn kho</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold text-rose-600 mt-2">
              {products.filter(p => p.stock <= 5).length} SKU
            </div>
            <p className="text-[11px] text-rose-500 mt-1">Tồn kho nhỏ hơn ngưỡng an toàn</p>
          </div>
        </div>

        {/* TABS SELECTOR */}
        <div className="flex items-center gap-3 border-b border-[#F2E8EC] pb-2">
          <button
            onClick={() => setActiveTab("orders")}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "orders"
                ? "border-[#FF7AAC] text-[#FF7AAC]"
                : "border-transparent text-[#7E7077] hover:text-[#221C1F]"
            }`}
          >
            Quản lý đơn hàng ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "products"
                ? "border-[#FF7AAC] text-[#FF7AAC]"
                : "border-transparent text-[#7E7077] hover:text-[#221C1F]"
            }`}
          >
            Sản phẩm & Tồn kho ({products.length})
          </button>
          <button
            onClick={() => setActiveTab("vouchers")}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "vouchers"
                ? "border-[#FF7AAC] text-[#FF7AAC]"
                : "border-transparent text-[#7E7077] hover:text-[#221C1F]"
            }`}
          >
            Voucher của Shop ({shopVouchers.length})
          </button>
        </div>

        {/* TAB 1: ORDERS MANAGEMENT (ĐỒNG BỘ SIZE & STYLE CHO TOÀN BỘ BUTTON ACTION) */}
        {activeTab === "orders" && (
          <div className="matte-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
              <div>
                <h3 className="text-sm font-bold text-[#221C1F]">Danh sách đơn bán của Shop</h3>
                <p className="text-xs text-[#7E7077]">Thực hiện xác nhận, đóng gói và chuyển trạng thái theo quy trình</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#221C1F]">
                <thead className="bg-[#FAF6F8] text-[#7E7077] uppercase tracking-wider text-[10px] border-y border-[#F2E8EC]">
                  <tr>
                    <th className="py-3 px-4">Mã đơn & Thời gian</th>
                    <th className="py-3 px-4">Người mua & Địa chỉ</th>
                    <th className="py-3 px-4">Sản phẩm & Biến thể</th>
                    <th className="py-3 px-4">Tổng tiền</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác xử lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2E8EC]">
                  {orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-[#FAF6F8] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#221C1F]">
                        {ord.id}
                        <div className="text-[10px] font-normal text-[#7E7077] font-sans">{ord.createdAt}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#221C1F]">{ord.buyerName}</div>
                        <div className="text-[11px] text-[#7E7077] truncate max-w-[180px]">{ord.address}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#221C1F]">{ord.productName}</div>
                        <div className="text-[10px] text-[#7E7077]">Phân loại: {ord.variant} • SL: {ord.qty}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#221C1F]">
                        {fmtPrice(ord.total)}
                      </td>
                      <td className="py-3.5 px-4">
                        {ord.status === "PENDING_CONFIRMATION" && (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">Chờ xác nhận</span>
                        )}
                        {ord.status === "CONFIRMED" && (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">Đã xác nhận</span>
                        )}
                        {ord.status === "PREPARING" && (
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">Đang chuẩn bị</span>
                        )}
                        {ord.status === "SHIPPING" && (
                          <span className="bg-[#FFF0F6] text-[#FF7AAC] border border-[#FFD1E3] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">Đang giao hàng</span>
                        )}
                        {ord.status === "COMPLETED" && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">Hoàn thành</span>
                        )}
                        {ord.status === "CANCELLED" && (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">Đã hủy</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {ord.status === "PENDING_CONFIRMATION" && (
                            <>
                              <button
                                onClick={() => advanceOrderStatus(ord.id)}
                                className="btn-action-primary"
                              >
                                Xác nhận đơn
                              </button>
                              <button
                                onClick={() => cancelOrder(ord.id)}
                                className="btn-action-danger"
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {ord.status === "CONFIRMED" && (
                            <button
                              onClick={() => advanceOrderStatus(ord.id)}
                              className="btn-action-primary"
                            >
                              Chuẩn bị hàng
                            </button>
                          )}
                          {ord.status === "PREPARING" && (
                            <button
                              onClick={() => advanceOrderStatus(ord.id)}
                              className="btn-action-secondary"
                            >
                              Bàn giao vận chuyển
                            </button>
                          )}
                          {ord.status === "SHIPPING" && (
                            <button
                              onClick={() => advanceOrderStatus(ord.id)}
                              className="btn-action-success"
                            >
                              Giao thành công
                            </button>
                          )}
                          {ord.status === "COMPLETED" && (
                            <span className="text-[11px] font-medium text-[#7E7077]">Đã ghi nhận DT</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCTS & STOCK MANAGEMENT */}
        {activeTab === "products" && (
          <div className="matte-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-2">
              <div>
                <h3 className="text-sm font-bold text-[#221C1F]">Quản lý biến thể & Tồn kho</h3>
                <p className="text-xs text-[#7E7077]">Đảm bảo tồn kho cập nhật và không âm</p>
              </div>
              <Link
                href="/seller/products/new"
                className="btn-matte-primary text-xs !py-2 !px-3.5 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm sản phẩm mới
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#221C1F]">
                <thead className="bg-[#FAF6F8] text-[#7E7077] uppercase tracking-wider text-[10px] border-y border-[#F2E8EC]">
                  <tr>
                    <th className="py-3 px-4">Sản phẩm</th>
                    <th className="py-3 px-4">Mã SKU</th>
                    <th className="py-3 px-4">Đơn giá</th>
                    <th className="py-3 px-4">Tồn kho</th>
                    <th className="py-3 px-4">Đã bán</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Điều chỉnh kho</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2E8EC]">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-[#FAF6F8] transition-colors">
                      <td className="py-3 px-4 flex items-center gap-3">
                        <img src={p.image} className="w-10 h-10 rounded-xl object-cover bg-[#FAF6F8]" />
                        <span className="font-semibold text-[#221C1F]">{p.name}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-[#7E7077]">{p.sku}</td>
                      <td className="py-3 px-4 font-bold text-[#221C1F]">{fmtPrice(p.price)}</td>
                      <td className="py-3 px-4">
                        {p.stock === 0 ? (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 font-semibold px-2 py-0.5 rounded text-[11px]">Hết hàng</span>
                        ) : p.stock <= 5 ? (
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 font-semibold px-2 py-0.5 rounded text-[11px]">{p.stock} (Sắp hết)</span>
                        ) : (
                          <span className="font-semibold text-[#221C1F]">{p.stock}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#7E7077]">{p.sold}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-600"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            const newStock = prompt('Cập nhật tồn kho cho ' + p.sku + ':', p.stock.toString());
                            if (newStock !== null && !isNaN(parseInt(newStock))) {
                              setProducts(prev => prev.map(x => x.id === p.id ? { ...x, stock: Math.max(0, parseInt(newStock)) } : x));
                            }
                          }}
                          className="btn-action-secondary"
                        >
                          Cập nhật tồn
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: VOUCHERS */}
        {activeTab === "vouchers" && (
          <div className="matte-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-2">
              <div>
                <h3 className="text-sm font-bold text-[#221C1F]">Voucher khuyến mãi riêng của Shop</h3>
                <p className="text-xs text-[#7E7077]">Chỉ áp dụng cho các sản phẩm thuộc Mori Studio</p>
              </div>
              <button
                onClick={() => alert("Tạo voucher mới cho gian hàng")}
                className="btn-matte-primary text-xs !py-2 !px-3.5 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tạo Voucher Shop
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {shopVouchers.map((v) => (
                <div key={v.code} className="border border-dashed border-[#FFD1E3] rounded-2xl p-4 flex items-center justify-between bg-[#FAF6F8]">
                  <div>
                    <span className="text-[10px] font-mono font-semibold bg-[#FFF0F6] text-[#FF7AAC] border border-[#FFD1E3] px-2 py-0.5 rounded-full">{v.code}</span>
                    <div className="text-base font-bold text-[#221C1F] mt-1">Giảm {v.value}</div>
                    <p className="text-xs text-[#7E7077]">Đơn tối thiểu: {v.min}</p>
                    <div className="text-[11px] text-[#7E7077] mt-2">Đã dùng: {v.used}</div>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">{v.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
