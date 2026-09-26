import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  STORAGE_BUCKETS,
  ALLOWED_IMAGE_EXTENSIONS,
  buildProductImagePath,
  buildShopLogoPath,
  buildReviewImagePath,
  validateStoragePath,
  parseStoragePath,
} from '../../db/storage.js';

describe('Storage Path Builder and Validation', () => {
  const shopId = '11111111-1111-4111-8111-111111111111';
  const productId = '22222222-2222-4222-8222-222222222222';
  const imageId = '33333333-3333-4333-8333-333333333333';
  const userId = '44444444-4444-4444-8444-444444444444';
  const reviewId = '55555555-5555-4555-8555-555555555555';

  it('defines standard public buckets', () => {
    expect(STORAGE_BUCKETS.PRODUCT_MEDIA).toBe('product-media');
    expect(STORAGE_BUCKETS.REVIEW_MEDIA).toBe('review-media');
  });

  it('builds canonical product image path matching Person 3 specification', () => {
    const path = buildProductImagePath(shopId, productId, imageId, 'webp');
    expect(path).toBe(`shops/${shopId}/products/${productId}/${imageId}.webp`);
  });

  it('builds canonical shop logo path matching Person 3 specification', () => {
    const path = buildShopLogoPath(shopId, 'png');
    expect(path).toBe(`shops/${shopId}/logo.png`);
  });

  it('builds canonical review image path matching Person 4 specification', () => {
    const path = buildReviewImagePath(userId, reviewId, imageId, 'jpg');
    expect(path).toBe(`users/${userId}/reviews/${reviewId}/${imageId}.jpg`);
  });

  it('validates allowed image extensions', () => {
    expect(ALLOWED_IMAGE_EXTENSIONS).toContain('jpg');
    expect(ALLOWED_IMAGE_EXTENSIONS).toContain('jpeg');
    expect(ALLOWED_IMAGE_EXTENSIONS).toContain('png');
    expect(ALLOWED_IMAGE_EXTENSIONS).toContain('webp');
  });

  it('validates valid storage paths successfully', () => {
    expect(validateStoragePath('product-media', `shops/${shopId}/products/${productId}/${imageId}.png`)).toBe(true);
    expect(validateStoragePath('product-media', `shops/${shopId}/logo.jpeg`)).toBe(true);
    expect(validateStoragePath('review-media', `users/${userId}/reviews/${reviewId}/${imageId}.webp`)).toBe(true);
  });

  it('rejects path traversal or malicious characters', () => {
    expect(validateStoragePath('product-media', `shops/${shopId}/../../../etc/passwd`)).toBe(false);
    expect(validateStoragePath('product-media', `shops/${shopId}/products/${productId}/<script>.png`)).toBe(false);
    expect(validateStoragePath('product-media', `shops/${shopId}/products/${productId}/${imageId}.exe`)).toBe(false);
    expect(validateStoragePath('product-media', `shops/${shopId}/products/${productId}/${imageId}.sh`)).toBe(false);
    expect(validateStoragePath('review-media', `shops/${shopId}/logo.png`)).toBe(false); // wrong bucket
  });

  it('parses valid product image path into structured metadata', () => {
    const parsed = parseStoragePath(`shops/${shopId}/products/${productId}/${imageId}.webp`);
    expect(parsed).toEqual({
      type: 'product_image',
      shopId,
      productId,
      imageId,
      extension: 'webp',
    });
  });

  it('keeps the replayable SQL policy set aligned with all ownership operations', () => {
    const policyPath = fileURLToPath(new URL('../../db/storage-policies.sql', import.meta.url));
    const policySql = readFileSync(policyPath, 'utf8');
    const policyNames = [
      'Seller Insert Product Media',
      'Seller Update Product Media',
      'Seller Delete Product Media',
      'Buyer Insert Review Media',
      'Buyer Update Review Media',
      'Buyer Delete Review Media',
    ];

    for (const policyName of policyNames) {
      expect(policySql).toContain(`DROP POLICY IF EXISTS "${policyName}"`);
      expect(policySql).toContain(`CREATE POLICY "${policyName}"`);
    }

    expect(policySql).toContain('FROM public.products p');
    expect(policySql).toContain('FROM public.reviews r');
    expect(policySql).toContain('owner_id = auth.uid()::text');
  });
});
