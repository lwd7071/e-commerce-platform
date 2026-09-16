import type { UUID, DecimalString, VariantStatus } from '../domain/types';

export interface VariantPriceAndStockDTO {
  variantId: UUID;
  productId: UUID;
  productName?: string;
  variantName: string;
  variantValue: string;
  price: DecimalString;
  salePrice?: DecimalString | null;
  effectivePrice: DecimalString;
  stockQuantity: number;
  status: VariantStatus;
}

export interface LockVariantResultDTO {
  variantId: UUID;
  requestedQuantity: number;
  priceSnapshot: DecimalString;
  originalPriceSnapshot?: DecimalString;
  salePriceSnapshot?: DecimalString | null;
  remainingStock: number;
}

export interface ICatalogPort {
  getVariantPriceAndStock(variantId: UUID): Promise<VariantPriceAndStockDTO>;
  lockVariant(variantId: UUID, quantity: number): Promise<LockVariantResultDTO>;
  checkShopActive(shopId: UUID): Promise<boolean>;
}
