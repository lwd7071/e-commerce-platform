import { describe, it, expect } from 'vitest';
import {
  ProductImageEntity,
  buildProductImagePath,
  buildShopLogoPath,
} from '../../../src/modules/catalog/domain/media.ts';
import { CatalogMediaService } from '../../../src/modules/catalog/services/catalog-media.service.ts';
import { ValidationError } from '../../../src/modules/catalog/domain/errors.ts';

describe('Catalog Media Domain & Service (RB-MG11)', () => {
  const shopId = '11111111-1111-4111-a111-111111111111';
  const productId = '22222222-2222-4222-a222-222222222222';
  const imageId = '33333333-3333-4333-a333-333333333333';

  describe('ProductImageEntity & RB-MG11 Rule', () => {
    it('creates product image entity with valid sortOrder >= 0', () => {
      const img = new ProductImageEntity({
        imageId,
        productId,
        imageUrl: 'https://supabase.co/storage/v1/object/public/catalog-media/img1.jpg',
        sortOrder: 0,
      });

      expect(img.imageId).toBe(imageId);
      expect(img.productId).toBe(productId);
      expect(img.sortOrder).toBe(0);
      expect(img.imageUrl).toBe('https://supabase.co/storage/v1/object/public/catalog-media/img1.jpg');
    });

    it('[RB-MG11] rejects negative sortOrder (< 0) with VALIDATION_FAILED', () => {
      expect(() => {
        new ProductImageEntity({
          imageId,
          productId,
          imageUrl: 'https://example.com/img.jpg',
          sortOrder: -1,
        });
      }).toThrowError(ValidationError);
    });

    it('[RB-MG11] rejects float sortOrder (non-integer)', () => {
      expect(() => {
        new ProductImageEntity({
          imageId,
          productId,
          imageUrl: 'https://example.com/img.jpg',
          sortOrder: 1.5,
        });
      }).toThrowError(ValidationError);
    });

    it('rejects empty or whitespace imageUrl', () => {
      expect(() => {
        new ProductImageEntity({
          imageId,
          productId,
          imageUrl: '   ',
          sortOrder: 1,
        });
      }).toThrowError(ValidationError);
    });
  });

  describe('Media Storage Path Builders (Locked specification)', () => {
    it('builds standard product image storage path', () => {
      const path = buildProductImagePath(shopId, productId, imageId, 'webp');
      expect(path).toBe(`shops/${shopId}/products/${productId}/${imageId}.webp`);
    });

    it('defaults to jpg extension when not specified', () => {
      const path = buildProductImagePath(shopId, productId, imageId);
      expect(path).toBe(`shops/${shopId}/products/${productId}/${imageId}.jpg`);
    });

    it('builds standard shop logo storage path', () => {
      const path = buildShopLogoPath(shopId, 'png');
      expect(path).toBe(`shops/${shopId}/logo.png`);
    });

    it('rejects disallowed extension (.exe, .sh, .pdf) with ValidationError', () => {
      expect(() => buildProductImagePath(shopId, productId, imageId, 'exe')).toThrowError(ValidationError);
      expect(() => buildProductImagePath(shopId, productId, imageId, '.exe')).toThrowError(ValidationError);
      expect(() => buildProductImagePath(shopId, productId, imageId, 'sh')).toThrowError(ValidationError);
      expect(() => buildShopLogoPath(shopId, 'exe')).toThrowError(ValidationError);
    });

    it('normalizes allowed extensions with leading dot and mixed case', () => {
      expect(buildProductImagePath(shopId, productId, imageId, '.PNG')).toBe(
        `shops/${shopId}/products/${productId}/${imageId}.png`
      );
      expect(buildProductImagePath(shopId, productId, imageId, '.JPEG')).toBe(
        `shops/${shopId}/products/${productId}/${imageId}.jpeg`
      );
    });
  });

  describe('CatalogMediaService', () => {
    const mediaService = new CatalogMediaService('https://my-supabase.co/storage/v1/object/public/catalog-media');

    it('creates product image through service', () => {
      const img = mediaService.createProductImage({
        imageId,
        productId,
        imageUrl: 'https://my-supabase.co/storage/v1/object/public/catalog-media/test.jpg',
        sortOrder: 2,
      });
      expect(img.sortOrder).toBe(2);
    });

    it('resolves relative storage path to full public URL', () => {
      const path = `shops/${shopId}/products/${productId}/${imageId}.jpg`;
      const fullUrl = mediaService.resolvePublicUrl(path);
      expect(fullUrl).toBe(`https://my-supabase.co/storage/v1/object/public/catalog-media/${path}`);
    });

    it('keeps absolute HTTP/HTTPS URLs untouched', () => {
      const extUrl = 'https://res.cloudinary.com/demo/image.png';
      expect(mediaService.resolvePublicUrl(extUrl)).toBe(extUrl);
    });

    it('validates image metadata enforcing RB-MG11', () => {
      expect(() => {
        mediaService.validateImageMetadata({
          imageUrl: 'valid-url.jpg',
          sortOrder: -5,
        });
      }).toThrowError(ValidationError);
    });
  });
});
