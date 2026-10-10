"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  ShoppingBag,
  Heart,
  Share2,
  Check,
  Plus,
  Minus,
  Store,
  MessageCircle,
  ThumbsUp,
  ChevronRight,
  Sparkles,
  Zap,
  Clock,
  Eye,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id || "1";

  const [selectedColor, setSelectedColor] = useState("Hồng Pastel");
  const [selectedSize, setSelectedSize] = useState("M");
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(246);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"desc" | "specs" | "reviews">("desc");
  const [liveViewers, setLiveViewers] = useState(38);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setScrolledPastHero(true);
      } else {
        setScrolledPastHero(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleToggleLike = () => {
    setIsLiked((prev) => !prev);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
    triggerToast(isLiked ? "Đã bỏ yêu thích sản phẩm" : "❤️ Đã lưu vào danh sách yêu thích");
  };

  const product = {
    id: productId,
    name: "Áo sơ mi Linen dáng suông Minimalist Mori",
    code: `SP-MORI-${productId.toString().padStart(4, "0")}`,
    shop: {
      name: "Mori Studio Official",
      verified: true,
      rating: 4.9,
      productsCount: 142,
      responseRate: "99%",
      joinedTime: "2 năm trước",
      followers: "48.2k",
    },
    rating: 4.9,
    reviewsCount: 142,
    soldCount: "1.4k",
    basePrice: 289000,
    originalPrice: 360000,
    discount: "-20%",
    colors: [
      { name: "Hồng Pastel", hex: "#FF7AAC", inStock: 48 },
      { name: "Trắng Kem", hex: "#FAF6F8", inStock: 35 },
      { name: "Be Cát", hex: "#EADCC9", inStock: 20 },
      { name: "Đen Mộc", hex: "#2A2729", inStock: 15 },
    ],
    sizes: [
      { name: "S", desc: "42 - 48kg", inStock: 25 },
      { name: "M", desc: "49 - 55kg", inStock: 48 },
      { name: "L", desc: "56 - 62kg", inStock: 30 },
      { name: "XL", desc: "63 - 70kg", inStock: 15 },
    ],
    images: [
      "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800&q=85",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=85",
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=85",
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&q=85",
    ],
    description: `Thiết kế áo sơ mi dáng suông phóng khoáng theo tinh thần Mori Minimalist. 
Được dệt từ sợi linen tự nhiên 100% tuyển chọn kỹ lưỡng, mang lại cảm giác thoáng mát tối đa trong ngày hè và êm dịu trên làn da nhạy cảm.

• Chất liệu: 100% French Linen hữu cơ mềm mịn, đã qua xử lý chống co rút sợi
• Phom dáng: Relaxed Fit tôn dáng tự nhiên, giấu khuyết điểm vòng 2 hoàn hảo
• Đường may: Mũi chỉ kép dày dặn tỉ mỉ theo tiêu chuẩn xuất khẩu Nhật Bản
• Nút áo: Nút xà cừ tự nhiên khắc chìm biểu tượng thương hiệu Mori
• Hướng dẫn giặt: Giặt tay hoặc giặt máy chế độ nhẹ với túi giặt, không dùng chất tẩy mạnh.`,
    specs: [
      { label: "Xuất xứ", value: "Việt Nam (Gia công theo tiêu chuẩn Nhật)" },
      { label: "Chất liệu", value: "100% French Organic Linen" },
      { label: "Kiểu cổ áo", value: "Cổ đức thanh lịch gập mở tự nhiên" },
      { label: "Chiều dài tay", value: "Tay lỡ suông nhẹ có cúc cài" },
      { label: "Mùa phù hợp", value: "Mùa Xuân, Mùa Hè, Mùa Thu" },
    ],
    reviews: [
      {
        id: 1,
        author: "Ngọc Mai",
        verified: true,
        rating: 5,
        variant: "Hồng Pastel / Size M",
        date: "20/09/2026",
        comment: "Màu hồng xinh xỉu luôn mn ơi! Vải linen dày dặn nhưng mặc rất mát, đường may sắc sảo đúng chuẩn Mori. Shop giao hàng siêu nhanh đóng hộp nơ xinh xắn nữa.",
        likes: 18,
      },
      {
        id: 2,
        author: "Khánh Linh",
        verified: true,
        rating: 5,
        variant: "Trắng Kem / Size S",
        date: "18/09/2026",
        comment: "Áo form đẹp, vải không hề bị ráp ngứa như mấy loại linen pha trên thị trường. Sẽ tiếp tục ủng hộ Mori!",
        likes: 12,
      },
    ],
  };

  const fmtPrice = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(amount) + "₫";
  };

  const handleAddToCart = () => {
    triggerToast(`Đã thêm ${quantity}x "${product.name}" (${selectedColor}, ${selectedSize}) vào giỏ hàng`);
  };

  const handleBuyNow = () => {
    router.push("/checkout");
  };

  return (
    <div className="min-h-screen bg-[#FBF8F9] pb-32 text-[#221C1F] selection:bg-[#FFF0F6] selection:text-[#FF7AAC]">
      {/* Ambient Glow */}
      <div className="ambient-matte-pink -top-20 -left-20 pointer-events-none" />

      {/* Floating Toast */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#221C1F]/95 text-white px-6 py-3 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-3 border border-white/20 animate-bounce">
          <Sparkles className="w-4 h-4 text-[#FF7AAC]" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Navigation Header */}
      <header className="matte-glass sticky top-0 z-30 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2.5 rounded-2xl text-[#82757B] hover:bg-[#FFF0F6] hover:text-[#FF7AAC] transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2 text-xs text-[#82757B] font-medium hidden sm:flex">
              <Link href="/" className="hover:text-[#FF7AAC] transition-colors">Trang chủ</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link href="/?category=fashion" className="hover:text-[#FF7AAC] transition-colors">Thời trang Nữ</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[#221C1F] font-bold line-clamp-1 max-w-[200px]">{product.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleLike}
              className={`p-2.5 rounded-2xl border transition-all flex items-center gap-1.5 text-xs font-bold ${
                isLiked
                  ? "bg-[#FFF0F6] border-[#FFD1E3] text-[#FF7AAC]"
                  : "bg-white border-[#F0E6EA] text-[#82757B] hover:border-[#FFD1E3]"
              }`}
            >
              <Heart className={`w-4 h-4 ${isLiked ? "fill-[#FF7AAC]" : ""}`} />
              <span className="tabular-nums">{likeCount}</span>
            </button>
            <Link
              href="/cart"
              className="p-2.5 rounded-2xl bg-[#FFF0F6] text-[#FF7AAC] border border-[#FFD1E3] hover:bg-[#FF7AAC] hover:text-white transition-all relative"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-[#FF7AAC] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                2
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* CỘT TRÁI: GALLERY ẢNH */}
          <div className="lg:col-span-5 space-y-4">
            <div className="matte-card p-3 bg-white">
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[#FAF6F8]">
                <Image
                  src={product.images[selectedImageIdx]}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-500 hover:scale-105"
                  priority
                />
                <span className="absolute top-4 left-4 bg-[#FF7AAC] text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Mori Mall
                </span>
                <span className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Eye className="w-3 h-3 text-[#FFD1E3]" /> {liveViewers} đang xem
                </span>
              </div>
            </div>

            {/* Thumbnails */}
            <div className="grid grid-cols-4 gap-3">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                    selectedImageIdx === idx
                      ? "border-[#FF7AAC] ring-2 ring-[#FFF0F6]"
                      : "border-[#F0E6EA] opacity-75 hover:opacity-100"
                  }`}
                >
                  <Image src={img} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>

            {/* Cam kết sàn TMĐT */}
            <div className="matte-card p-5 grid grid-cols-3 gap-3 text-center bg-white">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF0F6] text-[#FF7AAC] flex items-center justify-center mb-1.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-[#221C1F]">100% Chính hãng</span>
                <span className="text-[10px] text-[#82757B]">Bồi hoàn 200%</span>
              </div>
              <div className="flex flex-col items-center border-x border-[#F0E6EA]">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF0F6] text-[#FF7AAC] flex items-center justify-center mb-1.5">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-[#221C1F]">Đổi trả 15 ngày</span>
                <span className="text-[10px] text-[#82757B]">Miễn phí ship đổi</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF0F6] text-[#FF7AAC] flex items-center justify-center mb-1.5">
                  <Truck className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-[#221C1F]">Freeship Xtra</span>
                <span className="text-[10px] text-[#82757B]">Giao 2H nội thành</span>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: THÔNG TIN & MUA HÀNG */}
          <div className="lg:col-span-7 space-y-6">
            <div className="matte-card p-6 md:p-8 bg-white space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-bold text-[#D4437D] bg-[#FFF0F6] px-3 py-1 rounded-full border border-[#FFD1E3] flex items-center gap-1">
                    <Zap className="w-3 h-3 text-[#FF7AAC] fill-[#FF7AAC]" /> Bán chạy nhất tuần
                  </span>
                  <span className="text-xs text-[#82757B]">Mã: {product.code}</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-[#221C1F] leading-tight">
                  {product.name}
                </h1>
              </div>

              {/* Đánh giá */}
              <div className="flex items-center gap-4 text-xs pb-4 border-b border-[#F0E6EA]">
                <div className="flex items-center gap-1.5 text-[#F59E0B] font-bold">
                  <Star className="w-4 h-4 fill-[#F59E0B]" />
                  <span className="text-sm underline">{product.rating}</span>
                </div>
                <div className="h-4 w-px bg-[#F0E6EA]" />
                <span className="text-[#82757B]">
                  <strong className="text-[#221C1F]">{product.reviewsCount}</strong> Đánh giá
                </span>
                <div className="h-4 w-px bg-[#F0E6EA]" />
                <span className="text-[#82757B]">
                  <strong className="text-[#221C1F]">{product.soldCount}</strong> Đã bán
                </span>
              </div>

              {/* Khối Giá */}
              <div className="p-5 rounded-2xl bg-[#FFF0F6] border border-[#FFD1E3] flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl md:text-4xl font-black text-[#FF7AAC] tracking-tight tabular-nums">
                      {fmtPrice(product.basePrice)}
                    </span>
                    <span className="text-sm text-[#82757B] line-through tabular-nums">
                      {fmtPrice(product.originalPrice)}
                    </span>
                    <span className="bg-[#FF7AAC] text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                      {product.discount}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#D4437D] font-bold mt-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#FF7AAC]" /> Giá tốt nhất trong 30 ngày qua
                  </p>
                </div>
              </div>

              {/* Chọn Màu Sắc */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#221C1F]">Màu sắc: <span className="text-[#FF7AAC]">{selectedColor}</span></span>
                  <span className="text-[#82757B]">4 màu có sẵn</span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {product.colors.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setSelectedColor(c.name)}
                      className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all ${
                        selectedColor === c.name
                          ? "bg-[#FFF0F6] border-[#FF7AAC] text-[#FF7AAC] ring-2 ring-[#FFD1E3]"
                          : "bg-white border-[#F0E6EA] text-[#221C1F] hover:border-[#FFD1E3]"
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/10"
                        style={{ backgroundColor: c.hex }}
                      />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chọn Kích Cỡ */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#221C1F]">Kích thước: <span className="text-[#FF7AAC]">Size {selectedSize}</span></span>
                </div>
                <div className="grid grid-cols-4 gap-2.5">
                  {product.sizes.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => setSelectedSize(s.name)}
                      className={`py-3 px-2 rounded-2xl border text-center transition-all ${
                        selectedSize === s.name
                          ? "bg-[#FF7AAC] border-[#FF7AAC] text-white shadow-xs"
                          : "bg-white border-[#F0E6EA] text-[#221C1F] hover:border-[#FFD1E3]"
                      }`}
                    >
                      <div className="text-sm font-bold">{s.name}</div>
                      <div className={`text-[10px] ${selectedSize === s.name ? "text-white/80" : "text-[#82757B]"}`}>
                        {s.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chọn Số Lượng */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-[#221C1F]">Số lượng:</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-[#F0E6EA] rounded-2xl bg-white p-1">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-[#82757B] hover:bg-[#FFF0F6] hover:text-[#FF7AAC]"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center text-sm font-bold tabular-nums text-[#221C1F]">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-[#82757B] hover:bg-[#FFF0F6] hover:text-[#FF7AAC]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-[#82757B]">48 sản phẩm có sẵn</span>
                </div>
              </div>

              {/* Nhóm Nút Bấm */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#F0E6EA]">
                <button
                  onClick={handleAddToCart}
                  className="btn-matte-secondary py-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Thêm vào giỏ
                </button>
                <button
                  onClick={handleBuyNow}
                  className="btn-matte-primary py-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  Mua ngay
                </button>
              </div>
            </div>

            {/* Thông Tin Shop */}
            <div className="matte-card p-6 bg-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-[#F0E6EA]">
                  <Image src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100" alt="" fill className="object-cover" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-[#221C1F]">{product.shop.name}</h3>
                    <CheckCircle2 className="w-4 h-4 text-[#FF7AAC] fill-[#FFF0F6]" />
                  </div>
                  <p className="text-xs text-[#82757B] mt-0.5">
                    ⭐ {product.shop.rating} | {product.shop.followers} Người theo dõi
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/seller"
                  className="px-4 py-2 rounded-xl bg-white border border-[#FFD1E3] text-[#FF7AAC] text-xs font-bold hover:bg-[#FFF0F6]"
                >
                  Xem Shop
                </Link>
                <button
                  onClick={() => triggerToast("Đang kết nối tin nhắn trực tiếp với Mori Studio...")}
                  className="p-2 rounded-xl bg-[#FFF0F6] text-[#FF7AAC] hover:bg-[#FF7AAC] hover:text-white transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Chi Tiết */}
        <div className="mt-12 matte-card bg-white p-6 md:p-10 space-y-6">
          <div className="flex items-center gap-6 border-b border-[#F0E6EA] pb-4">
            <button
              onClick={() => setActiveTab("desc")}
              className={`text-sm font-bold pb-2 border-b-2 transition-all ${
                activeTab === "desc"
                  ? "border-[#FF7AAC] text-[#FF7AAC]"
                  : "border-transparent text-[#82757B] hover:text-[#221C1F]"
              }`}
            >
              Mô tả chi tiết
            </button>
            <button
              onClick={() => setActiveTab("specs")}
              className={`text-sm font-bold pb-2 border-b-2 transition-all ${
                activeTab === "specs"
                  ? "border-[#FF7AAC] text-[#FF7AAC]"
                  : "border-transparent text-[#82757B] hover:text-[#221C1F]"
              }`}
            >
              Thông số kỹ thuật
            </button>
            <button
              onClick={() => setActiveTab("reviews")}
              className={`text-sm font-bold pb-2 border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "reviews"
                  ? "border-[#FF7AAC] text-[#FF7AAC]"
                  : "border-transparent text-[#82757B] hover:text-[#221C1F]"
              }`}
            >
              Đánh giá từ khách hàng ({product.reviews.length})
            </button>
          </div>

          {/* Nội dung Tab */}
          {activeTab === "desc" && (
            <div className="text-sm text-[#475569] leading-relaxed whitespace-pre-line space-y-4">
              {product.description}
            </div>
          )}

          {activeTab === "specs" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {product.specs.map((item, i) => (
                <div key={i} className="flex justify-between p-3.5 rounded-2xl bg-[#FAF6F8] border border-[#F0E6EA]">
                  <span className="text-[#82757B] font-medium">{item.label}</span>
                  <span className="text-[#221C1F] font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "reviews" && (
            <div className="space-y-6">
              {product.reviews.map((rev) => (
                <div key={rev.id} className="p-5 rounded-2xl bg-[#FAF6F8] border border-[#F0E6EA] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#FF7AAC] text-white flex items-center justify-center font-bold text-xs">
                        {rev.author.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#221C1F]">{rev.author}</span>
                          {rev.verified && (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">
                              ✓ Đã mua hàng
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[#82757B] mt-0.5">
                          <div className="flex text-[#F59E0B]">
                            {[...Array(rev.rating)].map((_, idx) => (
                              <Star key={idx} className="w-3 h-3 fill-[#F59E0B]" />
                            ))}
                          </div>
                          <span>• {rev.variant}</span>
                          <span>• {rev.date}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[#334155] leading-relaxed">{rev.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Sticky Bottom Bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 matte-glass p-3.5 transition-transform duration-300 ${
          scrolledPastHero ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-[#F0E6EA] hidden sm:block">
              <Image src={product.images[0]} alt="" fill className="object-cover" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#221C1F] line-clamp-1">{product.name}</h4>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-[#FF7AAC] tabular-nums">{fmtPrice(product.basePrice)}</span>
                <span className="text-[10px] text-[#82757B]">| {selectedColor} / {selectedSize}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleAddToCart}
              className="btn-matte-secondary py-2.5 px-5 text-xs font-bold flex items-center gap-1.5"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Thêm vào giỏ</span>
            </button>
            <button
              onClick={handleBuyNow}
              className="btn-matte-primary py-2.5 px-6 text-xs font-bold flex items-center gap-1.5"
            >
              <Zap className="w-4 h-4 fill-white" />
              Mua ngay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
