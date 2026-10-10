"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Layers, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff
} from "lucide-react";

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  status: "ACTIVE" | "HIDDEN";
  createdAt: string;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([
    { id: "CAT-01", name: "Thời trang Linen & Sợi tự nhiên", slug: "thoi-trang-linen", productCount: 42, status: "ACTIVE", createdAt: "10/01/2026" },
    { id: "CAT-02", name: "Gốm sứ Wabi-Sabi thủ công", slug: "gom-su-thu-cong", productCount: 28, status: "ACTIVE", createdAt: "12/01/2026" },
    { id: "CAT-03", name: "Đồ gia dụng & Trang trí tối giản", slug: "do-gia-dung-toi-gian", productCount: 65, status: "ACTIVE", createdAt: "15/01/2026" },
    { id: "CAT-04", name: "Phụ kiện & Bình giữ nhiệt Pastel", slug: "phu-kien-binh-giu-nhiet", productCount: 19, status: "ACTIVE", createdAt: "20/01/2026" },
    { id: "CAT-05", name: "Mỹ phẩm thiên nhiên (Thử nghiệm)", slug: "my-pham-thien-nhien", productCount: 4, status: "HIDDEN", createdAt: "05/02/2026" },
  ]);

  const [newCatName, setNewCatName] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const toggleCategoryStatus = (id: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, status: c.status === "ACTIVE" ? "HIDDEN" : "ACTIVE" } : c));
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const newCat: CategoryItem = {
      id: `CAT-0${categories.length + 1}`,
      name: newCatName,
      slug: newCatName.toLowerCase().replace(/\s+/g, "-"),
      productCount: 0,
      status: "ACTIVE",
      createdAt: new Date().toLocaleDateString("vi-VN"),
    };
    setCategories([...categories, newCat]);
    setNewCatName("");
    setShowAddModal(false);
  };

  const deleteCategory = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa danh mục này?")) {
      setCategories(prev => prev.filter(c => c.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF8F9] pb-24 text-[#221C1F]">
      {/* Header */}
      <header className="bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#F2E8EC] sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 rounded-xl text-[#7E7077] hover:bg-[#FFF0F6] hover:text-[#FF7AAC] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="text-xl font-bold tracking-tight text-[#221C1F] mr-2">
              Mori<span className="text-[#FF7AAC]">.</span>
            </Link>
            <h1 className="text-xs font-semibold text-[#7E7077] pl-3 border-l border-[#F2E8EC]">
              Quản lý danh mục ngành hàng toàn sàn
            </h1>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-matte-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm danh mục
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Modal Thêm danh mục */}
        {showAddModal && (
          <div className="fixed inset-0 bg-[#221C1F]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="matte-card p-6 sm:p-8 max-w-md w-full">
              <h3 className="text-base font-bold text-[#221C1F] mb-1">Thêm danh mục mới</h3>
              <p className="text-xs text-[#7E7077] mb-4">Tạo nhóm ngành hàng hiển thị trên trang chủ Mori</p>
              <form onSubmit={handleAddCategory} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1.5">Tên ngành hàng</label>
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="VD: Trầm hương & Thảo mộc..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] font-semibold bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-matte-secondary px-4 py-2 rounded-xl text-xs font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn-matte-primary px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Lưu danh mục
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Danh sách categories */}
        <div className="matte-card overflow-hidden">
          <div className="p-4 sm:p-5 bg-[#FAF6F8] border-b border-[#F2E8EC] flex items-center justify-between">
            <span className="text-xs font-bold text-[#221C1F] uppercase tracking-wider">
              Tổng số: {categories.length} danh mục ngành hàng
            </span>
          </div>

          <div className="divide-y divide-[#F2E8EC]">
            {categories.map(cat => (
              <div key={cat.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-[#FAF6F8] transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#FFF0F6] text-[#FF7AAC] border border-[#FFD1E3] flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold text-[#221C1F] flex items-center gap-2">
                      {cat.name}
                      {cat.status === "ACTIVE" ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                          Hiển thị
                        </span>
                      ) : (
                        <span className="text-[10px] bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full font-semibold">
                          Đang ẩn
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-[#7E7077] mt-0.5">
                      Slug: <code className="text-[#221C1F] bg-[#FFF0F6] border border-[#FFD1E3] px-1.5 py-0.5 rounded font-mono text-[11px]">{cat.slug}</code> | {cat.productCount} sản phẩm
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCategoryStatus(cat.id)}
                    className="p-2 text-[#7E7077] hover:text-[#221C1F] rounded-xl hover:bg-[#FFF0F6] transition-colors cursor-pointer"
                    title={cat.status === "ACTIVE" ? "Ẩn danh mục" : "Hiện danh mục"}
                  >
                    {cat.status === "ACTIVE" ? <Eye className="w-4 h-4 text-[#059669]" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                  </button>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="p-2 text-[#7E7077] hover:text-[#DC2626] rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                    title="Xóa danh mục"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
