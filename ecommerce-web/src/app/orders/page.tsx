"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  ArrowLeft, 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Store, 
  Star,
  Search,
  MessageCircle,
  Sparkles
} from "lucide-react";

interface Order {
  id: string;
  shopName: string;
  items: {
    name: string;
    variant: string;
    price: number;
    qty: number;
    image: string;
  }[];
  total: number;
  status: "PENDING_CONFIRMATION" | "PREPARING" | "SHIPPING" | "COMPLETED" | "CANCELLED";
  createdAt: string;
}

export default function BuyerOrdersPage() {
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const [orders] = useState<Order[]>([
    {
      id: "DH-2026-005",
      shopName: "Mori Studio Official",
      items: [
        {
          name: "Áo sơ mi Linen dáng suông Minimalist",
          variant: "Be Cát / Size M",
          price: 289000,
          qty: 1,
          image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=150",
        },
        {
          name: "Quần âu ống suông sợi tự nhiên",
          variant: "Xám Tro / Size 31",
          price: 340000,
          qty: 1,
          image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=150",
        },
      ],
      total: 604000,
      status: "SHIPPING",
      createdAt: "16/09/2026 14:20",
    },
    {
      id: "DH-2026-002",
      shopName: "An Yên Ceramic",
      items: [
        {
          name: "Đèn gốm Wabi-Sabi thủ công",
          variant: "Men mộc nguyên bản",
          price: 420000,
          qty: 1,
          image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=150",
        },
      ],
      total: 420000,
      status: "COMPLETED",
      createdAt: "10/09/2026 09:15",
    },
    {
      id: "DH-2026-001",
      shopName: "Minimal Living",
      items: [
        {
          name: "Bình giữ nhiệt Inox Pastel",
          variant: "Xanh Bạc Hà / 500ml",
          price: 245000,
          qty: 1,
          image: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=150",
        },
      ],
      total: 245000,
      status: "CANCELLED",
      createdAt: "01/09/2026 11:00",
    },
  ]);

  const fmtPrice = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(amount) + "₫";
  };

  const getStatusBadge = (status: Order["status"]) => {
    switch (status) {
      case "PENDING_CONFIRMATION":
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Chờ xác nhận</span>;
      case "PREPARING":
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Đang chuẩn bị</span>;
      case "SHIPPING":
        return <span className="bg-[#FFF0F6] text-[#FF7AAC] border border-[#FFD1E3] px-3 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"><Truck className="w-3.5 h-3.5 text-[#FF7AAC]" /> Đang vận chuyển</span>;
      case "COMPLETED":
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Hoàn thành</span>;
      case "CANCELLED":
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-3 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Đã hủy</span>;
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchFilter = activeFilter === "ALL" || o.status === activeFilter;
    const matchQuery =
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.some((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchFilter && matchQuery;
  });

  return (
    <div className="min-h-screen bg-[#FBF8F9] pb-28 text-[#221C1F]">
      {/* Floating Toast */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#221C1F] text-white px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 border border-white/10 text-xs font-medium">
          <Sparkles className="w-4 h-4 text-[#FF7AAC]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#F2E8EC]">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-xl text-[#7E7077] hover:bg-[#FFF0F6] hover:text-[#FF7AAC] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-[#221C1F]">Mori<span className="text-[#FF7AAC]">.</span></span>
              <h1 className="text-xs font-semibold text-[#7E7077] pl-3 border-l border-[#F2E8EC]">
                Quản lý đơn mua ({orders.length})
              </h1>
            </div>
          </div>
          <Link href="/" className="btn-matte-primary text-xs !py-1.5 !px-3.5">
            Tiếp tục mua sắm
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 relative z-10 space-y-6">
        {/* Search & Tabs */}
        <div className="matte-card p-4 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-[#7E7077] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo mã đơn, tên shop hoặc tên sản phẩm..."
              className="w-full pl-11 pr-4 py-2.5 bg-[#FAF6F8] border border-[#F2E8EC] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#FF7AAC]"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "ALL", label: "Tất cả" },
              { id: "SHIPPING", label: "Đang vận chuyển" },
              { id: "COMPLETED", label: "Hoàn tất" },
              { id: "CANCELLED", label: "Đã hủy" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`h-8 px-4 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeFilter === tab.id
                    ? "bg-[#FF7AAC] text-white shadow-xs"
                    : "bg-[#FAF6F8] text-[#7E7077] hover:text-[#221C1F] hover:bg-[#FFF0F6]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Danh Sách Đơn Hàng */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="matte-card p-12 text-center">
              <Package className="w-10 h-10 text-[#7E7077] mx-auto mb-3" />
              <h3 className="text-sm font-bold text-[#221C1F]">Không tìm thấy đơn hàng phù hợp</h3>
              <p className="text-xs text-[#7E7077] mt-1">Hãy thử tìm kiếm với từ khóa khác hoặc chuyển tab lọc.</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div key={order.id} className="matte-card p-6 space-y-4">
                {/* Header Đơn */}
                <div className="flex items-center justify-between pb-3 border-b border-[#F2E8EC]">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-[#FF7AAC]" />
                    <span className="text-xs font-bold text-[#221C1F]">{order.shopName}</span>
                    <span className="text-[10px] text-[#7E7077]">• {order.createdAt}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-medium text-[#7E7077]">{order.id}</span>
                    {getStatusBadge(order.status)}
                  </div>
                </div>

                {/* Danh Sách Món Trong Đơn */}
                <div className="space-y-3">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3.5">
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-[#F2E8EC] shrink-0 bg-[#FAF6F8]">
                        <Image src={item.image} alt="" fill className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-[#221C1F] truncate">{item.name}</h4>
                        <div className="text-[11px] text-[#7E7077] mt-0.5">Phân loại: {item.variant} x {item.qty}</div>
                        <div className="text-xs font-bold text-[#FF7AAC] tabular-nums mt-1">
                          {fmtPrice(item.price)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timeline Theo Dõi Hành Trình Đơn Hàng nếu đang giao */}
                {order.status === "SHIPPING" && (
                  <div className="p-4 rounded-xl bg-[#FAF6F8] border border-[#FFD1E3] space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#FF7AAC]">
                      <span className="flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-[#FF7AAC]" /> Đang trên đường giao đến bạn
                      </span>
                      <span className="text-[11px] text-[#7E7077]">Cập nhật 15 phút trước</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-semibold text-[#7E7077] pt-2">
                      <div className="text-[#059669]">✓ Đã đặt</div>
                      <div className="text-[#059669]">✓ Đã xác nhận</div>
                      <div className="text-[#FF7AAC]">🚚 Đang giao</div>
                      <div>○ Hoàn tất</div>
                    </div>
                    <div className="w-full bg-white h-1.5 rounded-full overflow-hidden border border-[#F2E8EC]">
                      <div className="bg-[#FF7AAC] h-full w-3/4 rounded-full animate-pulse" />
                    </div>
                  </div>
                )}

                {/* Footer Đơn: Tổng Tiền & Nút Thao Tác Đồng Bộ h-8 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#F2E8EC]">
                  <div className="text-xs">
                    <span className="text-[#7E7077]">Tổng số tiền ({order.items.reduce((s, i) => s + i.qty, 0)} món): </span>
                    <strong className="text-sm font-bold text-[#FF7AAC] tabular-nums">{fmtPrice(order.total)}</strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => showToast(`Đang kết nối với ${order.shopName}...`)}
                      className="btn-action-secondary"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Chat shop
                    </button>
                    {order.status === "COMPLETED" && (
                      <Link
                        href={`/orders/${order.id}/review`}
                        className="btn-action-primary"
                      >
                        <Star className="w-3.5 h-3.5 fill-white" /> Đánh giá
                      </Link>
                    )}
                    <button
                      onClick={() => showToast("Đã thêm toàn bộ sản phẩm vào giỏ hàng để mua lại!")}
                      className="btn-action-secondary !bg-[#FFF0F6] !border-[#FFD1E3] !text-[#FF7AAC] hover:!bg-[#FF7AAC] hover:!text-white"
                    >
                      Mua lại
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
