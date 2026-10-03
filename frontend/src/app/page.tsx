import Link from "next/link";
import { CatalogListScreen } from "@/features/catalog/catalog-list-screen";
import { Icon } from "@/components/ui/icon";

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
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[var(--primary-surface)] to-[var(--card)] border border-[var(--primary-border)] p-8 md:p-14 text-center">
        <div className="mx-auto max-w-3xl space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--card)] px-3.5 py-1 text-xs font-bold text-[var(--primary-active)] border border-[var(--primary-border)] shadow-xs">
            ✨ Mua sắm thông minh cùng Dino
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[var(--foreground)]">
            Khám phá hàng ngàn sản phẩm chất lượng cao
          </h1>
          <p className="text-sm md:text-base text-[var(--subtext)] max-w-xl mx-auto">
            Hàng chính hãng từ các nhà bán uy tín, thanh toán an toàn và giao vận nhanh chóng toàn quốc.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/products"
              className="button button--primary h-11 px-6 text-sm font-bold shadow-md"
            >
              Xem tất cả sản phẩm
            </Link>
            <Link
              href="/seller/products"
              className="button button--secondary h-11 px-6 text-sm font-semibold"
            >
              Kênh Người Bán
            </Link>
          </div>
        </div>
      </section>

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
