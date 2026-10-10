import { CatalogListScreen } from "@/features/catalog/catalog-list-screen";
import { HomeMarketplaceContent } from "@/features/catalog/home-marketplace-content";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    q?: string;
    search?: string;
    category_id?: string;
  }>;
};

export default async function HomePage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const initialSearch = resolvedParams.search || resolvedParams.q || "";
  const initialCategory = resolvedParams.category_id || "";

  return (
    <div className="home-storefront">
      <HomeMarketplaceContent />
      <section className="pt-2">
        <CatalogListScreen
          initialSearch={initialSearch}
          initialCategoryId={initialCategory}
        />
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] pt-8 pb-4 text-center text-xs text-[var(--subtext)]">
        <p>© 2026 Dino E-Commerce Platform. Nền tảng thương mại điện tử đa kênh.</p>
      </footer>
    </div>
  );
}
