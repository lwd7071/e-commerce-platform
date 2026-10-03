import { CatalogListScreen } from "@/features/catalog/catalog-list-screen";
import type { Metadata } from "next";

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
  }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const initialSearch = resolvedParams.search || resolvedParams.q || "";
  const initialCategory = resolvedParams.category_id || resolvedParams.category || "";

  return (
    <div className="py-6">
      <CatalogListScreen
        initialSearch={initialSearch}
        initialCategoryId={initialCategory}
      />
    </div>
  );
}
