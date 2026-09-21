import type { UUID, ProductImage } from '../domain/types.ts';
import {
  ProductImageEntity,
  buildProductImagePath,
  buildShopLogoPath,
} from '../domain/media.ts';

export interface ICatalogMediaService {
  createProductImage(params: {
    imageId: UUID;
    productId: UUID;
    imageUrl: string;
    sortOrder: number;
  }): ProductImage;
  generateProductStoragePath(
    shopId: UUID,
    productId: UUID,
    imageId: UUID,
    extension?: string
  ): string;
  generateShopLogoStoragePath(shopId: UUID, extension?: string): string;
  resolvePublicUrl(storagePathOrUrl: string, bucketBaseUrl?: string): string;
  validateImageMetadata(image: { imageUrl: string; sortOrder: number }): void;
}

/**
 * CatalogMediaService
 * Quản lý logic đường dẫn lưu trữ (Storage Path) và chuẩn hóa media cho Catalog.
 * Sẵn sàng kết nối Supabase Storage Bucket khi Người 2 hoàn thành Storage Policy.
 */
export class CatalogMediaService implements ICatalogMediaService {
  private defaultBucketUrl: string;

  constructor(defaultBucketUrl: string = 'https://supabase.co/storage/v1/object/public/catalog-media') {
    this.defaultBucketUrl = defaultBucketUrl.replace(/\/+$/, '');
  }

  public createProductImage(params: {
    imageId: UUID;
    productId: UUID;
    imageUrl: string;
    sortOrder: number;
  }): ProductImage {
    const entity = new ProductImageEntity(params);
    return {
      imageId: entity.imageId,
      productId: entity.productId,
      imageUrl: entity.imageUrl,
      sortOrder: entity.sortOrder,
    };
  }

  public generateProductStoragePath(
    shopId: UUID,
    productId: UUID,
    imageId: UUID,
    extension: string = 'jpg'
  ): string {
    return buildProductImagePath(shopId, productId, imageId, extension);
  }

  public generateShopLogoStoragePath(shopId: UUID, extension: string = 'png'): string {
    return buildShopLogoPath(shopId, extension);
  }

  public resolvePublicUrl(storagePathOrUrl: string, bucketBaseUrl?: string): string {
    if (!storagePathOrUrl) return '';
    if (storagePathOrUrl.startsWith('http://') || storagePathOrUrl.startsWith('https://')) {
      return storagePathOrUrl;
    }
    const base = (bucketBaseUrl ?? this.defaultBucketUrl).replace(/\/+$/, '');
    const cleanPath = storagePathOrUrl.replace(/^\/+/, '');
    return `${base}/${cleanPath}`;
  }

  public validateImageMetadata(image: { imageUrl: string; sortOrder: number }): void {
    // Tận dụng kiểm tra RB-MG11 của ProductImageEntity
    new ProductImageEntity({
      imageId: '00000000-0000-0000-0000-000000000000',
      productId: '00000000-0000-0000-0000-000000000000',
      imageUrl: image.imageUrl,
      sortOrder: image.sortOrder,
    });
  }
}
