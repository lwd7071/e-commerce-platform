import Image from "next/image";
import Link from "next/link";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import type { WireCatalogProductItem } from "@/lib/api/catalog.api";
import { TierBadge } from "@/components/ui/tier-badge";

type ProductCardProps = {
  product: WireCatalogProductItem;
  categoryName?: string;
};

export function ProductCard({ product, categoryName }: ProductCardProps) {
  const isOutOfStock = product.total_stock <= 0;
  const isSinglePrice = product.min_price === product.max_price;
  const displayPrice = isSinglePrice
    ? moneyAdapter.formatVND(product.min_price)
    : `${moneyAdapter.formatVND(product.min_price)} - ${moneyAdapter.formatVND(product.max_price)}`;

  const fallbackImage = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600";
  const imageUrl = product.image_url && product.image_url.trim() !== "" ? product.image_url : fallbackImage;

  return (
    <article className="surface-card group flex flex-col overflow-hidden transition-shadow duration-200 hover:shadow-md">
      <Link
        href={`/products/${product.product_id}`}
        className="block focus-visible:outline-none"
        aria-label={`Chi tiết sản phẩm ${product.product_name}`}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-[var(--card-muted)]">
          <Image
            src={imageUrl}
            alt={product.product_name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
              <span className="rounded-full bg-[var(--danger)] px-3 py-1 text-xs font-bold text-white shadow-sm">
                Hết hàng
              </span>
            </div>
          )}
          {categoryName && (
            <span className="absolute top-2.5 left-2.5 rounded-md bg-[var(--card)]/90 px-2 py-0.5 text-[11px] font-semibold text-[var(--subtext)] shadow-xs backdrop-blur-xs">
              {categoryName}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          {product.shop_tier && product.shop_tier !== 'STANDARD' && (
            <div className="mb-1.5 flex items-center">
              <TierBadge tier={product.shop_tier} />
            </div>
          )}
          <h3 className="line-clamp-2 text-sm font-semibold text-[var(--foreground)] transition-colors group-hover:text-[var(--primary-active)]">
            <Link href={`/products/${product.product_id}`}>
              {product.product_name}
            </Link>
          </h3>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-[var(--border)] pt-3">
          <div>
            <div className="text-base font-bold text-[var(--primary-active)]">
              {displayPrice}
            </div>
            <div className="text-xs text-[var(--subtext)]">
              {isOutOfStock ? "Tạm hết hàng" : `Còn ${product.total_stock} trong kho`}
            </div>
          </div>

          <Link
            href={`/products/${product.product_id}`}
            className="button button--secondary h-8 px-3 text-xs font-semibold"
            aria-label={`Xem lựa chọn cho ${product.product_name}`}
          >
            Xem
          </Link>
        </div>
      </div>
    </article>
  );
}
