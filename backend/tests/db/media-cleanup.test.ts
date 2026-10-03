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
    for (const batchSize of [0, 1.5, 1001]) {
      await expect(cleanExpiredMedia(store, { remove: vi.fn() }, batchSize)).rejects.toThrow('between 1 and 1000');
    }
    expect(store.claimExpired).not.toHaveBeenCalled();
  });

  it('leaves a Storage-removed row retryable if the registry update fails', async () => {
    const store: MediaCleanupStore = {
      claimExpired: vi.fn().mockResolvedValue([candidate]),
      markDeleted: vi.fn().mockRejectedValue(new Error('database unavailable')),
      makeRetryable: vi.fn(),
    };
    const storage = { remove: vi.fn().mockResolvedValue(undefined) };

    await expect(cleanExpiredMedia(store, storage)).resolves.toEqual({ claimed: 1, deleted: 0, failed: 1 });
    expect(storage.remove).toHaveBeenCalledWith(candidate.bucketId, candidate.objectPath);
    expect(store.makeRetryable).toHaveBeenCalledWith(candidate.mediaId, 'database unavailable');
  });

  it('drains subsequent full pages without repeating failed items in the same run', async () => {
    const nextCandidate = { ...candidate, mediaId: '10000000-0000-4000-8000-000000000002' };
    const store: MediaCleanupStore = {
      claimExpired: vi.fn().mockResolvedValueOnce([candidate]).mockResolvedValueOnce([nextCandidate]).mockResolvedValueOnce([]),
      markDeleted: vi.fn(), makeRetryable: vi.fn(),
    };
    const storage = { remove: vi.fn().mockImplementationOnce(() => { throw new Error('transient'); }).mockResolvedValue(undefined) };

    await expect(cleanExpiredMedia(store, storage, 1)).resolves.toEqual({ claimed: 2, deleted: 1, failed: 1 });
    expect(store.claimExpired).toHaveBeenCalledTimes(3);
    expect(store.makeRetryable).toHaveBeenCalledWith(candidate.mediaId, 'transient');
    expect(store.markDeleted).toHaveBeenCalledWith(nextCandidate.mediaId);
  });

  it('claims expired presigned and old finalized unattached media without racing attach', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const store = createPostgresMediaCleanupStore({ query } as never);
    await store.claimExpired(25);
    const sql = query.mock.calls[0]?.[0] as string;
    expect(sql).toContain("status='FINALIZED'");
    expect(sql).toContain("status='PRESIGNED'");
    expect(sql).toContain('expires_at < now()');
    expect(sql).toContain("cleanup_error IS NULL OR updated_at < now() - interval '30 minutes'");
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
    expect(query.mock.calls[1]?.[0]).toContain("ELSE 'FINALIZED' END");
    expect(query.mock.calls[1]?.[0]).toContain("THEN 'PRESIGNED'");
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
