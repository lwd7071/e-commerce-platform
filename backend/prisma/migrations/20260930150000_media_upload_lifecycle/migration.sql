CREATE TABLE media_uploads (
  media_id UUID CONSTRAINT pk_media_uploads PRIMARY KEY,
  owner_id UUID NOT NULL,
  purpose VARCHAR(20) NOT NULL,
  bucket_id VARCHAR(63) NOT NULL,
  object_path TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PRESIGNED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ,
  attached_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  cleanup_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_media_uploads__owner_id FOREIGN KEY (owner_id) REFERENCES app_users(user_id) ON DELETE RESTRICT,
  CONSTRAINT uq_media_uploads__object_path UNIQUE (bucket_id, object_path),
  CONSTRAINT ck_media_uploads__purpose CHECK (purpose IN ('PRODUCT', 'REVIEW')),
  CONSTRAINT ck_media_uploads__bucket_id CHECK (
    (purpose = 'PRODUCT' AND bucket_id = 'product-media')
    OR (purpose = 'REVIEW' AND bucket_id = 'review-media')
  ),
  CONSTRAINT ck_media_uploads__status CHECK (status IN ('PRESIGNED', 'FINALIZED', 'ATTACHED', 'DELETE_PENDING', 'DELETED')),
  CONSTRAINT ck_media_uploads__lifecycle_timestamps CHECK (
    (status = 'PRESIGNED' AND finalized_at IS NULL AND attached_at IS NULL AND deleted_at IS NULL)
    OR (status = 'FINALIZED' AND finalized_at IS NOT NULL AND attached_at IS NULL AND deleted_at IS NULL)
    OR (status = 'ATTACHED' AND finalized_at IS NOT NULL AND attached_at IS NOT NULL AND deleted_at IS NULL)
    OR (status = 'DELETE_PENDING' AND finalized_at IS NOT NULL AND attached_at IS NULL AND deleted_at IS NULL)
    OR (status = 'DELETED' AND finalized_at IS NOT NULL AND attached_at IS NULL AND deleted_at IS NOT NULL)
  )
);

CREATE INDEX idx_media_uploads__cleanup
  ON media_uploads(status, finalized_at, updated_at)
  WHERE status IN ('FINALIZED', 'DELETE_PENDING');

ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE media_uploads FROM PUBLIC, anon, authenticated;
