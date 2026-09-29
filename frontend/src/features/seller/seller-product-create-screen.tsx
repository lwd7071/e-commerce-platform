"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { repositories } from "@/lib/repositories/repository-factory";
import { categoryAdapter, DEV_CATEGORY_FIXTURES, type CategoryItem } from "@/lib/adapters/category.adapter";
import { validateStockQuantityInput } from "@/features/catalog/catalog-query-engine";
import { AppError } from "@/lib/api/app-error";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { FormField, TextInput, TextArea, SelectInput, ErrorSummary } from "@/components/ui/form-controls";
import { Icon } from "@/components/ui/icon";

interface VariantFormItem {
  id: string;
  variantName: string;
  variantValue: string;
  sku: string;
  price: string;
  stockQuantity: string;
}

interface ImageFormItem {
  id: string;
  url: string;
}

const VERIFIED_PRESET_IMAGES = [
  { label: "Serum dưỡng ẩm", url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800" },
  { label: "Kem chống nắng", url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800" },
  { label: "Áo sơ mi linen", url: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800" },
  { label: "Bàn phím cơ RGB", url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800" },
  { label: "Đồng hồ thông minh", url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800" },
];

export function SellerProductCreateScreen() {
  const router = useRouter();
  const showToast = useToast();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [productName, setProductName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");

  const [images, setImages] = useState<ImageFormItem[]>([
    { id: "img-1", url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800" },
  ]);
  const [customImageUrl, setCustomImageUrl] = useState("");

  const [variants, setVariants] = useState<VariantFormItem[]>([
    {
      id: "var-1",
      variantName: "Tiêu chuẩn",
      variantValue: "Mặc định",
      sku: "SKU-PROD-01",
      price: "150000",
      stockQuantity: "10",
    },
  ]);

  const [errors, setErrors] = useState<Array<{ fieldId: string; message: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    categoryAdapter.getCategories().then((cats) => {
      if (cats && cats.length > 0) {
        setCategories(cats);
        setCategoryId(cats[0].id);
      } else {
        // Fallback to verified category fixtures (RB-KN04 / GAP-05)
        setCategories(DEV_CATEGORY_FIXTURES);
        setCategoryId(DEV_CATEGORY_FIXTURES[0].id);
      }
    });
  }, []);

  const handleAddImage = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) {
      showToast("URL ảnh phải bắt đầu bằng http:// hoặc https://", "error");
      return;
    }
    if (images.some((img) => img.url === trimmed)) {
      showToast("Hình ảnh này đã được thêm vào danh sách", "info");
      return;
    }
    setImages((prev) => [...prev, { id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, url: trimmed }]);
    setCustomImageUrl("");
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleAddVariant = () => {
    const newIdx = variants.length + 1;
    setVariants((prev) => [
      ...prev,
      {
        id: `var-${Date.now()}-${newIdx}`,
        variantName: "Phân loại",
        variantValue: `Lựa chọn ${newIdx}`,
        sku: `SKU-${Date.now().toString().slice(-4)}-${newIdx}`,
        price: variants[0]?.price || "150000",
        stockQuantity: "10",
      },
    ]);
  };

  const handleRemoveVariant = (id: string) => {
    if (variants.length <= 1) {
      showToast("Sản phẩm cần tối thiểu 1 biến thể", "error");
      return;
    }
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const handleUpdateVariant = (id: string, field: keyof VariantFormItem, val: string) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: val } : v))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Array<{ fieldId: string; message: string }> = [];

    if (!productName.trim()) {
      newErrors.push({ fieldId: "product-name", message: "Vui lòng nhập tên sản phẩm" });
    }

    if (!categoryId.trim()) {
      newErrors.push({ fieldId: "product-category", message: "Vui lòng chọn danh mục hợp lệ" });
    }

    if (variants.length === 0) {
      newErrors.push({ fieldId: "product-variants", message: "Cần ít nhất một biến thể sản phẩm" });
    }

    // Validate variants & duplicate SKUs (RB-LB11, QD05, QD06)
    const skuSet = new Set<string>();
    variants.forEach((v, idx) => {
      const trimmedSku = v.sku.trim();
      if (!trimmedSku) {
        newErrors.push({ fieldId: `variant-sku-${v.id}`, message: `Biến thể #${idx + 1}: Vui lòng nhập mã SKU` });
      } else if (skuSet.has(trimmedSku)) {
        newErrors.push({ fieldId: `variant-sku-${v.id}`, message: `Biến thể #${idx + 1}: Mã SKU '${trimmedSku}' bị trùng lặp` });
      } else {
        skuSet.add(trimmedSku);
      }

      const numPrice = Number(v.price.trim());
      if (isNaN(numPrice) || numPrice <= 0) {
        newErrors.push({ fieldId: `variant-price-${v.id}`, message: `Biến thể #${idx + 1}: Giá bán phải lớn hơn 0` });
      }

      const validStock = validateStockQuantityInput(v.stockQuantity);
      if (!validStock.valid) {
        newErrors.push({ fieldId: `variant-stock-${v.id}`, message: `Biến thể #${idx + 1}: ${validStock.error}` });
      }
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
      showToast("Vui lòng kiểm tra lại các trường thông tin chưa hợp lệ", "error");
      return;
    }

    setErrors([]);
    setIsSubmitting(true);

    try {
      const payload = {
        category_id: categoryId,
        product_name: productName.trim(),
        description: description.trim() || null,
        images: images.map((img, idx) => ({
          image_url: img.url.trim(),
          sort_order: idx,
        })),
        variants: variants.map((v) => ({
          variant_name: v.variantName.trim(),
          variant_value: v.variantValue.trim() || null,
          sku: v.sku.trim(),
          price: Number(v.price).toFixed(2),
          stock_quantity: validateStockQuantityInput(v.stockQuantity).value ?? 0,
        })),
      };

      const catalogRepo = repositories.catalog();
      if (!catalogRepo.createProduct) {
        showToast("Tính năng tạo sản phẩm chưa khả dụng trên môi trường hiện tại", "error");
        return;
      }

      await catalogRepo.createProduct(payload);
      showToast("Sản phẩm đã được tạo thành công!", "success", "Tạo sản phẩm");
      router.push("/seller/products");
    } catch (err: unknown) {
      if (err instanceof AppError) {
        if (err.status === 409) {
          showToast(err.message || "Mã SKU này đã tồn tại trong gian hàng của bạn. Vui lòng chọn SKU khác.", "error", "Xung đột SKU");
          return;
        }
        if (err.status === 403) {
          showToast("Chỉ tài khoản Người bán mới có quyền tạo sản phẩm.", "error", "Truy cập bị từ chối");
          return;
        }
        showToast(err.message, "error");
        return;
      }
      const msg = err instanceof Error ? err.message : "Tạo sản phẩm thất bại. Vui lòng thử lại.";
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Link
          href="/seller/products"
          className="text-xs font-semibold text-[var(--subtext)] hover:text-[var(--foreground)] inline-flex items-center gap-1.5 transition-colors"
        >
          <span aria-hidden="true">←</span>
          Quay lại danh sách sản phẩm
        </Link>
        <p className="eyebrow">Kênh người bán</p>
        <h1 className="page-title">Thêm Sản Phẩm Mới</h1>
        <p className="page-description">
          Khởi tạo thông tin sản phẩm, danh mục, hình ảnh và cấu hình biến thể hàng hóa theo chuẩn POST /products.
        </p>
      </div>

      <ErrorSummary errors={errors} />

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Basic Information */}
        <section className="surface-card p-6 space-y-5">
          <h2 className="text-base font-bold text-[var(--foreground)] border-b border-[var(--border)] pb-3">
            1. Thông tin chung
          </h2>

          <FormField
            id="product-name"
            label="Tên sản phẩm"
            helpText="Tên hiển thị công khai trên Dino Marketplace (tối đa 255 ký tự)."
            required
            error={errors.find((e) => e.fieldId === "product-name")?.message}
          >
            <TextInput
              id="product-name"
              placeholder="VD: Kem Chống Nắng Phổ Rộng SPF 50+..."
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              required
            />
          </FormField>

          <FormField
            id="product-category"
            label="Danh mục ngành hàng (Verified Category)"
            helpText="Chọn danh mục đã được xác minh trên hệ thống."
            required
            error={errors.find((e) => e.fieldId === "product-category")?.message}
          >
            <SelectInput
              id="product-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.parentId ? `└─ ${cat.name}` : cat.name}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField
            id="product-description"
            label="Mô tả chi tiết"
            helpText="Mô tả công dụng, thành phần, nguồn gốc xuất xứ và hướng dẫn sử dụng."
          >
            <TextArea
              id="product-description"
              rows={4}
              placeholder="Nhập mô tả chi tiết sản phẩm..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
        </section>

        {/* Section 2: Images */}
        <section className="surface-card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--border)] pb-3">
            <div>
              <h2 className="text-base font-bold text-[var(--foreground)]">
                2. Hình ảnh sản phẩm (Verified URLs)
              </h2>
              <p className="text-xs text-[var(--subtext)]">
                Dùng URL ảnh HTTPS công khai từ CDN đã xác minh để đảm bảo hiển thị ổn định.
              </p>
            </div>
            <span className="text-xs font-semibold text-[var(--subtext)]">
              Đã thêm: {images.length} ảnh
            </span>
          </div>

          {/* Quick presets */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[var(--subtext)]">
              Gợi ý ảnh mẫu đã xác minh:
            </span>
            <div className="flex flex-wrap gap-2">
              {VERIFIED_PRESET_IMAGES.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => handleAddImage(preset.url)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card-muted)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:border-[var(--primary-border)] hover:bg-[var(--primary-surface)] transition-all min-h-[36px]"
                >
                  + {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom URL input */}
          <div className="flex gap-2">
            <TextInput
              id="custom-image-url"
              placeholder="Dán URL hình ảnh HTTPS (https://...)"
              value={customImageUrl}
              onChange={(e) => setCustomImageUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleAddImage(customImageUrl)}
              disabled={!customImageUrl.trim()}
              className="min-h-[44px] px-4 text-xs font-semibold whitespace-nowrap"
            >
              Thêm URL
            </Button>
          </div>

          {/* Image gallery previews */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  className="group relative aspect-square rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card-muted)] shadow-xs"
                >
                  <Image
                    src={img.url}
                    alt={`Ảnh sản phẩm ${idx + 1}`}
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                  <div className="absolute top-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    #{idx + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(img.id)}
                    aria-label={`Xóa ảnh ${idx + 1}`}
                    className="absolute top-1.5 right-1.5 rounded-md bg-red-600/90 hover:bg-red-700 text-white p-1 text-xs opacity-90 transition-opacity"
                  >
                    <Icon name="close" className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 3: Variants & Stock */}
        <section className="surface-card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--border)] pb-3">
            <div>
              <h2 className="text-base font-bold text-[var(--foreground)]">
                3. Danh sách biến thể & Tồn kho
              </h2>
              <p className="text-xs text-[var(--subtext)]">
                Mỗi biến thể có mã SKU riêng biệt trong gian hàng (RB-LB11), giá bán &gt; 0₫ và tồn kho nguyên không âm.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddVariant}
              className="min-h-[44px] text-xs font-bold"
            >
              + Thêm biến thể
            </Button>
          </div>

          <div className="space-y-4">
            {variants.map((v, idx) => {
              const skuError = errors.find((e) => e.fieldId === `variant-sku-${v.id}`)?.message;
              const priceError = errors.find((e) => e.fieldId === `variant-price-${v.id}`)?.message;
              const stockError = errors.find((e) => e.fieldId === `variant-stock-${v.id}`)?.message;

              return (
                <div
                  key={v.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card-muted)]/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--primary-active)] uppercase tracking-wide">
                      Biến thể #{idx + 1}
                    </span>
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(v.id)}
                        className="text-xs font-semibold text-[var(--danger)] hover:underline inline-flex items-center gap-1"
                      >
                        <Icon name="close" className="h-3 w-3" />
                        Xóa biến thể
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <label className="field-label text-xs" htmlFor={`v-name-${v.id}`}>
                        Thuộc tính *
                      </label>
                      <TextInput
                        id={`v-name-${v.id}`}
                        placeholder="VD: Dung tích, Màu"
                        value={v.variantName}
                        onChange={(e) => handleUpdateVariant(v.id, "variantName", e.target.value)}
                        required
                        className="h-10 text-xs"
                      />
                    </div>

                    <div>
                      <label className="field-label text-xs" htmlFor={`v-val-${v.id}`}>
                        Giá trị
                      </label>
                      <TextInput
                        id={`v-val-${v.id}`}
                        placeholder="VD: 50ml, Trắng"
                        value={v.variantValue}
                        onChange={(e) => handleUpdateVariant(v.id, "variantValue", e.target.value)}
                        className="h-10 text-xs"
                      />
                    </div>

                    <div>
                      <label className="field-label text-xs" htmlFor={`variant-sku-${v.id}`}>
                        Mã SKU *
                      </label>
                      <TextInput
                        id={`variant-sku-${v.id}`}
                        placeholder="VD: SKU-SP1-01"
                        value={v.sku}
                        onChange={(e) => handleUpdateVariant(v.id, "sku", e.target.value)}
                        required
                        error={skuError}
                        className="h-10 text-xs font-mono"
                      />
                      {skuError && <p className="field-error text-[11px] mt-1">{skuError}</p>}
                    </div>

                    <div>
                      <label className="field-label text-xs" htmlFor={`variant-price-${v.id}`}>
                        Giá bán (₫) *
                      </label>
                      <TextInput
                        id={`variant-price-${v.id}`}
                        type="number"
                        min="1000"
                        step="1000"
                        placeholder="150000"
                        value={v.price}
                        onChange={(e) => handleUpdateVariant(v.id, "price", e.target.value)}
                        required
                        error={priceError}
                        className="h-10 text-xs"
                      />
                      {priceError && <p className="field-error text-[11px] mt-1">{priceError}</p>}
                    </div>

                    <div>
                      <label className="field-label text-xs" htmlFor={`variant-stock-${v.id}`}>
                        Số lượng kho *
                      </label>
                      <TextInput
                        id={`variant-stock-${v.id}`}
                        type="number"
                        min="0"
                        step="1"
                        placeholder="10"
                        value={v.stockQuantity}
                        onChange={(e) => handleUpdateVariant(v.id, "stockQuantity", e.target.value)}
                        required
                        error={stockError}
                        className="h-10 text-xs"
                      />
                      {stockError && <p className="field-error text-[11px] mt-1">{stockError}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/seller/products"
            className="button button--secondary min-h-[44px] px-6 text-xs font-bold"
          >
            Hủy
          </Link>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="min-h-[44px] px-8 text-xs font-bold shadow-sm"
          >
            {isSubmitting ? "Đang tạo sản phẩm..." : "Tạo sản phẩm mới"}
          </Button>
        </div>
      </form>
    </div>
  );
}
