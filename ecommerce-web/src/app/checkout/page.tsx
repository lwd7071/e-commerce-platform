"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  MapPin, 
  CreditCard, 
  Truck, 
  CheckCircle2, 
  ShieldCheck, 
  QrCode,
  Edit2,
  Lock,
  ChevronRight
} from "lucide-react";

export default function CheckoutPage() {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "QR" | "MOMO" | "CARD">("QR");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const orderItems = [
    {
      id: "item-1",
      name: "Áo sơ mi Linen dáng suông Minimalist",
      variant: "Be Cát / Size M",
      price: 289000,
      quantity: 1,
      image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=150",
    },
    {
      id: "item-2",
      name: "Quần âu ống suông sợi tự nhiên",
      variant: "Xám Tro / Size 31",
      price: 340000,
      quantity: 1,
      image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=150",
    },
  ];

  const subtotal = 629000;
  const shippingFee = 25000;
  const discount = 50000;
  const grandTotal = subtotal + shippingFee - discount;

  const fmtPrice = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(amount) + "₫";
  };

  const handlePlaceOrder = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/orders");
      }, 2000);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#FBF8F9] pb-28 text-[#221C1F]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#F2E8EC]">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/cart" className="p-2 rounded-xl text-[#7E7077] hover:bg-[#FFF0F6] hover:text-[#FF7AAC] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/" className="text-xl font-bold tracking-tight text-[#221C1F]">Mori<span className="text-[#FF7AAC]">.</span></Link>
              <h1 className="text-xs font-semibold text-[#7E7077] pl-3 border-l border-[#F2E8EC]">
                Thanh toán an toàn
              </h1>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#FF7AAC] bg-[#FFF0F6] px-3 py-1.5 rounded-full border border-[#FFD1E3] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#FF7AAC]" /> Mã hóa SSL 256-bit
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 relative z-10">
        {/* Stepper Progress Bar */}
        <div className="matte-card p-5 mb-8">
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
            <div className="flex items-center gap-2 justify-center text-[#FF7AAC]">
              <span className="w-6 h-6 rounded-full bg-[#FF7AAC] text-white flex items-center justify-center text-[11px] font-bold">1</span>
              <span>Địa chỉ nhận</span>
            </div>
            <div className="flex items-center gap-2 justify-center text-[#FF7AAC]">
              <span className="w-6 h-6 rounded-full bg-[#FF7AAC] text-white flex items-center justify-center text-[11px] font-bold">2</span>
              <span>Vận chuyển</span>
            </div>
            <div className="flex items-center gap-2 justify-center text-[#FF7AAC]">
              <span className="w-6 h-6 rounded-full bg-[#FF7AAC] text-white flex items-center justify-center text-[11px] font-bold">3</span>
              <span>Thanh toán</span>
            </div>
          </div>
          <div className="w-full bg-[#FFF0F6] h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-[#FF7AAC] h-full w-full rounded-full" />
          </div>
        </div>

        {isSuccess ? (
          <div className="matte-card p-10 md:p-12 text-center max-w-md mx-auto my-8 space-y-4">
            <div className="w-16 h-16 bg-[#FFF0F6] text-[#FF7AAC] rounded-2xl flex items-center justify-center mx-auto border border-[#FFD1E3]">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#FF7AAC] bg-[#FFF0F6] px-3 py-1 rounded-full border border-[#FFD1E3]">
                Giao dịch thành công
              </span>
              <h2 className="text-xl font-bold text-[#221C1F] mt-3">Đặt hàng thành công!</h2>
              <p className="text-xs text-[#7E7077] mt-2">
                Mã đơn hàng: <strong className="text-[#221C1F]">#DH-2026-005</strong>. Cảm ơn bạn đã lựa chọn mua sắm cùng Mori. Đang chuyển tới trang đơn hàng...
              </p>
            </div>
            <div className="w-full bg-[#FFF0F6] h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#FF7AAC] h-full w-full animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Cột Trái: Thông tin giao hàng & Phương thức thanh toán (8 Cột) */}
            <div className="lg:col-span-8 space-y-6">
              {/* 1. Địa chỉ nhận hàng */}
              <div className="matte-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#221C1F]">
                    <MapPin className="w-4 h-4 text-[#FF7AAC]" />
                    <span>Địa chỉ nhận hàng</span>
                  </div>
                  <button className="text-xs text-[#FF7AAC] font-semibold hover:underline flex items-center gap-1">
                    <Edit2 className="w-3.5 h-3.5" /> Thay đổi
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-[#FAF6F8] border border-[#F2E8EC] space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#221C1F]">Lương Viết Vĩ Đông</span>
                    <span className="text-xs text-[#7E7077]">• 0912 345 678</span>
                    <span className="text-[10px] font-semibold text-[#FF7AAC] bg-[#FFF0F6] border border-[#FFD1E3] px-2 py-0.5 rounded-md">Mặc định</span>
                  </div>
                  <p className="text-xs text-[#7E7077]">
                    Tòa nhà S5.03 Vinhome Grand Park, P. Long Thạnh Mỹ, TP. Thủ Đức, TP. Hồ Chí Minh
                  </p>
                </div>
              </div>

              {/* 2. Phương thức vận chuyển */}
              <div className="matte-card p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#221C1F]">
                    <Truck className="w-4 h-4 text-[#FF7AAC]" />
                    <span>Phương thức vận chuyển</span>
                  </div>
                  <span className="text-xs font-semibold text-[#059669] bg-[#ECFDF5] px-2.5 py-0.5 rounded-md border border-[#A7F3D0]">Giao Hàng Nhanh 24H</span>
                </div>
                <div className="p-4 rounded-xl bg-[#FAF6F8] border border-[#F2E8EC] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#221C1F]">Giao hàng hỏa tốc Mori Express</div>
                    <div className="text-[11px] text-[#7E7077]">Dự kiến nhận hàng: Ngày mai, 25/09/2026</div>
                  </div>
                  <span className="text-xs font-bold text-[#221C1F] tabular-nums">25.000₫</span>
                </div>
              </div>

              {/* 3. Phương thức thanh toán */}
              <div className="matte-card p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#221C1F]">
                  <CreditCard className="w-4 h-4 text-[#FF7AAC]" />
                  <span>Chọn phương thức thanh toán</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Quét mã QR */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("QR")}
                    className={`p-4 rounded-2xl border text-left transition-all duration-200 flex items-start gap-3 ${
                      paymentMethod === "QR"
                        ? "bg-[#FFF0F6] border-[#FF7AAC] ring-2 ring-[#FF7AAC]/30"
                        : "bg-white border-[#F2E8EC] hover:border-[#FFD1E3]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#FF7AAC] text-white flex items-center justify-center shrink-0">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#221C1F]">Chuyển khoản VietQR</div>
                      <div className="text-[10px] text-[#7E7077] mt-0.5">Tự động xác nhận trong 3s</div>
                    </div>
                  </button>

                  {/* Thanh toán COD */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("COD")}
                    className={`p-4 rounded-2xl border text-left transition-all duration-200 flex items-start gap-3 ${
                      paymentMethod === "COD"
                        ? "bg-[#FFF0F6] border-[#FF7AAC] ring-2 ring-[#FF7AAC]/30"
                        : "bg-white border-[#F2E8EC] hover:border-[#FFD1E3]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#7E7077] text-white flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#221C1F]">Thanh toán khi nhận (COD)</div>
                      <div className="text-[10px] text-[#7E7077] mt-0.5">Kiểm hàng trước thanh toán</div>
                    </div>
                  </button>

                  {/* Ví MoMo */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("MOMO")}
                    className={`p-4 rounded-2xl border text-left transition-all duration-200 flex items-start gap-3 ${
                      paymentMethod === "MOMO"
                        ? "bg-[#FFF0F6] border-[#FF7AAC] ring-2 ring-[#FF7AAC]/30"
                        : "bg-white border-[#F2E8EC] hover:border-[#FFD1E3]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#A50064] text-white flex items-center justify-center shrink-0 font-bold text-xs">
                      MoMo
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#221C1F]">Ví MoMo</div>
                      <div className="text-[10px] text-[#7E7077] mt-0.5">Hoàn tiền 5% vào ví</div>
                    </div>
                  </button>

                  {/* Thẻ Quốc tế */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CARD")}
                    className={`p-4 rounded-2xl border text-left transition-all duration-200 flex items-start gap-3 ${
                      paymentMethod === "CARD"
                        ? "bg-[#FFF0F6] border-[#FF7AAC] ring-2 ring-[#FF7AAC]/30"
                        : "bg-white border-[#F2E8EC] hover:border-[#FFD1E3]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#3B82F6] text-white flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#221C1F]">Thẻ Visa / Mastercard</div>
                      <div className="text-[10px] text-[#7E7077] mt-0.5">Miễn phí phí quẹt thẻ</div>
                    </div>
                  </button>
                </div>

                {/* Khối xem trước QR code nếu chọn QR */}
                {paymentMethod === "QR" && (
                  <div className="p-4 rounded-xl bg-[#FAF6F8] border border-[#FFD1E3] flex items-center gap-4">
                    <div className="w-14 h-14 bg-white p-1 rounded-xl border border-[#F2E8EC] flex items-center justify-center shrink-0">
                      <QrCode className="w-10 h-10 text-[#221C1F]" />
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-[#221C1F]">Mã VietQR động tự tạo theo đơn</div>
                      <p className="text-[#7E7077]">Mở ứng dụng ngân hàng hoặc ví bất kỳ để quét mã sau khi nhấn Đặt Hàng.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cột Phải: Danh sách món & Xác nhận thanh toán (4 Cột) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="matte-card p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#221C1F] pb-3 border-b border-[#F2E8EC]">
                  Sản phẩm trong đơn ({orderItems.length})
                </h3>

                <div className="space-y-3">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-[#F2E8EC] shrink-0 bg-[#FAF6F8]">
                        <Image src={item.image} alt="" fill className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-[#221C1F] truncate">{item.name}</h4>
                        <div className="text-[10px] text-[#7E7077]">{item.variant} x {item.quantity}</div>
                      </div>
                      <span className="text-xs font-bold text-[#221C1F] tabular-nums">
                        {fmtPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-[#F2E8EC] space-y-2 text-xs">
                  <div className="flex justify-between text-[#7E7077]">
                    <span>Tổng tiền hàng:</span>
                    <span className="font-semibold text-[#221C1F] tabular-nums">{fmtPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#7E7077]">
                    <span>Phí giao hàng:</span>
                    <span className="font-semibold text-[#221C1F] tabular-nums">+{fmtPrice(shippingFee)}</span>
                  </div>
                  <div className="flex justify-between text-[#7E7077]">
                    <span>Mã giảm giá Voucher:</span>
                    <span className="font-semibold text-[#FF7AAC] tabular-nums">-{fmtPrice(discount)}</span>
                  </div>
                  <div className="pt-3 border-t border-[#F2E8EC] flex justify-between items-baseline">
                    <span className="text-sm font-bold text-[#221C1F]">Thực trả:</span>
                    <span className="text-2xl font-bold text-[#FF7AAC] tabular-nums">{fmtPrice(grandTotal)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handlePlaceOrder}
                  className="btn-matte-primary w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang xử lý đơn hàng...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      <span>Đặt hàng ngay ({fmtPrice(grandTotal)})</span>
                    </div>
                  )}
                </button>

                <p className="text-[10px] text-center text-[#7E7077] flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" /> Nhấn &quot;Đặt hàng&quot; đồng nghĩa với việc bạn đồng ý điều khoản Mori
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
