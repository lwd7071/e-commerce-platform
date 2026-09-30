import type { Pool } from 'pg';

export type ExpiredMediaUpload = {
  mediaId: string;
  bucketId: 'product-media' | 'review-media';
  objectPath: string;
};

export type MediaCleanupStore = {
  claimExpired(batchSize: number): Promise<ExpiredMediaUpload[]>;
  markDeleted(mediaId: string): Promise<void>;
  makeRetryable(mediaId: string, error: string): Promise<void>;
};

export type MediaStorageRemover = {
  remove(bucketId: ExpiredMediaUpload['bucketId'], objectPath: string): Promise<void>;
};

export type MediaCleanupResult = {
  claimed: number;
  deleted: number;
  failed: number;
};

export async function cleanExpiredMedia(
  store: MediaCleanupStore,
  storage: MediaStorageRemover,
  batchSize = 100,
): Promise<MediaCleanupResult> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new Error('Media cleanup batch size must be an integer between 1 and 1000');
  }

  const candidates = await store.claimExpired(batchSize);
  const result: MediaCleanupResult = { claimed: 0, deleted: 0, failed: 0 };
  let batch = candidates;
  while (batch.length > 0) {
    result.claimed += batch.length;
    for (const candidate of batch) {
      try {
        await storage.remove(candidate.bucketId, candidate.objectPath);
        await store.markDeleted(candidate.mediaId);
        result.deleted += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await store.makeRetryable(candidate.mediaId, message.slice(0, 1000));
        result.failed += 1;
      }
    }
    // A failed item becomes retryable with a cooldown; full pages can safely drain onward.
    if (batch.length < batchSize) break;
    batch = await store.claimExpired(batchSize);
  }
  return result;
}

export function createPostgresMediaCleanupStore(pool: Pool): MediaCleanupStore {
  return {
    async claimExpired(batchSize) {
      const result = await pool.query<{ media_id: string; bucket_id: ExpiredMediaUpload['bucketId']; object_path: string }>(`
        WITH candidates AS (
          SELECT media_id
          FROM media_uploads
          WHERE (status='FINALIZED' AND finalized_at < now() - interval '24 hours'
                   AND (cleanup_error IS NULL OR updated_at < now() - interval '30 minutes'))
             OR (status='DELETE_PENDING' AND updated_at < now() - interval '30 minutes')
          ORDER BY COALESCE(finalized_at, updated_at), media_id
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE media_uploads media
        SET status='DELETE_PENDING', updated_at=now(), cleanup_error=NULL
        FROM candidates
        WHERE media.media_id=candidates.media_id
          AND media.status IN ('FINALIZED', 'DELETE_PENDING')
          AND media.attached_at IS NULL
          AND media.finalized_at < now() - interval '24 hours'
        RETURNING media.media_id, media.bucket_id, media.object_path
      `, [batchSize]);
      return result.rows.map((row) => ({
        mediaId: row.media_id,
        bucketId: row.bucket_id,
        objectPath: row.object_path,
      }));
    },

    async markDeleted(mediaId) {
      const result = await pool.query(
        `UPDATE media_uploads
         SET status='DELETED', deleted_at=now(), cleanup_error=NULL, updated_at=now()
         WHERE media_id=$1 AND status='DELETE_PENDING' AND attached_at IS NULL`,
        [mediaId],
      );
      if (result.rowCount !== 1) throw new Error(`Could not mark media ${mediaId} deleted`);
    },

    async makeRetryable(mediaId, error) {
      await pool.query(
        `UPDATE media_uploads
         SET status='FINALIZED', cleanup_error=$2, updated_at=now()
         WHERE media_id=$1 AND status='DELETE_PENDING' AND attached_at IS NULL`,
        [mediaId, error],
      );
    },
  };
}
