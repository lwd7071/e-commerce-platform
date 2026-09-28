"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { repositories } from "@/lib/repositories/repository-factory";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import type { WireCatalogProductItem, WireCatalogProductDetail, WireProductVariant } from "@/lib/api/catalog.api";
import { useToast } from "@/components/ui/toast";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/data-states";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField, TextInput } from "@/components/ui/form-controls";
import { Icon } from "@/components/ui/icon";

export function SellerProductsScreen() {
  const router = useRouter();
  const showToast = useToast();
  const [products, setProducts] = useState<WireCatalogProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit stock dialog state
  const [activeProduct, setActiveProduct] = useState<WireCatalogProductItem | null>(null);
  const [productDetail, setProductDetail] = useState<WireCatalogProductDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [editingVariant, setEditingVariant] = useState<WireProductVariant | null>(null);
  const [stockInput, setStockInput] = useState<number>(0);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);

  useEffect(() => {
    let ignore = false;
    repositories.catalog().getProducts({ limit: 50 })
      .then((data) => {
        if (ignore) return;
        setProducts(data);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        const msg = err instanceof Error ? err.message : "Không thể tải danh sách sản phẩm.";
        setError(msg);
        setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    repositories.catalog().getProducts({ limit: 50 })
      .then((data) => {
        setProducts(data);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Không thể tải danh sách sản phẩm.";
        setError(msg);
        setIsLoading(false);
      });
  };

  const handleOpenStockDialog = async (prod: WireCatalogProductItem) => {
    setActiveProduct(prod);
    setIsLoadingDetail(true);
    try {
      const detail = await repositories.catalog().getProductById(prod.product_id);
      setProductDetail(detail);
      if (detail.variants && detail.variants.length > 0) {
        setEditingVariant(detail.variants[0]);
        setStockInput(detail.variants[0].stock_quantity);
      }
    } catch {
      showToast("Không thể tải thông tin biến thể sản phẩm", "error");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleSelectVariantForEdit = (variant: WireProductVariant) => {
    setEditingVariant(variant);
    setStockInput(variant.stock_quantity);
  };

  const handleSaveStock = async () => {
    const catalogRepo = repositories.catalog();
    if (!editingVariant || !catalogRepo.updateStock) return;
    if (stockInput < 0 || isNaN(stockInput)) {
      showToast("Số lượng tồn kho phải là số nguyên không âm", "error");
      return;
    }

    setIsUpdatingStock(true);
    try {
      await catalogRepo.updateStock(editingVariant.variant_id, stockInput);
      showToast(`Đã cập nhật tồn kho thành ${stockInput}`, "success", "Cập nhật thành công");

      // Update local detail state
      if (productDetail) {
        const updatedVariants = productDetail.variants.map((v) =>
          v.variant_id === editingVariant.variant_id ? { ...v, stock_quantity: stockInput } : v
        );
        setProductDetail({ ...productDetail, variants: updatedVariants });
        setEditingVariant({ ...editingVariant, stock_quantity: stockInput });
      }

      // Refresh list
      handleRetry();
      setActiveProduct(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cập nhật tồn kho thất bại";
      showToast(msg, "error");
    } finally {
      setIsUpdatingStock(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Kênh người bán</p>
          <h1 className="page-title">Quản Lý Sản Phẩm</h1>
          <p className="page-description">
            Theo dõi danh mục hàng hóa, trạng thái hiển thị và điều chỉnh tồn kho nhanh.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/seller/products/new"
            className="button button--primary h-10 px-4 text-xs font-bold shadow-xs"
          >
            + Thêm sản phẩm mới
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 surface-card p-6">
          <Skeleton height={28} className="w-1/4" />
          <Skeleton height={40} className="w-full" />
          <Skeleton height={40} className="w-full" />
          <Skeleton height={40} className="w-full" />
        </div>
      ) : error ? (
        <ErrorState
          title="Không thể tải sản phẩm của gian hàng"
          description={error}
          onRetry={handleRetry}
        />
      ) : products.length === 0 ? (
        <EmptyState
          icon="bag"
          title="Gian hàng chưa có sản phẩm nào"
          description="Hãy tạo sản phẩm đầu tiên để bắt đầu bán hàng trên Dino."
          action={{
            label: "Thêm sản phẩm",
            onClick: () => {
              router.push("/seller/products/new");
            },
          }}
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--card-muted)] text-xs font-bold text-[var(--subtext)]">
                  <th className="py-3.5 px-4">Sản phẩm</th>
                  <th className="py-3.5 px-4">Giá bán</th>
                  <th className="py-3.5 px-4 text-center">Tổng tồn kho</th>
                  <th className="py-3.5 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {products.map((item) => {
                  const priceStr =
                    item.min_price === item.max_price
                      ? moneyAdapter.formatVND(item.min_price)
                      : `${moneyAdapter.formatVND(item.min_price)} - ${moneyAdapter.formatVND(item.max_price)}`;

                  return (
                    <tr key={item.product_id} className="hover:bg-[var(--card-muted)]/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--foreground)]">
                          {item.product_name}
                        </div>
                        <div className="text-xs text-[var(--subtext)] font-mono">
                          ID: {item.product_id}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[var(--primary-active)]">
                        {priceStr}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            item.total_stock > 10
                              ? "bg-[var(--success-surface)] text-[var(--success)]"
                              : item.total_stock > 0
                              ? "bg-[var(--warning-surface)] text-[var(--warning)]"
                              : "bg-[var(--danger-surface)] text-[var(--danger)]"
                          }`}
                        >
                          {item.total_stock > 0 ? item.total_stock : "Hết hàng"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => handleOpenStockDialog(item)}
                            className="h-8 px-3 text-xs"
                          >
                            Chỉnh tồn kho
                          </Button>
                          <Link
                            href={`/products/${item.product_id}`}
                            className="button button--ghost h-8 px-2 text-xs"
                            target="_blank"
                            title="Xem trang sản phẩm"
                          >
                            <Icon name="search" className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Edit Dialog (O-509) */}
      <Dialog
        open={Boolean(activeProduct)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveProduct(null);
            setProductDetail(null);
            setEditingVariant(null);
          }
        }}
        title="Cập nhật số lượng tồn kho"
        description={activeProduct ? activeProduct.product_name : undefined}
        footer={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setActiveProduct(null)}
              disabled={isUpdatingStock}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveStock}
              disabled={isUpdatingStock || isLoadingDetail || !editingVariant}
            >
              {isUpdatingStock ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        }
      >
        {isLoadingDetail ? (
          <div className="space-y-4 py-4">
            <Skeleton height={20} className="w-1/2" />
            <Skeleton height={40} className="w-full" />
          </div>
        ) : productDetail ? (
          <div className="space-y-5 py-2">
            {/* Variant selector */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-[var(--foreground)]">
                Chọn biến thể để cập nhật:
              </span>
              <div className="flex flex-wrap gap-2">
                {productDetail.variants.map((v) => {
                  const isSelected = editingVariant?.variant_id === v.variant_id;
                  const label = v.variant_value ? `${v.variant_name}: ${v.variant_value}` : v.variant_name;
                  return (
                    <button
                      key={v.variant_id}
                      type="button"
                      onClick={() => handleSelectVariantForEdit(v)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                        isSelected
                          ? "border-[var(--primary-active)] bg-[var(--primary-surface)] text-[var(--primary-active)]"
                          : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--primary-border)]"
                      }`}
                    >
                      {label} ({v.stock_quantity})
                    </button>
                  );
                })}
              </div>
            </div>

            {editingVariant && (
              <div className="space-y-4 rounded-xl bg-[var(--card-muted)] p-4">
                <div className="flex items-center justify-between text-xs text-[var(--subtext)]">
                  <span>Mã SKU: <strong className="font-mono text-[var(--foreground)]">{editingVariant.sku}</strong></span>
                  <span>Giá bán: <strong className="text-[var(--primary-active)]">{moneyAdapter.formatVND(editingVariant.price)}</strong></span>
                </div>

                <FormField
                  id="variant-stock-input"
                  label="Số lượng tồn kho mới"
                  helpText="Nhập số lượng thực tế trong kho sẵn sàng để giao bán."
                  required
                >
                  <TextInput
                    id="variant-stock-input"
                    type="number"
                    min="0"
                    value={stockInput}
                    onChange={(e) => setStockInput(parseInt(e.target.value, 10) || 0)}
                  />
                </FormField>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-[var(--subtext)]">Không tìm thấy chi tiết sản phẩm.</p>
        )}
      </Dialog>
    </div>
  );
}
