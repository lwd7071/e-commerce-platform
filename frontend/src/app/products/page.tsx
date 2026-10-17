import { Suspense } from "react";
import { CatalogListScreen } from "@/features/catalog/catalog-list-screen";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tất cả sản phẩm",
  description: "Khám phá danh mục sản phẩm phong phú và chất lượng trên Dino.",
};

type Props = {
  searchParams: Promise<{
    q?: string;
    search?: string;
    category?: string;
    category_id?: string;
    sort?: "created_at_desc" | "price_asc" | "price_desc";
    min_price?: string;
    max_price?: string;
    shop_tier?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const initialSearch = resolvedParams.search || resolvedParams.q || "";
  const initialCategory = resolvedParams.category_id || resolvedParams.category || "";
  const initialSort = resolvedParams.sort || "created_at_desc";
  const initialMinPrice = resolvedParams.min_price || "";
  const initialMaxPrice = resolvedParams.max_price || "";
  const initialShopTier = resolvedParams.shop_tier || "";

  return (
    <div className="py-6">
      <Suspense fallback={<div className="container py-8 text-center text-sm text-[var(--subtext)]">Đang tải danh sách sản phẩm...</div>}>
        <CatalogListScreen
          initialSearch={initialSearch}
          initialCategoryId={initialCategory}
          initialSort={initialSort}
          initialMinPrice={initialMinPrice}
          initialMaxPrice={initialMaxPrice}
          initialShopTier={initialShopTier}
        />
      </Suspense>
    </div>
  );
}
