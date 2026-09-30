"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  UploadCloud, 
  Plus, 
  Trash2, 
} from "lucide-react";

interface Variant {
  id: string;
  name: string;
  price: number;
  stock: number;
  sku: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("Thời trang Linen");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("289000");

  const [variants, setVariants] = useState<Variant[]>([
    { id: "v1", name: "Trắng Kem / Size M", price: 289000, stock: 20, sku: "MORI-WH-M" },
    { id: "v2", name: "Trắng Kem / Size L", price: 289000, stock: 15, sku: "MORI-WH-L" },
    { id: "v3", name: "Be Cát / Size M", price: 289000, stock: 25, sku: "MORI-BE-M" },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const addVariant = () => {
    const newId = `v-${Date.now()}`;
    setVariants(prev => [
      ...prev,
      { id: newId, name: "Phân loại mới", price: Number(basePrice) || 0, stock: 10, sku: `SKU-${Date.now().toString().slice(-4)}` }
    ]);
  };

  const removeVariant = (id: string) => {
    setVariants(prev => prev.filter(v => v.id !== id));
  };

  const updateVariant = <K extends keyof Variant,>(id: string, field: K, value: Variant[K]) => {
    setVariants(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      router.push("/seller");
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#FBF8F9] pb-24 text-[#221C1F]">
      {/* Header */}
      <header className="bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#F2E8EC] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/seller" className="p-2 rounded-xl text-[#7E7077] hover:bg-[#FFF0F6] hover:text-[#FF7AAC] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="text-xl font-bold tracking-tight text-[#221C1F] mr-2">
              Mori<span className="text-[#FF7AAC]">.</span>
            </Link>
            <h1 className="text-xs font-semibold text-[#7E7077] pl-3 border-l border-[#F2E8EC]">
              Đăng bán sản phẩm mới
            </h1>
          </div>
          <span className="text-xs font-semibold text-[#7E7077]">Kênh người bán Mori Studio</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Thông tin cơ bản */}
          <div className="matte-card p-6 sm:p-8 space-y-4">
            <h2 className="text-xs font-bold text-[#221C1F] uppercase tracking-wider border-b border-[#F2E8EC] pb-2.5">
              1. Thông tin chung sản phẩm
            </h2>

            <div>
              <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1.5">Tên sản phẩm *</label>
              <input
                type="text"
                required
                value={productName}
                onChange={e => setProductName(e.target.value)}
                placeholder="VD: Áo sơ mi Linen dáng suông sợi tự nhiên..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] font-semibold bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1.5">Ngành hàng / Danh mục *</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
                >
                  <option value="Thời trang Linen">Thời trang Linen</option>
                  <option value="Gốm sứ thủ công">Gốm sứ thủ công</option>
                  <option value="Đồ gia dụng tối giản">Đồ gia dụng tối giản</option>
                  <option value="Phụ kiện & Trang trí">Phụ kiện & Trang trí</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1.5">Giá bán cơ bản (VNĐ) *</label>
                <input
                  type="number"
                  required
                  value={basePrice}
                  onChange={e => setBasePrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] font-semibold bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1.5">Mô tả sản phẩm</label>
              <textarea
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Mô tả chất liệu, nguồn gốc xuất xứ, bảng kích thước..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
              />
            </div>

            {/* Upload ảnh */}
            <div>
              <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-2">Hình ảnh sản phẩm (Tối đa 5 ảnh)</label>
              <div className="border-2 border-dashed border-[#F2E8EC] rounded-2xl p-8 text-center hover:border-[#FF7AAC] transition-colors bg-[#FAF6F8] cursor-pointer">
                <UploadCloud className="w-8 h-8 text-[#FF7AAC] mx-auto mb-2" />
                <p className="text-xs font-semibold text-[#221C1F]">Nhấp để tải ảnh lên hoặc kéo thả ảnh vào đây</p>
                <p className="text-[11px] text-[#7E7077] mt-1">PNG, JPG tỷ lệ 1:1, dung lượng dưới 2MB</p>
              </div>
            </div>
          </div>

          {/* Cấu hình phân loại biến thể & SKU */}
          <div className="matte-card p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-[#F2E8EC] pb-2.5">
              <div>
                <h2 className="text-xs font-bold text-[#221C1F] uppercase tracking-wider">
                  2. Phân loại biến thể & Tồn kho SKU
                </h2>
                <p className="text-xs text-[#7E7077]">Thiết lập giá và số lượng kho cho từng màu sắc/kích thước</p>
              </div>
              <button
                type="button"
                onClick={addVariant}
                className="btn-matte-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Thêm biến thể
              </button>
            </div>

            <div className="space-y-3">
              {variants.map((v) => (
                <div key={v.id} className="p-4 rounded-xl bg-[#FAF6F8] border border-[#F2E8EC] grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#7E7077] uppercase tracking-wider mb-1">Tên biến thể</label>
                    <input
                      type="text"
                      value={v.name}
                      onChange={e => updateVariant(v.id, "name", e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#F2E8EC] text-xs text-[#221C1F] font-semibold bg-white outline-hidden focus:border-[#FF7AAC]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[#7E7077] uppercase tracking-wider mb-1">Mã SKU</label>
                    <input
                      type="text"
                      value={v.sku}
                      onChange={e => updateVariant(v.id, "sku", e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#F2E8EC] text-xs text-[#221C1F] bg-white outline-hidden focus:border-[#FF7AAC]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[#7E7077] uppercase tracking-wider mb-1">Giá bán (₫)</label>
                    <input
                      type="number"
                      value={v.price}
                      onChange={e => updateVariant(v.id, "price", Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#F2E8EC] text-xs text-[#FF7AAC] font-bold bg-white outline-hidden focus:border-[#FF7AAC]"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-[#7E7077] uppercase tracking-wider mb-1">Kho tồn</label>
                      <input
                        type="number"
                        value={v.stock}
                        onChange={e => updateVariant(v.id, "stock", Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#F2E8EC] text-xs text-[#221C1F] font-semibold bg-white outline-hidden focus:border-[#FF7AAC]"
                      />
                    </div>
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(v.id)}
                        className="p-2 text-[#7E7077] hover:text-[#DC2626] rounded-lg mt-4 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/seller"
              className="btn-matte-secondary px-5 py-2.5 rounded-xl text-xs font-semibold"
            >
              Hủy bỏ
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-matte-primary px-7 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              {isSubmitting ? "Đang lưu..." : "Đăng bán sản phẩm"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
