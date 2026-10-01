"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { repositories } from "@/lib/repositories/repository-factory";
import { categoryAdapter, type CategoryItem } from "@/lib/adapters/category.adapter";
import type { WireCatalogProductDetail } from "@/lib/api/catalog.api";
import { Button } from "@/components/ui/button";
import { FormField, TextInput, SelectInput } from "@/components/ui/form-controls";
import { ErrorState, Skeleton } from "@/components/ui/data-states";
import { useToast } from "@/components/ui/toast";

type EditableVariant = { key: string; variant_id?: string; variant_name: string; variant_value: string; sku: string; price: string };

export function SellerProductEditScreen() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [product, setProduct] = useState<WireCatalogProductDetail | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [variants, setVariants] = useState<EditableVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([repositories.catalog().getSellerProductById!(params.id), categoryAdapter.getCategories()]).then(([detail, activeCategories]) => {
      setProduct(detail);
      setName(detail.product_name);
      setDescription(detail.description ?? "");
      setCategoryId(detail.category_id);
      setCategories(activeCategories);
      setVariants(detail.variants.map(({ variant_id, variant_name, variant_value, sku, price }) => ({ key: variant_id, variant_id, variant_name, variant_value: variant_value ?? "", sku, price })));
      setError(null);
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Không thể tải sản phẩm."))
      .finally(() => setLoading(false));
  }, [params.id]);
  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!product || !name.trim() || variants.length === 0 || variants.some((variant) => !variant.variant_name.trim() || !variant.sku.trim() || Number(variant.price) <= 0)) return;
    setSaving(true);
    try {
      await repositories.catalog().updateSellerProduct!(product.product_id, {
        product_name: name.trim(), description: description.trim() || null,
        ...(categoryId !== product.category_id ? { category_id: categoryId } : {}),
        variants: variants.map((variant) => ({
          ...(variant.variant_id ? { variant_id: variant.variant_id } : {}),
          variant_name: variant.variant_name,
          variant_value: variant.variant_value.trim() || null,
          sku: variant.sku,
          price: variant.price,
        })),
      });
      toast("Đã lưu thay đổi sản phẩm", "success");
      router.push("/seller/products");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "Không thể lưu sản phẩm", "error");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="surface-card space-y-4 p-6"><Skeleton height={32} /><Skeleton height={48} /><Skeleton height={48} /></div>;
  if (error || !product) return <ErrorState title="Không thể tải sản phẩm" description={error ?? "Không tìm thấy sản phẩm."} onRetry={load} />;

  return <div className="mx-auto max-w-3xl space-y-6">
    <div><p className="eyebrow">Kênh người bán</p><h1 className="page-title">Sửa sản phẩm</h1><p className="page-description">Cập nhật chi tiết và phân loại. Tồn kho tiếp tục được quản lý riêng.</p></div>
    {product.status === "HIDDEN" && <div className="notice notice--warning" role="status">Sản phẩm đang bị Admin ẩn. Bạn có thể sửa thông tin nhưng không thể tự kích hoạt lại.</div>}
    <form className="surface-card space-y-5 p-6" onSubmit={save}>
      <FormField id="seller-product-name" label="Tên sản phẩm" required><TextInput id="seller-product-name" required minLength={2} maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></FormField>
      <FormField id="seller-product-category" label="Danh mục" required><SelectInput id="seller-product-category" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
        {!categories.some((category) => category.id === product.category_id) && <option value={product.category_id}>Danh mục hiện tại (không còn mở bán)</option>}
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </SelectInput></FormField>
      <FormField id="seller-product-description" label="Mô tả"><textarea id="seller-product-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="form-textarea w-full" /></FormField>
      <fieldset className="space-y-4"><legend className="font-semibold">Phân loại sản phẩm</legend>
        {variants.map((variant, index) => <div key={variant.key} className="grid gap-3 rounded-xl border border-[var(--border)] p-4 sm:grid-cols-2">
          <FormField id={`variant-name-${variant.key}`} label={`Tên phân loại ${index + 1}`} required><TextInput id={`variant-name-${variant.key}`} required maxLength={100} value={variant.variant_name} onChange={(event) => setVariants((all) => all.map((item) => item.key === variant.key ? { ...item, variant_name: event.target.value } : item))} /></FormField>
          <FormField id={`variant-value-${variant.key}`} label="Giá trị"><TextInput id={`variant-value-${variant.key}`} maxLength={150} value={variant.variant_value} onChange={(event) => setVariants((all) => all.map((item) => item.key === variant.key ? { ...item, variant_value: event.target.value } : item))} /></FormField>
          <FormField id={`sku-${variant.key}`} label="SKU" required><TextInput id={`sku-${variant.key}`} required maxLength={100} value={variant.sku} onChange={(event) => setVariants((all) => all.map((item) => item.key === variant.key ? { ...item, sku: event.target.value } : item))} /></FormField>
          <FormField id={`price-${variant.key}`} label="Giá bán" required><TextInput id={`price-${variant.key}`} type="number" min="0.01" step="0.01" required value={variant.price} onChange={(event) => setVariants((all) => all.map((item) => item.key === variant.key ? { ...item, price: event.target.value } : item))} /></FormField>
          <Button type="button" variant="ghost" disabled={variants.length === 1} onClick={() => setVariants((all) => all.filter((item) => item.key !== variant.key))}>Xóa phân loại</Button>
        </div>)}
        <Button type="button" variant="secondary" onClick={() => setVariants((all) => [...all, { key: crypto.randomUUID(), variant_name: "", variant_value: "", sku: "", price: "" }])}>+ Thêm phân loại</Button>
      </fieldset>
      <div className="flex justify-end gap-3"><Link className="button button--secondary" href="/seller/products">Hủy</Link><Button type="submit" loading={saving}>Lưu thay đổi</Button></div>
    </form>
  </div>;
}
