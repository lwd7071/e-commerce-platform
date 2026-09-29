"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { repositories } from "@/lib/repositories/repository-factory";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import type { WireCatalogProductItem, WireCatalogProductDetail, WireProductVariant } from "@/lib/api/catalog.api";
import { AppError } from "@/lib/api/app-error";
import { useAuth } from "@/lib/auth/auth-context";
import { validateStockQuantityInput } from "@/features/catalog/catalog-query-engine";
import { useToast } from "@/components/ui/toast";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/data-states";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField, TextInput } from "@/components/ui/form-controls";
import { Icon } from "@/components/ui/icon";

export function SellerProductsScreen() {
  const router = useRouter();
  const showToast = useToast();
  const { user } = useAuth();

  const [products, setProducts] = useState<WireCatalogProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search, filter, and pagination states (O-508)
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "out_of_stock">("all");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // Edit stock dialog state (O-509)
  const [activeProduct, setActiveProduct] = useState<WireCatalogProductItem | null>(null);
  const [productDetail, setProductDetail] = useState<WireCatalogProductDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [editingVariant, setEditingVariant] = useState<WireProductVariant | null>(null);
  const [stockInput, setStockInput] = useState<string>("0");
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);

  useEffect(() => {
    let ignore = false;
    repositories.catalog().getSellerProducts({ limit: 50 })
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
    repositories.catalog().getSellerProducts({ limit: 50 })
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

  // Scope products strictly to seller context (O-508)
  const sellerShopId = user?.shopId || "00000000-0000-0000-0000-000000000001";
  const scopedProducts = useMemo(() => {
    return products.filter((p) => {
      if (sellerShopId && p.shop_id && p.shop_id !== sellerShopId) {
        return false;
      }
      return true;
    });
  }, [products, sellerShopId]);

  // Apply search query and stock availability filter
  const filteredProducts = useMemo(() => {
    return scopedProducts.filter((item) => {
      if (stockFilter === "in_stock" && item.total_stock <= 0) return false;
      if (stockFilter === "out_of_stock" && item.total_stock > 0) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.product_name.toLowerCase().includes(q);
        const matchId = item.product_id.toLowerCase().includes(q);
        if (!matchName && !matchId) return false;
      }
      return true;
    });
  }, [scopedProducts, stockFilter, searchQuery]);

  // Client-side pagination
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const handleOpenStockDialog = async (prod: WireCatalogProductItem) => {
    setActiveProduct(prod);
    setIsLoadingDetail(true);
    try {
      const detail = await repositories.catalog().getProductById(prod.product_id);
      setProductDetail(detail);
      if (detail.variants && detail.variants.length > 0) {
        setEditingVariant(detail.variants[0]);
        setStockInput(String(detail.variants[0].stock_quantity));
      }
    } catch {
      showToast("Không thể tải thông tin biến thể sản phẩm", "error");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleSelectVariantForEdit = (variant: WireProductVariant) => {
    setEditingVariant(variant);
    setStockInput(String(variant.stock_quantity));
  };

  const handleSaveStock = async () => {
    const catalogRepo = repositories.catalog();
    if (!editingVariant || !catalogRepo.updateStock) return;

    // Strict validation to avoid float truncation or negative values (O-509)
    const valid = validateStockQuantityInput(stockInput);
    if (!valid.valid || valid.value === undefined) {
      showToast(valid.error || "Vui lòng nhập số lượng tồn kho hợp lệ", "error");
      return;
    }

    setIsUpdatingStock(true);
    try {
      await catalogRepo.updateStock(editingVariant.variant_id, valid.value);
      showToast(`Đã cập nhật tồn kho thành ${valid.value}`, "success", "Cập nhật thành công");

      // Update local detail state
      if (productDetail) {
        const updatedVariants = productDetail.variants.map((v) =>
          v.variant_id === editingVariant.variant_id ? { ...v, stock_quantity: valid.value! } : v
        );
        setProductDetail({ ...productDetail, variants: updatedVariants });
        setEditingVariant({ ...editingVariant, stock_quantity: valid.value });
      }

      // Refresh list
      handleRetry();
      setActiveProduct(null);
    } catch (err: unknown) {
      // Granular ownership & concurrency error handling (O-509)
      if (err instanceof AppError) {
        if (err.status === 403) {
          showToast("Bạn không có quyền cập nhật tồn kho cho sản phẩm này (403 Forbidden).", "error", "Truy cập bị từ chối");
          return;
        }
        if (err.status === 404) {
          showToast("Không tìm thấy sản phẩm hoặc biến thể trên hệ thống (404 Not Found).", "error", "Không tồn tại");
          return;
        }
        if (err.status === 409) {
          showToast("Dữ liệu tồn kho vừa thay đổi ở phiên khác (409 Conflict). Đang đồng bộ lại...", "info", "Xung đột dữ liệu");
          if (activeProduct) {
            handleOpenStockDialog(activeProduct);
          }
          handleRetry();
          return;
        }
      }
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

      {/* GAP-04 Notice Banner */}
      <div className="notice notice--warning" role="status">
        <Icon name="info" />
        <div>
          <strong>Chế độ cách ly gian hàng (GAP-04):</strong> Màn hình đang lọc sản phẩm theo gian hàng của bạn (Shop ID: <code>{sellerShopId}</code>). Chưa kết nối trực tiếp với endpoint public <code>GET /products</code> để tránh rò rỉ sản phẩm shop khác trong khi chờ backend triển khai endpoint seller-scoped <code>GET /seller/products</code>.
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
      ) : scopedProducts.length === 0 ? (
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
        <div className="space-y-4">
          {/* Controls: Search and Filter (O-508) */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="w-full sm:w-72">
                <TextInput
                  id="seller-product-search"
                  placeholder="Tìm theo tên hoặc ID sản phẩm..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <label htmlFor="stock-filter" className="font-semibold text-[var(--subtext)] whitespace-nowrap">
                  Tồn kho:
                </label>
                <select
                  id="stock-filter"
                  value={stockFilter}
                  onChange={(e) => {
                    setStockFilter(e.target.value as "all" | "in_stock" | "out_of_stock");
                    setPage(1);
                  }}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)]"
                >
                  <option value="all">Tất cả ({scopedProducts.length})</option>
                  <option value="in_stock">Còn hàng</option>
                  <option value="out_of_stock">Hết hàng</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-[var(--subtext)]">
              Tìm thấy <strong className="text-[var(--foreground)]">{filteredProducts.length}</strong> sản phẩm
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="surface-card p-8 text-center text-sm text-[var(--subtext)]">
              Không tìm thấy sản phẩm phù hợp với điều kiện tìm kiếm.
            </div>
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
                    {paginatedProducts.map((item) => {
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
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                item.total_stock > 10
                                  ? "bg-[var(--success-surface)] text-[var(--success)] border-[var(--success-border)]"
                                  : item.total_stock > 0
                                  ? "bg-[var(--warning-surface)] text-[var(--warning)] border-[var(--warning-border)]"
                                  : "bg-[var(--danger-surface)] text-[var(--danger)] border-[var(--danger-border)]"
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

              {/* Pagination bar (O-508) */}
              <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 bg-[var(--card-muted)]/30 text-xs">
                <span className="text-[var(--subtext)]">
                  Hiển thị {Math.min((currentPage - 1) * itemsPerPage + 1, filteredProducts.length)} - {Math.min(currentPage * itemsPerPage, filteredProducts.length)} trong số {filteredProducts.length} sản phẩm
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="h-7 px-2.5 text-xs"
                  >
                    Trước
                  </Button>
                  <span className="font-semibold text-[var(--foreground)] px-1">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="h-7 px-2.5 text-xs"
                  >
                    Sau
                  </Button>
                </div>
              </div>
            </div>
          )}
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
                  helpText="Nhập số lượng thực tế trong kho sẵn sàng để giao bán (số nguyên không âm)."
                  required
                >
                  <TextInput
                    id="variant-stock-input"
                    type="number"
                    step="1"
                    min="0"
                    value={stockInput}
                    onChange={(e) => setStockInput(e.target.value)}
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
