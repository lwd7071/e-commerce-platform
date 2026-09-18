import type { UUID, DecimalString, VariantStatus } from '../domain/types.ts';

export interface VariantPriceAndStockDTO {
  variantId: UUID;
  productId: UUID;
  productName?: string;
  shopId?: UUID;
  shopOwnerId?: UUID;
  variantName: string;
  variantValue: string | null;
  price: DecimalString;
  stockQuantity: number;
  status: VariantStatus;
}

export function formatVariantSnapshot(variant: Pick<VariantPriceAndStockDTO, 'variantName' | 'variantValue'>): string {
  const name = variant.variantName.trim();
  const value = variant.variantValue?.trim();
  const snapshot = value ? `${name}: ${value}` : name;
  return snapshot.slice(0, 255);
}

export interface LockVariantResultDTO {
  variantId: UUID;
  requestedQuantity: number;
  priceSnapshot: DecimalString;
  remainingStock: number;
}

export interface ICatalogPort {
  getVariantPriceAndStock(variantId: UUID): Promise<VariantPriceAndStockDTO>;
  lockVariant(variantId: UUID, quantity: number): Promise<LockVariantResultDTO>;
  checkShopActive(shopId: UUID): Promise<boolean>;
}
