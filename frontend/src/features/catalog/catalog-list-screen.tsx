"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { usePathname } from "next/navigation";
import { repositories } from "@/lib/repositories/repository-factory";
import { categoryAdapter, type CategoryItem } from "@/lib/adapters/category.adapter";
import type { WireCatalogProductItem, GetProductsParams } from "@/lib/api/catalog.api";
import { ProductCard } from "./product-card";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/data-states";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import {
  buildCatalogUrlSearchParams,
  createCatalogQueryCoordinator,
} from "./catalog-query-engine";

type SortOption = "created_at_desc" | "price_asc" | "price_desc";

type Props = {
  initialSearch?: string;
  initialCategoryId?: string;
  initialSort?: SortOption;
  initialMinPrice?: string;
  initialMaxPrice?: string;
  initialShopTier?: string;
};

function isGenuineConsumerCategory(name: string): boolean {
  if (!name) return false;
  // Lọc sạch danh mục do seed/test sinh ngẫu nhiên
  if (/\d{5,}/.test(name)) return false;
  if (/^Cat\s+[a-f0-9]{6,}/i.test(name)) return false;
  if (/^(E2E|Mock|Seed|Test)\b/i.test(name)) return false;
  return true;
}

export function CatalogListScreen({
  initialSearch = "",
  initialCategoryId = "",
  initialSort = "created_at_desc",
  initialMinPrice = "",
  initialMaxPrice = "",
  initialShopTier = "",
}: Props) {
  const pathname = usePathname();

  const [products, setProducts] = useState<WireCatalogProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Controlled search input & debounced search term (300ms debounce per user flow)
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

  // Filters state
  const [selectedCategory, setSelectedCategory] = useState(initialCategoryId);
  const [selectedTier, setSelectedTier] = useState<string>(initialShopTier);
  const [sort, setSort] = useState<SortOption>(initialSort);
  const [minPrice, setMinPrice] = useState(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const coordinatorRef = useRef(createCatalogQueryCoordinator());
  const [, startTransition] = useTransition();

  // 300ms search input debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load categories on mount (safe live fallback if unverified per GAP-05)
  useEffect(() => {
    categoryAdapter.getCategories().then((cats) => {
      setCategories(cats);
    }).catch(() => {
      setCategories([]);
    });
  }, []);

  const fetchProducts = async (params: GetProductsParams, append = false) => {
    const coordinator = coordinatorRef.current;
    const queryId = coordinator.startQuery();

    setIsLoading(true);
    setError(null);
    try {
      const envelope = await repositories.catalog().getProductsPaginated(params);
      // Discard stale out-of-order responses if a newer query was initiated
      if (!coordinator.isLatest(queryId)) {
        return;
      }

      const items = envelope.data || [];
      const meta = envelope.meta;

      if (append) {
        // Guarantee deduplicated items ("cursor không trùng" per B-301 acceptance)
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.product_id));
          const uniqueItems = items.filter((item) => !existingIds.has(item.product_id));
          return [...prev, ...uniqueItems];
        });
      } else {
        setProducts(items);
      }

      setNextCursor(meta?.next_cursor ?? null);
      setHasMore(Boolean(meta?.has_more));
    } catch (err: unknown) {
      if (!coordinator.isLatest(queryId)) {
        return;
      }
      const msg = err instanceof Error ? err.message : "Không thể tải danh sách sản phẩm.";
      setError(msg);
    } finally {
      if (coordinator.isLatest(queryId)) {
        setIsLoading(false);
      }
    }
  };

  // Trigger query & sync active filters to browser URL (B-301: "URL giữ filter")
  useEffect(() => {
    const params: GetProductsParams = {
      limit: 20,
      sort,
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (selectedCategory) params.category_id = selectedCategory;
    if (selectedTier === "STANDARD" || selectedTier === "PREFERRED" || selectedTier === "MALL") {
      params.shop_tier = selectedTier;
    }
    if (minPrice.trim() && !isNaN(Number(minPrice))) params.min_price = minPrice.trim();
    if (maxPrice.trim() && !isNaN(Number(maxPrice))) params.max_price = maxPrice.trim();

    // Sync URL without triggering full page reload
    if (typeof window !== "undefined") {
      const urlParams = buildCatalogUrlSearchParams({
        search: debouncedSearch,
        categoryId: selectedCategory,
        sort,
        minPrice,
        maxPrice,
        shopTier: selectedTier,
      });
      const queryStr = urlParams.toString();
      const nextUrl = queryStr ? `${pathname}?${queryStr}` : pathname;
      window.history.replaceState(null, "", nextUrl);
    }

    startTransition(() => {
      fetchProducts(params, false);
    });
  }, [debouncedSearch, selectedCategory, selectedTier, sort, minPrice, maxPrice, pathname]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDebouncedSearch(searchInput.trim());
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setSelectedCategory("");
    setSelectedTier("");
    setSort("created_at_desc");
    setMinPrice("");
    setMaxPrice("");

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", pathname);
    }
  };

  const handleLoadMore = () => {
    if (!hasMore || !nextCursor) return;
    const params: GetProductsParams = {
      limit: 20,
      sort,
      cursor: nextCursor,
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (selectedCategory) params.category_id = selectedCategory;
    if (selectedTier === "STANDARD" || selectedTier === "PREFERRED" || selectedTier === "MALL") {
      params.shop_tier = selectedTier;
    }
    if (minPrice.trim()) params.min_price = minPrice.trim();
    if (maxPrice.trim()) params.max_price = maxPrice.trim();

    fetchProducts(params, true);
  };

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Lọc danh mục tiêu dùng thực tế (loại bỏ dữ liệu seed/test ngẫu nhiên)
  const displayCategories = (() => {
    const cleaned = categories.filter((c) => isGenuineConsumerCategory(c.name));
    return cleaned.length > 0 ? cleaned : categories;
  })();

  const hasActiveFilters = Boolean(
    selectedCategory ||
    selectedTier ||
    minPrice.trim() ||
    maxPrice.trim() ||
    debouncedSearch
  );

  return (
    <div className="space-y-6">
      {/* Header & Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[var(--border)]">
        <div>
          <h1 className="page-title text-2xl font-bold tracking-tight text-[var(--foreground)]">Khám Phá Sản Phẩm</h1>
          <p className="text-xs text-[var(--subtext)] mt-1">
            Hàng chính hãng, giá ưu đãi và giao hàng nhanh toàn quốc
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--subtext)] flex items-center justify-center">
            <Icon name="search" className="w-4 h-4" />
          </span>
          <input
            name="q"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="form-control pr-4"
            style={{ paddingLeft: "42px" }}
            placeholder="Tìm theo tên sản phẩm..."
            aria-label="Tìm theo tên sản phẩm"
          />
        </form>
      </div>

      {/* Main 2-Column Commerce Layout (Phương án 2: Classic Commerce Split) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar Filters (Cột trái ~260px) */}
        <aside
          role="complementary"
          aria-label="Bộ lọc tìm kiếm"
          className="lg:col-span-3 surface-card p-4 rounded-xl border border-[var(--border)] space-y-5 lg:sticky lg:top-24"
        >
          {/* Header Sidebar */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <span className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
              <svg aria-hidden="true" className="w-4 h-4 text-[var(--primary-active)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Bộ lọc tìm kiếm
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-[var(--primary-active)] hover:underline"
                aria-label="Xóa tất cả bộ lọc"
              >
                Xóa tất cả
              </button>
            )}
          </div>

          {/* 1. Danh mục ngành hàng */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--subtext)]">
                Danh mục
              </span>
              <span className="text-[11px] text-[var(--subtext)] font-medium">({displayCategories.length})</span>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setSelectedCategory("")}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between min-h-[38px] ${
                  selectedCategory === ""
                    ? "bg-[var(--primary-active)] text-white font-bold"
                    : "text-[var(--foreground)] hover:bg-[var(--card-muted)]"
                }`}
              >
                <span>Tất cả</span>
                {selectedCategory === "" && <Icon name="check" className="w-3.5 h-3.5 shrink-0 ml-1" />}
              </button>

              {displayCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between min-h-[38px] ${
                    selectedCategory === cat.id
                      ? "bg-[var(--primary-active)] text-white font-bold"
                      : "text-[var(--foreground)] hover:bg-[var(--card-muted)]"
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  {selectedCategory === cat.id && <Icon name="check" className="w-3.5 h-3.5 shrink-0 ml-1" />}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Nơi bán / Phân hạng shop */}
          <div className="space-y-2 pt-3 border-t border-[var(--border)]">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--subtext)] block">
              Hạng gian hàng
            </span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc theo hạng shop">
              <button
                type="button"
                onClick={() => setSelectedTier("")}
                className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  selectedTier === ""
                    ? "bg-[var(--primary-active)] text-white"
                    : "bg-[var(--card-muted)] text-[var(--subtext)] hover:text-[var(--foreground)]"
                }`}
              >
                Tất cả shop
              </button>
              <button
                type="button"
                onClick={() => setSelectedTier("MALL")}
                className={`min-h-[44px] inline-flex items-center gap-1.5 justify-center rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  selectedTier === "MALL"
                    ? "bg-[var(--danger)] text-white"
                    : "bg-[var(--card-muted)] text-[var(--subtext)] hover:text-[var(--foreground)]"
                }`}
              >
                Dino Mall
              </button>
              <button
                type="button"
                onClick={() => setSelectedTier("PREFERRED")}
                className={`min-h-[44px] inline-flex items-center gap-1.5 justify-center rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  selectedTier === "PREFERRED"
                    ? "bg-amber-600 text-white"
                    : "bg-[var(--card-muted)] text-[var(--subtext)] hover:text-[var(--foreground)]"
                }`}
              >
                Shop Yêu thích
              </button>
            </div>
          </div>

          {/* 3. Khoảng giá */}
          <div className="space-y-2 pt-3 border-t border-[var(--border)]">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--subtext)] block">
              Khoảng giá (₫)
            </span>
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="number"
                min="0"
                placeholder="Giá từ (₫)"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="form-control min-h-[44px] h-11 w-full text-xs px-2.5"
                aria-label="Giá thấp nhất"
              />
              <span className="text-[var(--subtext)]">-</span>
              <input
                type="number"
                min="0"
                placeholder="Đến (₫)"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="form-control min-h-[44px] h-11 w-full text-xs px-2.5"
                aria-label="Giá cao nhất"
              />
            </div>
            {(minPrice || maxPrice) && (
              <button
                type="button"
                onClick={() => { setMinPrice(""); setMaxPrice(""); }}
                className="text-[11px] text-[var(--primary-active)] hover:underline block pt-1"
              >
                Xóa khoảng giá
              </button>
            )}
          </div>
        </aside>

        {/* Main Products Area (Cột phải lg:col-span-9) */}
        <div className="lg:col-span-9 space-y-4">
          {/* Quick Sort Strip */}
          <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--border)]">
            <div className="flex items-center gap-2">
              <label htmlFor="catalog-sort" className="text-xs font-medium text-[var(--subtext)] shrink-0">
                Sắp xếp:
              </label>
              <select
                id="catalog-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="form-control min-h-[44px] h-11 text-xs py-0 px-2.5"
              >
                <option value="created_at_desc">Mới nhất</option>
                <option value="price_asc">Giá tăng dần</option>
                <option value="price_desc">Giá giảm dần</option>
              </select>
            </div>

            <div className="text-xs text-[var(--subtext)] font-medium">
              {products.length > 0 ? (
                <span>Hiển thị <strong className="text-[var(--foreground)]">{products.length}</strong> sản phẩm</span>
              ) : null}
            </div>
          </div>

          {/* Active Filter Tags */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
              <span className="text-[var(--subtext)] font-medium">Đang lọc:</span>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory("")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--primary-surface)] text-[var(--primary-active)] font-medium hover:opacity-80"
                >
                  <span>{categoryMap.get(selectedCategory) || "Danh mục"}</span>
                  <span className="font-bold">×</span>
                </button>
              )}
              {selectedTier && (
                <button
                  type="button"
                  onClick={() => setSelectedTier("")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--primary-surface)] text-[var(--primary-active)] font-medium hover:opacity-80"
                >
                  <span>{selectedTier === "MALL" ? "Dino Mall" : "Shop Yêu thích"}</span>
                  <span className="font-bold">×</span>
                </button>
              )}
              {(minPrice || maxPrice) && (
                <button
                  type="button"
                  onClick={() => { setMinPrice(""); setMaxPrice(""); }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--primary-surface)] text-[var(--primary-active)] font-medium hover:opacity-80"
                >
                  <span>{minPrice ? `${minPrice}₫` : "0₫"} - {maxPrice ? `${maxPrice}₫` : "∞"}</span>
                  <span className="font-bold">×</span>
                </button>
              )}
            </div>
          )}

          {/* Product Grid / States */}
          {error ? (
            <ErrorState
              title="Không thể tải sản phẩm"
              description={error}
              onRetry={() => {
                fetchProducts({
                  limit: 20,
                  sort,
                  search: debouncedSearch || undefined,
                  category_id: selectedCategory || undefined,
                });
              }}
            />
          ) : isLoading && products.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="surface-card flex flex-col p-4 space-y-3">
                  <Skeleton height={200} className="w-full rounded-lg" />
                  <Skeleton height={18} className="w-3/4" />
                  <Skeleton height={14} className="w-1/2" />
                  <Skeleton height={24} className="w-1/3" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon="bag"
              title="Không tìm thấy sản phẩm"
              description="Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc giá và danh mục."
              action={{
                label: "Xóa bộ lọc",
                onClick: handleResetFilters,
              }}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.product_id}
                    product={product}
                    categoryName={categoryMap.get(product.category_id)}
                  />
                ))}
              </div>

              {/* Load More Button - only displayed when backend indicates has_more and provides valid next_cursor */}
              {hasMore && nextCursor && (
                <div className="flex justify-center pt-6">
                  <Button
                    variant="secondary"
                    disabled={isLoading}
                    onClick={handleLoadMore}
                  >
                    {isLoading ? "Đang tải thêm..." : "Tải thêm sản phẩm"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
