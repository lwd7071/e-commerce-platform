"use client";

import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/data-states";
import { TierBadge } from "@/components/ui/tier-badge";
import { QueryProvider } from "@/lib/query/query-provider";
import { queryKeys } from "@/lib/query/query-keys";
import { repositories } from "@/lib/repositories/repository-factory";
import { ProductCard } from "./product-card";

export function ShopStorefrontScreen({ shopId }: { shopId: string }) {
  return <QueryProvider><ShopStorefrontContent shopId={shopId} /></QueryProvider>;
}

function ShopStorefrontContent({ shopId }: { shopId: string }) {
  const shopQuery = useQuery({
    queryKey: queryKeys.catalog.shop(shopId),
    queryFn: () => repositories.catalog().getPublicShop(shopId),
    retry: false,
  });
  const productsQuery = useInfiniteQuery({
    queryKey: queryKeys.catalog.list({ shop_id: shopId }),
    queryFn: ({ pageParam }) => repositories.catalog().getProductsPaginated({
      shop_id: shopId,
      limit: 20,
      sort: "created_at_desc",
      ...(pageParam ? { cursor: pageParam } : {}),
    }),
    initialPageParam: null as string | null,
    getNextPageParam: lastPage => lastPage.meta?.has_more ? lastPage.meta.next_cursor ?? undefined : undefined,
    enabled: shopQuery.isSuccess,
    retry: false,
  });

  if (shopQuery.isLoading || (shopQuery.isSuccess && productsQuery.isLoading)) {
    return <div className="space-y-6" role="status" aria-label="Đang tải gian hàng">
      <Skeleton height={120} className="w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={270} className="rounded-xl" />)}</div>
    </div>;
  }

  if (shopQuery.isError) {
    return <ErrorState title="Không tìm thấy gian hàng" description="Gian hàng này không còn hoạt động hoặc không tồn tại." onRetry={() => { void shopQuery.refetch(); }} />;
  }

  if (productsQuery.isError) {
    return <ErrorState title="Chưa tải được sản phẩm của shop" onRetry={() => { void productsQuery.refetch(); }} />;
  }

  if (!shopQuery.data) return null;
  const products = productsQuery.data?.pages.flatMap(page => page.data ?? []) ?? [];

  return <div className="space-y-7">
    <nav aria-label="Điều hướng phân cấp" className="flex items-center gap-2 text-sm text-[var(--subtext)]">
      <Link href="/" className="rounded-md hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary-active)]">Trang chủ</Link>
      <span aria-hidden="true">/</span>
      <Link href="/products" className="rounded-md hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary-active)]">Sản phẩm</Link>
      <span aria-hidden="true">/</span>
      <span className="font-medium text-[var(--foreground)]" aria-current="page">{shopQuery.data.shop_name}</span>
    </nav>

    <header className="surface-card border-2 border-[var(--border)] p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--primary-active)]">Gian hàng</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl">{shopQuery.data.shop_name}</h1>
        {shopQuery.data.shop_tier !== "STANDARD" && <TierBadge tier={shopQuery.data.shop_tier} />}
      </div>
      <p className="mt-2 text-sm text-[var(--subtext)]">Sản phẩm đang được bán tại gian hàng này.</p>
    </header>

    <section aria-labelledby="shop-products-title" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--primary-active)]">Khám phá gian hàng</p><h2 id="shop-products-title" className="mt-1 text-xl font-bold text-[var(--foreground)]">Sản phẩm của shop</h2></div>
        <span className="text-sm text-[var(--subtext)]">Đang hiển thị {products.length}</span>
      </div>
      {products.length ? <>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map(product => <ProductCard key={product.product_id} product={product} />)}
        </div>
        {productsQuery.hasNextPage && <div className="flex justify-center"><Button variant="secondary" loading={productsQuery.isFetchingNextPage} onClick={() => { void productsQuery.fetchNextPage(); }}>Xem thêm sản phẩm</Button></div>}
      </> : <EmptyState title="Shop chưa có sản phẩm đang bán" description="Các sản phẩm mới của shop sẽ xuất hiện tại đây." icon="bag" />}
    </section>
  </div>;
}
