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
};

export function CatalogListScreen({
  initialSearch = "",
  initialCategoryId = "",
  initialSort = "created_at_desc",
  initialMinPrice = "",
  initialMaxPrice = "",
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
      });
      const queryStr = urlParams.toString();
      const nextUrl = queryStr ? `${pathname}?${queryStr}` : pathname;
      window.history.replaceState(null, "", nextUrl);
    }

    startTransition(() => {
      fetchProducts(params, false);
    });
  }, [debouncedSearch, selectedCategory, sort, minPrice, maxPrice, pathname]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDebouncedSearch(searchInput.trim());
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setSelectedCategory("");
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
    if (minPrice.trim()) params.min_price = minPrice.trim();
    if (maxPrice.trim()) params.max_price = maxPrice.trim();

    fetchProducts(params, true);
  };

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      {/* Header & Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Dino Catalog</p>
          <h1 className="page-title">Khám Phá Sản Phẩm</h1>
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

      {/* Filter and Sort Toolbar */}
      <div className="surface-card flex flex-wrap items-center justify-between gap-4 p-4">
        {/* Category Chips (GAP-05: safe fallback if no verified categories) */}
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("")}
              className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                selectedCategory === ""
                  ? "bg-[var(--primary-active)] text-white"
                  : "bg-[var(--card-muted)] text-[var(--subtext)] hover:text-[var(--foreground)]"
              }`}
            >
              Tất cả
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-[var(--primary-active)] text-white"
                    : "bg-[var(--card-muted)] text-[var(--subtext)] hover:text-[var(--foreground)]"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {/* Price Range Filter Inputs */}
          <div className="flex items-center gap-1.5 text-xs">
            <input
              type="number"
              min="0"
              placeholder="Giá từ (₫)"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="form-control min-h-[44px] h-11 w-28 text-xs px-2.5"
              aria-label="Giá thấp nhất"
            />
            <span className="text-[var(--subtext)]">-</span>
            <input
              type="number"
              min="0"
              placeholder="Đến (₫)"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="form-control min-h-[44px] h-11 w-28 text-xs px-2.5"
              aria-label="Giá cao nhất"
            />
          </div>

          {/* Sort Selection */}
          <div className="flex items-center gap-2">
            <label htmlFor="catalog-sort" className="text-xs font-medium text-[var(--subtext)]">
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
        </div>
      </div>

      {/* Main Content Area */}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
  );
}
