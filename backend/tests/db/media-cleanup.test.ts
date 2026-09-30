import { describe, expect, it, vi } from 'vitest';
import { cleanExpiredMedia, createPostgresMediaCleanupStore, type MediaCleanupStore } from '../../db/media-cleanup.js';
import { assertMediaCleanupAllowed } from '../../db/media-cleanup-safety.js';

const candidate = {
  mediaId: '10000000-0000-4000-8000-000000000001',
  bucketId: 'product-media' as const,
  objectPath: 'shops/10000000-0000-4000-8000-000000000002/products/10000000-0000-4000-8000-000000000003/10000000-0000-4000-8000-000000000004.webp',
};

describe('cleanExpiredMedia', () => {
  it('removes through Storage API before marking the registry row deleted', async () => {
    const events: string[] = [];
    const store: MediaCleanupStore = {
      claimExpired: vi.fn().mockResolvedValue([candidate]),
      markDeleted: vi.fn().mockImplementation(async () => { events.push('deleted'); }),
      makeRetryable: vi.fn(),
    };
    const storage = { remove: vi.fn().mockImplementation(async () => { events.push('storage-remove'); }) };

    await expect(cleanExpiredMedia(store, storage)).resolves.toEqual({ claimed: 1, deleted: 1, failed: 0 });
    expect(events).toEqual(['storage-remove', 'deleted']);
  });

  it('keeps failed Storage deletion retryable and records a bounded error', async () => {
    const store: MediaCleanupStore = {
      claimExpired: vi.fn().mockResolvedValue([candidate]),
      markDeleted: vi.fn(),
      makeRetryable: vi.fn(),
    };
    const storage = { remove: vi.fn().mockRejectedValue(new Error('storage unavailable')) };

    await expect(cleanExpiredMedia(store, storage)).resolves.toEqual({ claimed: 1, deleted: 0, failed: 1 });
    expect(store.makeRetryable).toHaveBeenCalledWith(candidate.mediaId, 'storage unavailable');
    expect(store.markDeleted).not.toHaveBeenCalled();
  });

  it('rejects invalid batch sizes before claiming records', async () => {
    const store: MediaCleanupStore = {
      claimExpired: vi.fn(), markDeleted: vi.fn(), makeRetryable: vi.fn(),
    };
    await expect(cleanExpiredMedia(store, { remove: vi.fn() }, 1001)).rejects.toThrow('between 1 and 1000');
    expect(store.claimExpired).not.toHaveBeenCalled();
  });

  it('claims only finalized, unattached media and locks rows to prevent concurrent attach/delete', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const store = createPostgresMediaCleanupStore({ query } as never);
    await store.claimExpired(25);
    const sql = query.mock.calls[0]?.[0] as string;
    expect(sql).toContain("status='FINALIZED'");
    expect(sql).toContain("status='DELETE_PENDING'");
    expect(sql).toContain('finalized_at < now() - interval \'24 hours\'');
    expect(sql).toContain('attached_at IS NULL');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(query.mock.calls[0]?.[1]).toEqual([25]);
  });

  it('marks deleted only from DELETE_PENDING and unattached; retries return to FINALIZED', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });
    const store = createPostgresMediaCleanupStore({ query } as never);
    await store.markDeleted(candidate.mediaId);
    await store.makeRetryable(candidate.mediaId, 'failed');
    expect(query.mock.calls[0]?.[0]).toContain("status='DELETE_PENDING'");
    expect(query.mock.calls[0]?.[0]).toContain('attached_at IS NULL');
    expect(query.mock.calls[1]?.[0]).toContain("status='FINALIZED'");
  });
});

describe('assertMediaCleanupAllowed', () => {
  const env = {
    nodeEnv: 'production',
    databaseEnvironment: 'production',
    expectedProjectRef: 'prod-project',
    allowedProjectRefs: 'prod-project',
    expectedDatabaseHost: 'db.prod-project.supabase.co',
    allowedDatabaseHosts: 'db.prod-project.supabase.co',
    allowMediaCleanup: 'true',
  };

  it('allows only the explicitly configured production project and database host', () => {
    expect(() => assertMediaCleanupAllowed(env, {
      projectRef: 'prod-project', databaseHost: 'db.prod-project.supabase.co',
    })).not.toThrow();
  });

  it('rejects missing allowlists and either target mismatch', () => {
    expect(() => assertMediaCleanupAllowed({ ...env, allowedProjectRefs: '' }, {
      projectRef: 'prod-project', databaseHost: 'db.prod-project.supabase.co',
    })).toThrow('explicit project ref allowlist');
    expect(() => assertMediaCleanupAllowed(env, {
      projectRef: 'other-project', databaseHost: 'db.prod-project.supabase.co',
    })).toThrow('project ref');
    expect(() => assertMediaCleanupAllowed(env, {
      projectRef: 'prod-project', databaseHost: 'other.example.test',
    })).toThrow('database host');
  });

  it('rejects a test runtime or a missing explicit enable flag', () => {
    expect(() => assertMediaCleanupAllowed({ ...env, nodeEnv: 'test' }, {
      projectRef: 'prod-project', databaseHost: 'db.prod-project.supabase.co',
    })).toThrow('requires NODE_ENV=production');
    expect(() => assertMediaCleanupAllowed({ ...env, allowMediaCleanup: undefined }, {
      projectRef: 'prod-project', databaseHost: 'db.prod-project.supabase.co',
    })).toThrow('ALLOW_MEDIA_CLEANUP=true');
  });
});
