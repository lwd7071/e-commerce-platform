"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { repositories } from "../../lib/repositories/repository-factory";
import { categoryAdapter, type CategoryItem } from "../../lib/adapters/category.adapter";
import {
  validateProductCreationInput,
  type ProductVariantInput,
} from "./seller-product-validator";
import { Button } from "../../components/ui/button";
import { TextInput, TextArea } from "../../components/ui/form-controls";
import { FileUploadZone } from "../../components/ui/file-upload-zone";
import { useToast } from "../../components/ui/toast";

export function SellerCreateProductScreen() {
  const router = useRouter();
  const showToast = useToast();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<ProductVariantInput[]>([
    { variant_name: "Tiêu chuẩn", variant_value: "Mặc định", price: 100000, stock_quantity: 10 },
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    categoryAdapter.getCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0 && !categoryId) {
        setCategoryId(cats[0].id);
      }
    });
  }, [categoryId]);

  const handleAddVariant = () => {
    setVariants([
      ...variants,
      {
        variant_name: "Phân loại mới",
        variant_value: `Lựa chọn ${variants.length + 1}`,
        price: 100000,
        stock_quantity: 10,
      },
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) {
      showToast("Sản phẩm phải có ít nhất 1 biến thể SKU", "error");
      return;
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleVariantChange = (
    index: number,
    field: keyof ProductVariantInput,
    val: string | number
  ) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: val };
    setVariants(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const inputData = {
      name,
      description,
      category_id: categoryId,
      images,
      variants,
    };

    const validation = validateProductCreationInput(inputData);
    if (!validation.valid) {
      setErrors(validation.errors);
      showToast("Vui lòng kiểm tra lại các thông tin chưa hợp lệ", "error");
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const catalogRepo = repositories.catalog();
      if (catalogRepo.createProduct) {
        await catalogRepo.createProduct({
          product_name: inputData.name,
          description: inputData.description || null,
          category_id: inputData.category_id,
          images: inputData.images.map((img, i) => ({ image_url: img, sort_order: i })),
          variants: inputData.variants.map((v, i) => ({
            variant_name: v.variant_name,
            variant_value: v.variant_value,
            sku: `SKU-${Date.now().toString(36)}-${i}`.toUpperCase(),
            price: String(v.price),
            stock_quantity: v.stock_quantity,
          })),
        });
      }

      showToast("Đã tạo sản phẩm mới thành công!", "success");
      router.push("/seller/products");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đăng sản phẩm thất bại";
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/seller/products"
              className="text-xs text-[var(--subtext)] hover:text-[var(--foreground)]"
            >
              ← Quay lại danh sách
            </Link>
          </div>
          <h1 className="page-title mt-1">Đăng Bán Sản Phẩm Mới</h1>
          <p className="page-description">
            Nhập thông tin sản phẩm, hình ảnh minh họa và thiết lập các biến thể SKU tồn kho.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột trái: Thông tin cơ bản & Ảnh */}
          <div className="lg:col-span-2 space-y-6">
            <div className="surface-card p-6 space-y-4">
              <h2 className="text-base font-bold text-[var(--foreground)] border-b border-[var(--border)] pb-3">
                1. Thông tin chung
              </h2>

              <div>
                <label
                  htmlFor="product-name"
                  className="block text-xs font-bold text-[var(--foreground)] mb-1"
                >
                  Tên sản phẩm <span className="text-[var(--danger-text)]">*</span>
                </label>
                <TextInput
                  id="product-name"
                  placeholder="Ví dụ: Áo Sơ Mi Linen Form Rộng Cao Cấp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={errors.name}
                />
              </div>

              <div>
                <label
                  htmlFor="product-category"
                  className="block text-xs font-bold text-[var(--foreground)] mb-1"
                >
                  Danh mục sản phẩm <span className="text-[var(--danger-text)]">*</span>
                </label>
                <select
                  id="product-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-11 min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {errors.category_id && (
                  <p className="text-xs text-[var(--danger-text)] mt-1 font-semibold">
                    {errors.category_id}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="product-desc"
                  className="block text-xs font-bold text-[var(--foreground)] mb-1"
                >
                  Mô tả sản phẩm
                </label>
                <TextArea
                  id="product-desc"
                  rows={4}
                  placeholder="Mô tả chất liệu, kiểu dáng, xuất xứ và công dụng..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="surface-card p-6 space-y-4">
              <h2 className="text-base font-bold text-[var(--foreground)] border-b border-[var(--border)] pb-3">
                2. Hình ảnh sản phẩm
              </h2>
              <FileUploadZone
                values={images}
                purpose="product"
                onChange={setImages}
                maxFiles={5}
              />
            </div>
          </div>

          {/* Cột phải: Biến thể SKU & Submit */}
          <div className="space-y-6">
            <div className="surface-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h2 className="text-base font-bold text-[var(--foreground)]">
                  3. Phân loại biến thể (SKU)
                </h2>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddVariant}
                  className="h-8 px-2.5 text-xs font-bold"
                >
                  + Thêm dòng
                </Button>
              </div>

              {errors.variants && (
                <p className="text-xs text-[var(--danger-text)] font-semibold">
                  {errors.variants}
                </p>
              )}

              <div className="space-y-4 divide-y divide-[var(--border)]">
                {variants.map((v, idx) => (
                  <div key={idx} className="pt-3 first:pt-0 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-[var(--subtext)]">
                      <span>Phân loại #{idx + 1}</span>
                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(idx)}
                          className="text-[var(--danger-text)] hover:underline min-h-[44px] flex items-center px-1"
                        >
                          Xóa
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor={`variant-name-${idx}`} className="block text-[11px] font-semibold text-[var(--subtext)] mb-0.5">
                          Nhóm
                        </label>
                        <TextInput
                          id={`variant-name-${idx}`}
                          value={v.variant_name}
                          onChange={(e) => handleVariantChange(idx, "variant_name", e.target.value)}
                          placeholder="Màu sắc / Size"
                        />
                      </div>
                      <div>
                        <label htmlFor={`variant-val-${idx}`} className="block text-[11px] font-semibold text-[var(--subtext)] mb-0.5">
                          Giá trị
                        </label>
                        <TextInput
                          id={`variant-val-${idx}`}
                          value={v.variant_value}
                          onChange={(e) => handleVariantChange(idx, "variant_value", e.target.value)}
                          placeholder="Đỏ, Xanh, L..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor={`variant-price-${idx}`} className="block text-[11px] font-semibold text-[var(--subtext)] mb-0.5">
                          Giá bán (₫)
                        </label>
                        <TextInput
                          id={`variant-price-${idx}`}
                          type="number"
                          value={v.price}
                          onChange={(e) => handleVariantChange(idx, "price", Number(e.target.value))}
                          error={errors[`variants_${idx}_price`]}
                        />
                      </div>
                      <div>
                        <label htmlFor={`variant-stock-${idx}`} className="block text-[11px] font-semibold text-[var(--subtext)] mb-0.5">
                          Tồn kho
                        </label>
                        <TextInput
                          id={`variant-stock-${idx}`}
                          type="number"
                          step="1"
                          value={v.stock_quantity}
                          onChange={(e) =>
                            handleVariantChange(idx, "stock_quantity", Number(e.target.value))
                          }
                          error={errors[`variants_${idx}_stock`]}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card p-6 space-y-4">
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="w-full h-12 min-h-[44px] text-sm font-bold shadow-sm"
              >
                {isSubmitting ? "Đang xử lý tạo sản phẩm..." : "Xác nhận đăng bán sản phẩm"}
              </Button>
              <Link
                href="/seller/products"
                className="block text-center text-xs text-[var(--subtext)] hover:text-[var(--foreground)] py-2"
              >
                Hủy bỏ
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
