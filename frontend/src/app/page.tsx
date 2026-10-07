import { CatalogListScreen } from "@/features/catalog/catalog-list-screen";
import { Icon } from "@/components/ui/icon";
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
    <div className="space-y-12">
      <HomeMarketplaceContent />

      {/* Value Badges */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="surface-card flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-surface)] text-[var(--primary-active)]">
            <Icon name="check" className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--foreground)]">100% Chính Hãng</h2>
            <p className="text-xs text-[var(--subtext)]">Cam kết hoàn tiền nếu sản phẩm không đúng chất lượng</p>
          </div>
        </div>

        <div className="surface-card flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-surface)] text-[var(--primary-active)]">
            <Icon name="bag" className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--foreground)]">Giao Hàng Siêu Tốc</h2>
            <p className="text-xs text-[var(--subtext)]">Nhận hàng tận nơi với dịch vụ giao hàng chuyên nghiệp</p>
          </div>
        </div>

        <div className="surface-card flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-surface)] text-[var(--primary-active)]">
            <Icon name="info" className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--foreground)]">Hỗ Trợ 24/7</h2>
            <p className="text-xs text-[var(--subtext)]">Đội ngũ tư vấn tận tâm hỗ trợ đổi trả dễ dàng</p>
          </div>
        </div>
      </section>

      {/* Catalog Listing Component */}
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
