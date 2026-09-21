import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ProductImageEntity,
  buildProductImagePath,
  buildShopLogoPath,
} from '../../../src/modules/catalog/domain/media.ts';
import { CatalogMediaService } from '../../../src/modules/catalog/services/catalog-media.service.ts';
import { ValidationError } from '../../../src/modules/catalog/domain/errors.ts';

describe('Catalog Media Domain & Service (Node native spec)', () => {
  const shopId = '11111111-1111-4111-a111-111111111111';
  const productId = '22222222-2222-4222-a222-222222222222';
  const imageId = '33333333-3333-4333-a333-333333333333';

  it('creates product image entity with valid sortOrder >= 0', () => {
    const img = new ProductImageEntity({
      imageId,
      productId,
      imageUrl: 'https://supabase.co/storage/v1/object/public/catalog-media/img1.jpg',
      sortOrder: 0,
    });

    assert.strictEqual(img.imageId, imageId);
    assert.strictEqual(img.productId, productId);
    assert.strictEqual(img.sortOrder, 0);
  });

  it('[RB-MG11] rejects negative sortOrder (< 0) with VALIDATION_FAILED', () => {
    assert.throws(
      () => {
        new ProductImageEntity({
          imageId,
          productId,
          imageUrl: 'https://example.com/img.jpg',
          sortOrder: -1,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.strictEqual((err as ValidationError).code, 'VALIDATION_FAILED');
        return true;
      }
    );
  });

  it('builds standard storage paths according to locked specification', () => {
    const productPath = buildProductImagePath(shopId, productId, imageId, 'png');
    assert.strictEqual(productPath, `shops/${shopId}/products/${productId}/${imageId}.png`);

    const logoPath = buildShopLogoPath(shopId, 'jpg');
    assert.strictEqual(logoPath, `shops/${shopId}/logo.jpg`);
  });

  it('resolves public URL and validates image metadata through CatalogMediaService', () => {
    const mediaService = new CatalogMediaService('https://supabase.co/storage/v1/object/public/catalog-media');
    const path = `shops/${shopId}/products/${productId}/${imageId}.jpg`;
    assert.strictEqual(
      mediaService.resolvePublicUrl(path),
      `https://supabase.co/storage/v1/object/public/catalog-media/${path}`
    );

    assert.throws(() => {
      mediaService.validateImageMetadata({
        imageUrl: 'valid.jpg',
        sortOrder: -2,
      });
    }, ValidationError);
  });
});
