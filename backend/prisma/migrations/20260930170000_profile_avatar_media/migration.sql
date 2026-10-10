ALTER TABLE media_uploads
  DROP CONSTRAINT ck_media_uploads__purpose,
  DROP CONSTRAINT ck_media_uploads__bucket_id;

ALTER TABLE media_uploads
  ADD CONSTRAINT ck_media_uploads__purpose CHECK (purpose IN ('PRODUCT', 'REVIEW', 'AVATAR')),
  ADD CONSTRAINT ck_media_uploads__bucket_id CHECK (
    (purpose = 'PRODUCT' AND bucket_id = 'product-media')
    OR (purpose = 'REVIEW' AND bucket_id = 'review-media')
    OR (purpose = 'AVATAR' AND bucket_id = 'profile-media')
  );
