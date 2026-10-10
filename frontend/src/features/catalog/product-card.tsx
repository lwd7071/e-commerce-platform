"use client";

import Image from "next/image";
import Link from "next/link";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import type { WireCatalogProductItem } from "@/lib/api/catalog.api";
import { TierBadge } from "@/components/ui/tier-badge";
import { Icon } from "@/components/ui/icon";
import { getQueryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-keys";
import { repositories } from "@/lib/repositories/repository-factory";

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

  const imageUrl = product.image_url?.trim();

  const handlePrefetch = () => {
    try {
      const queryClient = getQueryClient();
      queryClient.prefetchQuery({
        queryKey: queryKeys.catalog.detail(product.product_id),
        queryFn: () => repositories.catalog().getProductById(product.product_id),
        staleTime: 60 * 1000,
      });
    } catch {
      // Ignore prefetch error silently
    }
  };

  return (
    <article
      className="product-card group"
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
    >
      <Link
        href={`/products/${product.product_id}`}
        className="block focus-visible:outline-none"
        aria-label={`Chi tiết sản phẩm ${product.product_name}`}
      >
        <div className="product-card__media">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.product_name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="product-card__image"
              loading="lazy"
            />
          ) : (
            <div className="product-card__image-placeholder" aria-hidden="true">
              <Icon name="bag" className="h-9 w-9" />
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
              <span className="product-card__stock-badge">
                Hết hàng
              </span>
            </div>
          )}
          {categoryName && (
            <span className="product-card__category">
              {categoryName}
            </span>
          )}
        </div>
      </Link>

      <div className="product-card__body">
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

          <div className="product-card__footer">
          <div>
            <div className="product-card__price">
              {displayPrice}
            </div>
            <div className="product-card__availability">
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
