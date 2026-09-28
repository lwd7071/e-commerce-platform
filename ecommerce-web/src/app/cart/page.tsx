"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Trash2, 
  Plus, 
  Minus, 
  Tag, 
  Store, 
  ShieldCheck, 
  ArrowRight,
  ShoppingBag,
  Sparkles,
  Truck,
  CheckCircle2,
} from "lucide-react";

interface CartItem {
  id: string;
  shopName: string;
  productName: string;
  variant: string;
  price: number;
  quantity: number;
  image: string;
  selected: boolean;
}

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([
    {
      id: "c1",
      shopName: "Mori Studio Official",
      productName: "Áo sơ mi Linen dáng suông Minimalist",
      variant: "Be Cát / Size M",
      price: 289000,
      quantity: 1,
      image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=200",
      selected: true,
    },
    {
      id: "c2",
      shopName: "Mori Studio Official",
      productName: "Quần âu ống suông sợi tự nhiên",
      variant: "Xám Tro / Size 31",
      price: 340000,
      quantity: 1,
      image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=200",
      selected: true,
    },
    {
      id: "c3",
      shopName: "An Yên Ceramic",
      productName: "Đèn gốm Wabi-Sabi thủ công",
      variant: "Men mộc nguyên bản",
      price: 420000,
      quantity: 1,
      image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=200",
      selected: false,
    },
  ]);

  const [voucherCode, setVoucherCode] = useState("SPRING2026");
  const [discount, setDiscount] = useState(50000);
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const toggleSelect = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const selectAll = (checked: boolean) => {
    setItems(prev => prev.map(item => ({ ...item, selected: checked })));
  };

  const updateQty = (id: string, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    showToast("Đã xóa sản phẩm khỏi giỏ hàng");
  };

  const selectedItems = items.filter(i => i.selected);
  const subtotal = selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = Math.max(0, subtotal - (subtotal > 0 ? discount : 0));
  const isAllSelected = items.length > 0 && items.every(i => i.selected);

  const freeShippingThreshold = 500000;
  const freeShippingProgress = Math.min(100, (subtotal / freeShippingThreshold) * 100);

  const fmtPrice = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(amount) + "₫";
  };

  return (
    <div className="min-h-screen bg-[#FBF8F9] pb-28 text-[#221C1F] selection:bg-[#FFF0F6] selection:text-[#FF7AAC]">
      {/* Ambient Glow */}
      <div className="ambient-matte-pink -top-20 -left-20" />

      {/* Floating Toast */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#221C1F]/95 text-white px-6 py-3 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-3 border border-white/20 animate-bounce">
          <Sparkles className="w-4 h-4 text-[#FF7AAC]" />
          <span className="text-sm font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <header className="matte-glass sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2.5 rounded-2xl text-[#82757B] hover:bg-[#FFF0F6] hover:text-[#FF7AAC] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-[#221C1F]">Mori<span className="text-[#FF7AAC]">.</span></span>
              <span className="text-xs font-bold text-[#82757B] pl-3 border-l border-[#F0E6EA]">Giỏ hàng ({items.length})</span>
            </div>
          </div>
          <span className="text-xs font-bold text-[#D4437D] bg-[#FFF0F6] px-3.5 py-1.5 rounded-full border border-[#FFD1E3] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#FF7AAC]" /> Giao dịch bảo mật 100%
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        {/* Freeship Progress Banner */}
        <div className="matte-card p-5 mb-6 bg-white border border-[#FFD1E3]">
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <div className="flex items-center gap-2 text-[#FF7AAC]">
              <Truck className="w-4 h-4" />
              {subtotal >= freeShippingThreshold ? (
                <span className="text-emerald-700">🎉 Chúc mừng! Bạn đã đủ điều kiện được Freeship 100%</span>
              ) : (
                <span>Mua thêm <strong className="tabular-nums font-bold text-[#221C1F]">{fmtPrice(freeShippingThreshold - subtotal)}</strong> để nhận Freeship toàn quốc!</span>
              )}
            </div>
            <span className="text-[#82757B] tabular-nums">{Math.round(freeShippingProgress)}%</span>
          </div>
          <div className="w-full bg-[#FAF6F8] h-2.5 rounded-full overflow-hidden border border-[#F0E6EA] p-0.5">
            <div 
              className="h-full bg-[#FF7AAC] rounded-full transition-all duration-500"
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>

        {items.length === 0 ? (
          <div className="matte-card bg-white p-12 text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-[#FFF0F6] text-[#FF7AAC] flex items-center justify-center mx-auto mb-4 border border-[#FFD1E3]">
              <ShoppingBag className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-[#221C1F] mb-2">Giỏ hàng đang trống</h2>
            <p className="text-xs text-[#82757B] mb-6">Hãy dạo quanh Mori và thêm các sản phẩm yêu thích vào giỏ bạn nhé!</p>
            <Link href="/" className="btn-matte-primary text-xs inline-flex items-center gap-2">
              Khám phá sản phẩm ngay <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Cột Trái: Danh Sách Sản Phẩm */}
            <div className="lg:col-span-8 space-y-4">
              <div className="matte-card p-4 px-6 bg-white flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-[#221C1F]">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => selectAll(e.target.checked)}
                    className="w-4 h-4 accent-[#FF7AAC] rounded cursor-pointer"
                  />
                  <span>Chọn tất cả ({items.length} sản phẩm)</span>
                </label>
                <button
                  onClick={() => {
                    setItems([]);
                    showToast("Đã xóa tất cả sản phẩm");
                  }}
                  className="text-xs text-[#82757B] hover:text-[#FF7AAC] flex items-center gap-1 font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Xóa tất cả
                </button>
              </div>

              {items.map((item) => (
                <div key={item.id} className="matte-card p-5 bg-white space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#221C1F] pb-3 border-b border-[#F0E6EA]">
                    <Store className="w-4 h-4 text-[#FF7AAC]" />
                    <span>{item.shopName}</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold ml-1">Chính hãng</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4 accent-[#FF7AAC] rounded cursor-pointer"
                    />
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-[#F0E6EA] shrink-0 bg-[#FAF6F8]">
                      <Image src={item.image} alt={item.productName} fill className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <h3 className="text-xs font-bold text-[#221C1F] truncate">{item.productName}</h3>
                      <p className="text-[11px] text-[#82757B] bg-[#FFF0F6] px-2 py-0.5 rounded-md inline-block">
                        Phân loại: {item.variant}
                      </p>
                      <div className="text-sm font-black text-[#FF7AAC] tabular-nums">
                        {fmtPrice(item.price)}
                      </div>
                    </div>

                    {/* Stepper Số Lượng */}
                    <div className="flex items-center border border-[#F0E6EA] rounded-xl bg-[#FAF6F8] p-1">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#82757B] hover:bg-white hover:text-[#FF7AAC]"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold tabular-nums">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#82757B] hover:bg-white hover:text-[#FF7AAC]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-[#82757B] hover:text-[#FF7AAC] hover:bg-[#FFF0F6] rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Cột Phải: Tóm Tắt Đơn Hàng */}
            <div className="lg:col-span-4 space-y-4">
              {/* Voucher Box */}
              <div className="matte-card p-5 bg-white space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#221C1F]">
                  <Tag className="w-4 h-4 text-[#FF7AAC]" />
                  <span>Mori Voucher &amp; Ưu đãi</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="Nhập mã voucher..."
                    className="flex-1 bg-[#FAF6F8] border border-[#F0E6EA] rounded-2xl px-3.5 py-2.5 text-xs uppercase font-bold focus:outline-hidden focus:border-[#FF7AAC]"
                  />
                  <button
                    onClick={() => {
                      if (voucherCode.toUpperCase() === "SPRING2026") {
                        setDiscount(50000);
                        showToast("Áp dụng mã SPRING2026 (-50.000₫)");
                      } else {
                        showToast("Mã giảm giá không hợp lệ");
                      }
                    }}
                    className="btn-matte-secondary py-2.5 px-4 text-xs font-bold"
                  >
                    Áp dụng
                  </button>
                </div>
                <p className="text-[11px] text-[#D4437D] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FF7AAC]" /> Đang áp dụng mã giảm 50.000₫
                </p>
              </div>

              {/* Tóm tắt thanh toán */}
              <div className="matte-card p-6 bg-white space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#221C1F] pb-3 border-b border-[#F0E6EA]">
                  Tóm tắt đơn hàng
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between text-[#82757B]">
                    <span>Tạm tính ({selectedItems.length} món):</span>
                    <span className="font-bold text-[#221C1F] tabular-nums">{fmtPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#82757B]">
                    <span>Giảm giá Voucher:</span>
                    <span className="font-bold text-[#FF7AAC] tabular-nums">-{fmtPrice(discount)}</span>
                  </div>
                  <div className="flex justify-between text-[#82757B]">
                    <span>Phí vận chuyển:</span>
                    <span className="font-bold text-[#221C1F] tabular-nums">
                      {subtotal >= freeShippingThreshold ? <span className="text-emerald-600">Miễn phí</span> : "25.000₫"}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-[#F0E6EA] flex justify-between items-baseline">
                    <span className="text-sm font-bold text-[#221C1F]">Tổng thanh toán:</span>
                    <div className="text-right">
                      <div className="text-xl font-black text-[#FF7AAC] tabular-nums">{fmtPrice(total)}</div>
                      <span className="text-[10px] text-[#82757B]">(Đã bao gồm VAT)</span>
                    </div>
                  </div>
                </div>

                <button
                  disabled={selectedItems.length === 0}
                  onClick={() => router.push("/checkout")}
                  className="btn-matte-primary w-full py-4 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Tiến hành thanh toán <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
