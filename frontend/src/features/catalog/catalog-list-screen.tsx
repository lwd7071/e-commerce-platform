"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { repositories } from "@/lib/repositories/repository-factory";
import { categoryAdapter, type CategoryItem } from "@/lib/adapters/category.adapter";
import type { WireCatalogProductItem, GetProductsParams } from "@/lib/api/catalog.api";
import { ProductCard } from "./product-card";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/data-states";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

type SortOption = "created_at_desc" | "price_asc" | "price_desc";

type Props = {
  initialSearch?: string;
  initialCategoryId?: string;
};

export function CatalogListScreen({ initialSearch = "", initialCategoryId = "" }: Props) {
  const [products, setProducts] = useState<WireCatalogProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialCategoryId);
  const [sort, setSort] = useState<SortOption>("created_at_desc");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const activeQueryRef = useRef(0);
  const [, startTransition] = useTransition();

  // Load verified categories on mount
  useEffect(() => {
    categoryAdapter.getCategories().then((cats) => {
      setCategories(cats);
    }).catch(() => {
      setCategories([]);
    });
  }, []);

  const fetchProducts = async (params: GetProductsParams, append = false) => {
    const queryId = ++activeQueryRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const envelope = await repositories.catalog().getProductsPaginated(params);
      // Discard stale out-of-order response if another query was initiated
      if (queryId !== activeQueryRef.current) {
        return;
      }

      const items = envelope.data || [];
      const meta = envelope.meta;

      if (append) {
        setProducts((prev) => [...prev, ...items]);
      } else {
        setProducts(items);
      }

      setNextCursor(meta?.next_cursor ?? null);
      setHasMore(Boolean(meta?.has_more));
    } catch (err: unknown) {
      if (queryId !== activeQueryRef.current) {
        return;
      }
      const msg = err instanceof Error ? err.message : "Không thể tải danh sách sản phẩm.";
      setError(msg);
    } finally {
      if (queryId === activeQueryRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const params: GetProductsParams = {
      limit: 20,
      sort,
    };
    if (search.trim()) params.search = search.trim();
    if (selectedCategory) params.category_id = selectedCategory;
    if (minPrice.trim() && !isNaN(Number(minPrice))) params.min_price = minPrice.trim();
    if (maxPrice.trim() && !isNaN(Number(maxPrice))) params.max_price = maxPrice.trim();

    startTransition(() => {
      fetchProducts(params, false);
    });
  }, [search, selectedCategory, sort, minPrice, maxPrice]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedCategory("");
    setSort("created_at_desc");
    setMinPrice("");
    setMaxPrice("");
  };

  const handleLoadMore = () => {
    if (!hasMore || !nextCursor) return;
    const params: GetProductsParams = {
      limit: 20,
      sort,
      cursor: nextCursor,
    };
    if (search.trim()) params.search = search.trim();
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
          <input
            name="q"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-control pl-10 pr-4"
            placeholder="Tìm theo tên sản phẩm..."
            aria-label="Tìm theo tên sản phẩm"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtext)]">
            <Icon name="search" />
          </span>
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
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
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
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
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
              className="form-control h-8 w-28 text-xs px-2"
              aria-label="Giá thấp nhất"
            />
            <span className="text-[var(--subtext)]">-</span>
            <input
              type="number"
              min="0"
              placeholder="Đến (₫)"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="form-control h-8 w-28 text-xs px-2"
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
              className="form-control h-8 text-xs py-0 px-2"
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
              search: search || undefined,
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
