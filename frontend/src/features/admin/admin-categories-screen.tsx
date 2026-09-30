"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField, TextInput, TextArea, SelectInput } from "@/components/ui/form-controls";
import { Skeleton, ErrorState, EmptyState } from "@/components/ui/data-states";
import type { CategoryTreeNode, CategoryItem } from "@/lib/adapters/category.adapter";
import { adminRepository } from "./admin.repository";

export function AdminCategoriesScreen() {
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded tree nodes
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Add Category Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatParentId, setNewCatParentId] = useState<string>("");
  const [newCatDescription, setNewCatDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Category Dialog State
  const [deletingCat, setDeletingCat] = useState<CategoryItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchCategoriesData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [treeData, listData] = await Promise.all([
        adminRepository.getCategoryTree(),
        adminRepository.getCategories(),
      ]);
      setTree(treeData);
      setCategories(listData);

      // Default expand all root nodes
      const expanded: Record<string, boolean> = {};
      treeData.forEach((node) => {
        expanded[node.id] = true;
      });
      setExpandedNodes(expanded);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách danh mục.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    Promise.all([
      adminRepository.getCategoryTree(),
      adminRepository.getCategories(),
    ])
      .then(([treeData, listData]) => {
        if (!ignore) {
          setTree(treeData);
          setCategories(listData);
          const expanded: Record<string, boolean> = {};
          treeData.forEach((node) => {
            expanded[node.id] = true;
          });
          setExpandedNodes(expanded);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Không thể tải danh sách danh mục.");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const toggleNodeExpansion = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const handleToggleStatus = async (cat: CategoryItem) => {
    try {
      const updated = await adminRepository.toggleCategoryStatus(cat.id);
      showToast(`Đã chuyển trạng thái danh mục "${updated.name}" sang ${updated.status}`);
      await fetchCategoriesData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Chuyển trạng thái thất bại.", "error");
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      setFormError("Vui lòng nhập tên ngành hàng / danh mục.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const created = await adminRepository.createCategory({
        name: newCatName.trim(),
        parentId: newCatParentId ? newCatParentId : null,
        description: newCatDescription.trim() || null,
      });

      showToast(`Đã thêm danh mục "${created.name}" thành công!`);
      setShowAddModal(false);
      setNewCatName("");
      setNewCatParentId("");
      setNewCatDescription("");
      await fetchCategoriesData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Thêm danh mục thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCat) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await adminRepository.deleteCategory(deletingCat.id);
      showToast(`Đã xóa danh mục "${deletingCat.name}"`);
      setDeletingCat(null);
      await fetchCategoriesData();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Xóa danh mục thất bại.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Root categories eligible to be parent (strictly max 2 levels per RB-KN04)
  const rootCategories = categories.filter((c) => c.parentId === null);

  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <div className="admin-categories-page space-y-6 pb-24 max-w-5xl mx-auto">
        {/* Toast Alert */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 ${
              toast.type === "success"
                ? "bg-[var(--success-surface)] text-[var(--success-text)] border-[var(--success-border)]"
                : "bg-[var(--danger-surface)] text-[var(--danger-text)] border-[var(--danger-border)]"
            }`}
          >
            <Icon name={toast.type === "success" ? "check" : "warning"} className="w-4 h-4 shrink-0" />
            <span>{toast.message}</span>
          </div>
        )}

        {/* Page Header */}
        <header className="page-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/admin"
                className="text-xs font-semibold text-[var(--subtext)] hover:text-[var(--primary-active)] flex items-center gap-1 transition-colors"
              >
                ← Quay lại Dashboard
              </Link>
              <span className="text-xs text-[var(--subtext)]">•</span>
              <p className="eyebrow m-0">Quản trị danh mục (A-709)</p>
            </div>
            <h1 className="page-title">Quản lý danh mục ngành hàng toàn sàn</h1>
            <p className="page-description">
              Cấu trúc cây danh mục 2 tầng (RB-KN04) tiêu thụ Category Adapter A-700 phục vụ phân loại sản phẩm.
            </p>
          </div>

          <Button
            variant="primary"
            className="text-xs py-2 px-4 shrink-0 flex items-center gap-1.5"
            onClick={() => {
              setShowAddModal(true);
              setFormError(null);
            }}
          >
            <span>+ Thêm danh mục mới</span>
          </Button>
        </header>

        {/* Navigation Tabs for Admin Portal */}
        <nav aria-label="Điều hướng quản trị" className="border-b border-[var(--border)]">
          <div className="flex gap-6 text-sm font-semibold">
            <Link
              href="/admin"
              className="pb-3 border-b-2 border-transparent text-[var(--subtext)] hover:text-[var(--foreground)]"
            >
              Trung tâm quản trị
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

        {/* Notice on GAP-05 / A-700 Adapter Integration */}
        <div className="notice notice--info" role="status">
          <Icon name="info" />
          <div className="text-xs">
            <strong className="block font-semibold">Cấu trúc danh mục Dino (RB-KN04 & A-700)</strong>
            <span>
              Hệ thống áp dụng kiến trúc phân cấp tối đa 2 cấp (Danh mục gốc và Danh mục con). Dữ liệu danh mục được đồng bộ qua Category Adapter chuẩn hóa.
            </span>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="surface-card p-6 space-y-4" aria-busy="true">
            <Skeleton height={28} className="w-1/4" />
            <Skeleton height={70} />
            <Skeleton height={70} />
            <Skeleton height={70} />
          </div>
        ) : error ? (
          <ErrorState title="Lỗi tải danh mục" description={error} onRetry={fetchCategoriesData} />
        ) : tree.length === 0 ? (
          <EmptyState
            icon="info"
            title="Chưa có danh mục nào"
            description="Hệ thống hiện chưa có ngành hàng nào được thiết lập."
          />
        ) : (
          <div className="space-y-4">
            {tree.map((rootNode) => {
              const isExpanded = expandedNodes[rootNode.id] ?? true;
              const hasChildren = rootNode.children && rootNode.children.length > 0;
              const isInactive = rootNode.status === "INACTIVE";

              return (
                <article
                  key={rootNode.id}
                  className="surface-card overflow-hidden border border-[var(--border)] transition-shadow hover:shadow-sm"
                >
                  {/* Root Node Header */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--card)]">
                    <div className="flex items-start sm:items-center gap-3">
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleNodeExpansion(rootNode.id)}
                          className="w-8 h-8 rounded-lg bg-[var(--card-muted)] hover:bg-[var(--border)] flex items-center justify-center text-[var(--foreground)] transition-colors shrink-0 cursor-pointer"
                          aria-label={isExpanded ? "Thu gọn danh mục con" : "Mở rộng danh mục con"}
                        >
                          <span
                            className={`transform transition-transform text-xs font-bold ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          >
                            ▶
                          </span>
                        </button>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[var(--primary-surface)] text-[var(--primary-active)] flex items-center justify-center shrink-0">
                          <Icon name="grid" className="w-4 h-4" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-bold text-[var(--foreground)]">
                            {rootNode.name}
                          </h2>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isInactive
                                ? "bg-[var(--danger-surface)] text-[var(--danger-text)] border border-[var(--danger-border)]"
                                : "bg-[var(--success-surface)] text-[var(--success-text)] border border-[var(--success-border)]"
                            }`}
                          >
                            {rootNode.status}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--subtext)] mt-0.5">
                          {rootNode.description || "Không có mô tả bổ sung"} • {rootNode.children.length} danh mục con
                        </p>
                      </div>
                    </div>

                    {/* Actions for Root Category */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        variant={isInactive ? "secondary" : "ghost"}
                        className="text-xs py-1 px-3"
                        onClick={() => handleToggleStatus(rootNode)}
                      >
                        {isInactive ? "Kích hoạt" : "Tạm ẩn"}
                      </Button>
                      <Button
                        variant="danger"
                        className="text-xs py-1 px-2.5 text-[var(--danger-text)]"
                        onClick={() => {
                          setDeletingCat(rootNode);
                          setDeleteError(null);
                        }}
                      >
                        Xóa
                      </Button>
                    </div>
                  </div>

                  {/* Children Subcategories (Level 2 per RB-KN04) */}
                  {hasChildren && isExpanded && (
                    <div className="border-t border-[var(--border)] bg-[var(--card-muted)]/40 p-3 sm:p-4 space-y-2">
                      <span className="text-[11px] font-semibold text-[var(--subtext)] uppercase tracking-wider block px-2">
                        Danh mục con cấp 2 ({rootNode.children.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {rootNode.children.map((child) => {
                          const isChildInactive = child.status === "INACTIVE";
                          return (
                            <div
                              key={child.id}
                              className="p-3 bg-[var(--card)] rounded-xl border border-[var(--border)] flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <strong className="font-semibold text-[var(--foreground)] truncate">
                                    {child.name}
                                  </strong>
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                      isChildInactive
                                        ? "bg-[var(--danger-surface)] text-[var(--danger-text)]"
                                        : "bg-[var(--success-surface)] text-[var(--success-text)]"
                                    }`}
                                  >
                                    {child.status}
                                  </span>
                                </div>
                                <span className="text-[11px] text-[var(--subtext)] block truncate">
                                  {child.description || "Danh mục con trực thuộc"}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(child)}
                                  className="text-[11px] font-semibold text-[var(--subtext)] hover:text-[var(--foreground)] px-2 py-1 rounded hover:bg-[var(--card-muted)] transition-colors cursor-pointer"
                                >
                                  {isChildInactive ? "Bật" : "Ẩn"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeletingCat(child);
                                    setDeleteError(null);
                                  }}
                                  className="text-[11px] font-semibold text-[var(--danger-text)] hover:underline px-2 py-1 rounded hover:bg-[var(--danger-surface)] transition-colors cursor-pointer"
                                >
                                  Xóa
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* DIALOG: Thêm danh mục mới */}
        <Dialog
          open={showAddModal}
          onOpenChange={(open) => {
            if (!open && !isSubmitting) setShowAddModal(false);
          }}
          title="Thêm danh mục ngành hàng mới"
          description="Khởi tạo nhóm ngành hàng tuân thủ quy chuẩn cây 2 cấp (RB-KN04)."
          footer={
            <div className="flex justify-end gap-3 w-full">
              <Button
                variant="ghost"
                disabled={isSubmitting}
                onClick={() => setShowAddModal(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="primary"
                loading={isSubmitting}
                onClick={handleCreateCategory}
              >
                Tạo danh mục
              </Button>
            </div>
          }
        >
          <form onSubmit={handleCreateCategory} className="space-y-4">
            {formError && (
              <div className="notice notice--warning" role="alert">
                <Icon name="warning" />
                <p className="text-xs">{formError}</p>
              </div>
            )}

            <FormField
              id="new-cat-name"
              label="Tên danh mục / ngành hàng"
              required
              error={formError && !newCatName.trim() ? "Vui lòng nhập tên." : undefined}
            >
              <TextInput
                id="new-cat-name"
                placeholder="Ví dụ: Thiết bị thông minh, Đồ gia dụng..."
                value={newCatName}
                onChange={(e) => {
                  setNewCatName(e.target.value);
                  setFormError(null);
                }}
              />
            </FormField>

            <FormField
              id="new-cat-parent"
              label="Cấp phân loại danh mục (RB-KN04)"
            >
              <SelectInput
                id="new-cat-parent"
                value={newCatParentId}
                onChange={(e) => setNewCatParentId(e.target.value)}
              >
                <option value="">Không có (Danh mục gốc cấp 1)</option>
                {rootCategories.map((rc) => (
                  <option key={rc.id} value={rc.id}>
                    Trực thuộc: {rc.name}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField id="new-cat-desc" label="Mô tả ngành hàng">
              <TextArea
                id="new-cat-desc"
                rows={2}
                placeholder="Mô tả ngắn gọn về nhóm sản phẩm trong danh mục này..."
                value={newCatDescription}
                onChange={(e) => setNewCatDescription(e.target.value)}
              />
            </FormField>
          </form>
        </Dialog>

        {/* DIALOG: Xác nhận xóa danh mục */}
        <Dialog
          open={Boolean(deletingCat)}
          onOpenChange={(open) => {
            if (!open && !isDeleting) setDeletingCat(null);
          }}
          title="Xác nhận xóa danh mục"
          description={`Bạn có chắc chắn muốn xóa danh mục "${deletingCat?.name}"?`}
          footer={
            <div className="flex justify-end gap-3 w-full">
              <Button
                variant="ghost"
                disabled={isDeleting}
                onClick={() => setDeletingCat(null)}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="danger"
                loading={isDeleting}
                onClick={handleConfirmDelete}
              >
                Xác nhận xóa
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            {deleteError && (
              <div className="notice notice--warning" role="alert">
                <Icon name="warning" />
                <p className="text-xs">{deleteError}</p>
              </div>
            )}
            <p className="text-xs text-[var(--subtext)]">
              Hành động này sẽ xóa danh mục khỏi hệ thống. Lưu ý: Không thể xóa danh mục cha nếu đang chứa các danh mục con trực thuộc.
            </p>
          </div>
        </Dialog>
      </div>
    </ProtectedPage>
  );
}
