-- Expired presigned uploads can have an object in Storage even when finalize
-- was never called, so cleanup must claim/delete them through Storage too.
ALTER TABLE media_uploads
  DROP CONSTRAINT ck_media_uploads__lifecycle_timestamps;

ALTER TABLE media_uploads
  ADD CONSTRAINT ck_media_uploads__lifecycle_timestamps CHECK (
    (status = 'PRESIGNED' AND finalized_at IS NULL AND attached_at IS NULL AND deleted_at IS NULL)
    OR (status = 'FINALIZED' AND finalized_at IS NOT NULL AND attached_at IS NULL AND deleted_at IS NULL)
    OR (status = 'ATTACHED' AND finalized_at IS NOT NULL AND attached_at IS NOT NULL AND deleted_at IS NULL)
    OR (status = 'DELETE_PENDING' AND attached_at IS NULL AND deleted_at IS NULL)
    OR (status = 'DELETED' AND attached_at IS NULL AND deleted_at IS NOT NULL)
  );
