"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Star,
  Camera,
  X,
  CheckCircle2,
  Store,
  AlertCircle
} from "lucide-react";

export default function ProductReviewPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id || "DH-2026-002";

  // Số sao
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);

  // Nhận xét chi tiết
  const [comment, setComment] = useState("");

  // Danh sách ảnh tải lên
  const [uploadedImages, setUploadedImages] = useState<string[]>([
    "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=300",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300",
  ]);

  // Đánh giá ẩn danh
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Trạng thái gửi
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const productInfo = {
    orderId: orderId,
    shopName: "Mori Studio Official",
    name: "Áo sơ mi Linen dáng suông Minimalist Mori",
    variant: "Hồng Pastel / Size M",
    price: 289000,
    image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=200",
  };

  const ratingLabels: { [key: number]: string } = {
    1: "Rất tệ - Không hài lòng về sản phẩm",
    2: "Chưa tốt - Sản phẩm dưới kỳ vọng",
    3: "Bình thường - Đúng như mô tả cơ bản",
    4: "Hài lòng - Chất lượng tốt",
    5: "Tuyệt vời - Rất hài lòng, vượt mong đợi",
  };

  const handleAddSampleImage = () => {
    if (uploadedImages.length >= 5) {
      alert("Tối đa 5 hình ảnh cho một đánh giá");
      return;
    }
    setUploadedImages([
      ...uploadedImages,
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=300",
    ]);
  };

  const handleRemoveImage = (idx: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== idx));
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim().length < 10) {
      setErrorMsg("Vui lòng viết nhận xét chi tiết tối thiểu 10 ký tự.");
      return;
    }
    setErrorMsg("");
    setIsSubmitted(true);
    setTimeout(() => {
      router.push("/orders");
    }, 2000);
  };

  const handleCancel = () => {
    router.push("/orders");
  };

  return (
    <div className="min-h-screen bg-[#FBF8F9] text-[#221C1F]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#F2E8EC]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="w-9 h-9 rounded-xl border border-[#F2E8EC] flex items-center justify-center text-[#7E7077] hover:text-[#FF7AAC] hover:border-[#FFD1E3] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-[#221C1F]">Mori<span className="text-[#FF7AAC]">.</span></span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#FF7AAC] bg-[#FFF0F6] px-2.5 py-0.5 rounded-full border border-[#FFD1E3]">
                Đánh giá sản phẩm
              </span>
            </div>
          </div>
          <span className="text-xs text-[#7E7077]">Mã đơn: #{orderId}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-20">
        {isSubmitted ? (
          <div className="matte-card p-10 text-center space-y-4">
            <div className="w-16 h-16 bg-[#FFF0F6] text-[#FF7AAC] rounded-2xl flex items-center justify-center mx-auto border border-[#FFD1E3]">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-[#221C1F]">Gửi đánh giá thành công!</h2>
            <p className="text-xs text-[#7E7077] max-w-md mx-auto">
              Cảm ơn bạn đã đóng góp phản hồi quý báu cho cộng đồng mua sắm Mori. 
              Bạn nhận được <span className="font-bold text-[#FF7AAC]">+100 Mori Xu</span> tích lũy.
            </p>
            <span className="text-[11px] text-[#7E7077] block">Đang quay lại trang đơn hàng...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmitReview} className="space-y-6">
            {/* Thông tin sản phẩm cần đánh giá */}
            <div className="matte-card p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#F2E8EC]">
                <Store className="w-4 h-4 text-[#FF7AAC]" />
                <span className="text-xs font-bold text-[#221C1F]">{productInfo.shopName}</span>
                <span className="text-[10px] text-[#7E7077] ml-auto">Đơn đã hoàn thành</span>
              </div>

              <div className="flex items-center gap-4">
                <img
                  src={productInfo.image}
                  alt={productInfo.name}
                  className="w-16 h-16 rounded-xl object-cover border border-[#F2E8EC] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-[#221C1F] truncate">
                    {productInfo.name}
                  </h3>
                  <p className="text-xs text-[#7E7077] mt-0.5">Phân loại: {productInfo.variant}</p>
                  <span className="text-xs font-bold text-[#FF7AAC] mt-1 block">
                    {productInfo.price.toLocaleString("vi-VN")}₫
                  </span>
                </div>
              </div>
            </div>

            {/* Chấm điểm số sao */}
            <div className="matte-card p-6 text-center space-y-3">
              <span className="text-xs font-semibold text-[#7E7077] uppercase tracking-wider block">
                Chất lượng sản phẩm tổng thể
              </span>

              {/* Dãy sao tương tác */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
                {[1, 2, 3, 4, 5].map(star => {
                  const activeStar = hoverRating || rating;
                  return (
                    <button
                      type="button"
                      key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 sm:p-2 rounded-xl transition-transform hover:scale-110 cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                          star <= activeStar
                            ? "fill-amber-400 text-amber-400"
                            : "fill-transparent text-[#F2E8EC] hover:text-[#FFD1E3]"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Nhãn cảm xúc tương ứng */}
              <div className="text-xs font-semibold text-[#FF7AAC] bg-[#FFF0F6] px-4 py-1.5 rounded-full inline-block border border-[#FFD1E3]">
                {ratingLabels[hoverRating || rating]}
              </div>
            </div>

            {/* Nhận xét chi tiết */}
            <div className="matte-card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#221C1F]">
                  Viết nhận xét chi tiết
                </label>
                <span className="text-[11px] text-[#7E7077]">
                  {comment.length}/500 ký tự
                </span>
              </div>

              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Hãy chia sẻ cảm nhận về chất lượng vải, form dáng, trải nghiệm giặt ủi và thái độ phục vụ của shop..."
                className="w-full text-xs p-3.5 rounded-xl border border-[#F2E8EC] focus:border-[#FF7AAC] focus:ring-1 focus:ring-[#FF7AAC] outline-hidden transition-all resize-none bg-[#FAF6F8]"
              />

              {errorMsg && (
                <div className="flex items-center gap-1.5 text-xs text-rose-500 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Tải lên hình ảnh thực tế */}
            <div className="matte-card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#221C1F] block">
                    Hình ảnh thực tế đính kèm
                  </span>
                  <span className="text-[11px] text-[#7E7077]">
                    Giúp đánh giá của bạn chân thực hơn và nhận thêm xu thưởng
                  </span>
                </div>
                <span className="text-xs text-[#FF7AAC] font-semibold">
                  {uploadedImages.length}/5 ảnh
                </span>
              </div>

              {/* Lưới ảnh preview và nút upload */}
              <div className="flex flex-wrap gap-3 pt-1">
                {uploadedImages.map((img, idx) => (
                  <div key={idx} className="relative w-18 h-18 rounded-xl overflow-hidden border border-[#F2E8EC] group">
                    <img src={img} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {uploadedImages.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddSampleImage}
                    className="w-18 h-18 rounded-xl border-2 border-dashed border-[#FFD1E3] bg-[#FFF0F6]/60 flex flex-col items-center justify-center gap-1 text-[#FF7AAC] hover:bg-[#FFF0F6] transition-colors cursor-pointer"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">Thêm ảnh</span>
                  </button>
                )}
              </div>
            </div>

            {/* Đánh giá ẩn danh */}
            <div className="matte-card p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#221C1F] block">
                  Đánh giá ẩn danh
                </span>
                <span className="text-[11px] text-[#7E7077]">
                  Tên của bạn sẽ hiển thị dạng n***n trên trang chi tiết sản phẩm
                </span>
              </div>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={e => setIsAnonymous(e.target.checked)}
                className="w-4 h-4 text-[#FF7AAC] rounded-md border-[#F2E8EC] focus:ring-[#FF7AAC] cursor-pointer accent-[#FF7AAC]"
              />
            </div>

            {/* Nút bấm Gửi & Hủy */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="btn-matte-secondary py-3 px-4 rounded-xl text-xs font-bold cursor-pointer text-center"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="btn-matte-primary py-3 px-4 rounded-xl text-xs font-bold cursor-pointer text-center"
              >
                Gửi đánh giá
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
