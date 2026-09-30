import { describe, expect, it, vi } from 'vitest';
import { attachFinalizedMedia, detectImageMimeFromMagicBytes, markMediaFinalized, MAX_MEDIA_SIZE_BYTES, registerPresignedMedia } from '../../db/media-lifecycle.js';

describe('media lifecycle writes', () => {
  it('detects only supported image magic bytes and enforces the 5 MB limit', () => {
    expect(detectImageMimeFromMagicBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(detectImageMimeFromMagicBytes(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('image/png');
    expect(detectImageMimeFromMagicBytes(Uint8Array.from([
      82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80,
    ]))).toBe('image/webp');
    expect(() => detectImageMimeFromMagicBytes(new Uint8Array(MAX_MEDIA_SIZE_BYTES + 1))).toThrow('5 MB');
  });

  it('registers only a server-shaped, supported media path', async () => {
    const client = { query: vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ owner_id: 'e2000000-0000-4000-8000-000000000021' }] })
      .mockResolvedValue({ rowCount: 1 }) };
    await registerPresignedMedia(client, {
      mediaId: 'e2000000-0000-4000-8000-000000000020',
      ownerId: 'e2000000-0000-4000-8000-000000000021',
      purpose: 'PRODUCT',
      bucketId: 'product-media',
      objectPath: 'shops/e2000000-0000-4000-8000-000000000022/products/e2000000-0000-4000-8000-000000000004/e2000000-0000-4000-8000-000000000020.png',
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });
    expect(client.query.mock.calls[0]?.[0]).toContain('JOIN products p ON p.shop_id=s.shop_id');
    expect(client.query.mock.calls[0]?.[0]).toContain("s.status='ACTIVE'");
    expect(client.query.mock.calls[0]?.[1]).toEqual([
      'e2000000-0000-4000-8000-000000000022', 'e2000000-0000-4000-8000-000000000004',
    ]);
    expect(client.query.mock.calls[1]?.[0]).toContain("'PRESIGNED'");
    await expect(registerPresignedMedia(client, {
      mediaId: 'e2000000-0000-4000-8000-000000000020', ownerId: 'e2000000-0000-4000-8000-000000000021',
      purpose: 'PRODUCT', bucketId: 'product-media', objectPath: '../bad.png', expiresAt: new Date(),
    })).rejects.toThrow('invalid product media path');
    await expect(registerPresignedMedia(client, {
      mediaId: 'e2000000-0000-4000-8000-000000000020', ownerId: 'e2000000-0000-4000-8000-000000000021',
      purpose: 'PRODUCT', bucketId: 'product-media',
      objectPath: 'shops/e2000000-0000-4000-8000-000000000022/products/e2000000-0000-4000-8000-000000000004/e2000000-0000-4000-8000-000000000020.png',
      expiresAt: new Date(Date.now() + 11 * 60_000),
    })).rejects.toThrow('10 minutes');
    await expect(registerPresignedMedia(client, {
      mediaId: 'e2000000-0000-4000-8000-000000000099', ownerId: 'e2000000-0000-4000-8000-000000000021',
      purpose: 'PRODUCT', bucketId: 'product-media',
      objectPath: 'shops/e2000000-0000-4000-8000-000000000022/products/e2000000-0000-4000-8000-000000000004/e2000000-0000-4000-8000-000000000020.png',
      expiresAt: new Date(Date.now() + 5 * 60_000),
    })).rejects.toThrow('invalid product media path');
  });

  it('rejects product media when the caller does not own the active shop', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ owner_id: 'some-other-user' }] }) };
    await expect(registerPresignedMedia(client, {
      mediaId: 'e2000000-0000-4000-8000-000000000020', ownerId: 'e2000000-0000-4000-8000-000000000021',
      purpose: 'PRODUCT', bucketId: 'product-media',
      objectPath: 'shops/e2000000-0000-4000-8000-000000000022/products/e2000000-0000-4000-8000-000000000004/e2000000-0000-4000-8000-000000000020.png',
      expiresAt: new Date(Date.now() + 5 * 60_000),
    })).rejects.toThrow('not owned');
  });

  it('allows finalization only from PRESIGNED after server verification', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };
    await markMediaFinalized(client, 'e2000000-0000-4000-8000-000000000020', Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(client.query.mock.calls[0]?.[0]).toContain("status='PRESIGNED'");
    client.query.mockResolvedValueOnce({ rowCount: 0 });
    await expect(markMediaFinalized(client, 'e2000000-0000-4000-8000-000000000020', Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]))).rejects.toThrow('not presigned');
    await expect(markMediaFinalized(client, 'e2000000-0000-4000-8000-000000000020', Uint8Array.from([0, 1, 2]))).rejects.toThrow('magic bytes');
  });

  it('attaches only FINALIZED media so cleanup and attach serialize safely', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };
    await attachFinalizedMedia(client, {
      mediaId: 'e2000000-0000-4000-8000-000000000020', ownerId: 'e2000000-0000-4000-8000-000000000021', purpose: 'PRODUCT',
      resource: { kind: 'PRODUCT', shopId: 'e2000000-0000-4000-8000-000000000022', productId: 'e2000000-0000-4000-8000-000000000004' },
    });
    const sql = client.query.mock.calls[0]?.[0] as string;
    expect(sql).toContain("status='FINALIZED'");
    expect(sql).toContain('attached_at IS NULL');
    expect(client.query.mock.calls[0]?.[1]?.[3]).toBe('shops/e2000000-0000-4000-8000-000000000022/products/e2000000-0000-4000-8000-000000000004/%');
    client.query.mockResolvedValueOnce({ rowCount: 0 });
    await expect(attachFinalizedMedia(client, {
      mediaId: 'e2000000-0000-4000-8000-000000000020', ownerId: 'e2000000-0000-4000-8000-000000000021', purpose: 'PRODUCT',
      resource: { kind: 'PRODUCT', shopId: 'e2000000-0000-4000-8000-000000000022', productId: 'e2000000-0000-4000-8000-000000000004' },
    })).rejects.toThrow('not finalized');
    await expect(attachFinalizedMedia(client, {
      mediaId: 'e2000000-0000-4000-8000-000000000020', ownerId: 'e2000000-0000-4000-8000-000000000021', purpose: 'PRODUCT',
      resource: { kind: 'REVIEW', reviewId: 'e2000000-0000-4000-8000-000000000030' },
    })).rejects.toThrow('purpose does not match');
  });
});
