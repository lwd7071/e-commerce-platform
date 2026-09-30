"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { categoryAdapter, type CategoryItem } from "../../lib/adapters/category.adapter";
import { Button } from "../../components/ui/button";
import { TextInput } from "../../components/ui/form-controls";
import { Dialog } from "../../components/ui/dialog";
import { Skeleton, ErrorState } from "../../components/ui/data-states";
import { useToast } from "../../components/ui/toast";

export function AdminCategoriesScreen() {
  const showToast = useToast();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal thêm danh mục
  const [isOpenAddModal, setIsOpenAddModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await categoryAdapter.getCategories();
      setCategories(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Tải danh mục thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    categoryAdapter
      .getCategories()
      .then((data) => {
        if (!ignore) {
          setCategories(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Tải danh mục thất bại");
          setIsLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      showToast("Vui lòng nhập tên danh mục", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // Giả lập thêm danh mục mới vào danh sách
      const newCategory: CategoryItem = {
        id: `cat_${Date.now()}`,
        name: newCatName.trim(),
        parentId: selectedParentId || null,
        status: "ACTIVE",
      };

      setCategories((prev) => [...prev, newCategory]);
      showToast(`Đã tạo danh mục "${newCategory.name}" thành công!`, "success");
      setIsOpenAddModal(false);
      setNewCatName("");
      setSelectedParentId("");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Tạo danh mục thất bại", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const parentCategories = categories.filter((c) => !c.parentId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="eyebrow">Hệ thống quản trị</p>
          <h1 className="page-title">Quản Lý Danh Mục Sản Phẩm</h1>
          <p className="page-description">
            Thiết lập cây danh mục hàng hóa 2 cấp phục vụ việc phân loại và tìm kiếm sản phẩm.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsOpenAddModal(true)}
          className="h-10 px-4 text-xs font-bold"
        >
          + Thêm danh mục mới
        </Button>
      </div>

      {/* Tabs */}
      <nav aria-label="Điều hướng quản trị" className="border-b border-[var(--border)]">
        <div className="flex gap-6 text-sm font-semibold">
          <Link
            href="/admin"
            className="pb-3 border-b-2 border-transparent text-[var(--subtext)] hover:text-[var(--foreground)]"
          >
            Danh sách người dùng
          </Link>
          <Link
            href="/admin/shops"
            className="pb-3 border-b-2 border-transparent text-[var(--subtext)] hover:text-[var(--foreground)]"
          >
            Duyệt gian hàng (Shop)
          </Link>
          <Link
            href="/admin/categories"
            className="pb-3 border-b-2 border-[var(--primary-active)] text-[var(--primary-active)]"
            aria-current="page"
          >
            Quản lý danh mục
          </Link>
        </div>
      </nav>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3 surface-card p-6">
          <Skeleton height={32} className="w-1/4" />
          <Skeleton height={44} className="w-full" />
          <Skeleton height={44} className="w-full" />
        </div>
      ) : error ? (
        <ErrorState
          title="Không thể tải danh mục"
          description={error}
          onRetry={fetchCategories}
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--card-muted)] text-xs font-bold text-[var(--subtext)]">
                  <th className="py-3.5 px-4">Tên danh mục</th>
                  <th className="py-3.5 px-4">Cấp bậc</th>
                  <th className="py-3.5 px-4">Mã định danh (ID)</th>
                  <th className="py-3.5 px-4 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {categories.map((cat) => {
                  const isChild = !!cat.parentId;
                  return (
                    <tr key={cat.id} className="hover:bg-[var(--card-muted)]/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[var(--foreground)]">
                        <div className="flex items-center gap-2">
                          {isChild && <span className="text-[var(--subtext)] ml-4">↳</span>}
                          <span>{cat.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--subtext)]">
                        {isChild ? "Cấp 2 (Danh mục con)" : "Cấp 1 (Danh mục gốc)"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-[var(--subtext)]">
                        {cat.id}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border border-[var(--border)] bg-[var(--success-surface)] text-[var(--success-text)]">
                          Hoạt động
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal thêm danh mục */}
      {isOpenAddModal && (
        <Dialog
          open
          onOpenChange={setIsOpenAddModal}
          title="Thêm danh mục sản phẩm mới"
          description="Tạo danh mục mới để phân loại sản phẩm trên sàn Dino."
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setIsOpenAddModal(false)}>
                Hủy bỏ
              </Button>
              <Button variant="primary" type="button" onClick={handleCreateCategory} disabled={isSubmitting}>
                {isSubmitting ? "Đang tạo..." : "Xác nhận tạo danh mục"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="cat-name" className="block text-xs font-bold text-[var(--foreground)] mb-1">
                Tên danh mục <span className="text-[var(--danger-text)]">*</span>
              </label>
              <TextInput
                id="cat-name"
                placeholder="Ví dụ: Đồ Chơi Thông Minh, Chăm Sóc Da..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="parent-cat" className="block text-xs font-bold text-[var(--foreground)] mb-1">
                Danh mục cha (Tùy chọn)
              </label>
              <select
                id="parent-cat"
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                className="w-full h-11 min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
              >
                <option value="">Không có (Tạo làm danh mục gốc Cấp 1)</option>
                {parentCategories.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
