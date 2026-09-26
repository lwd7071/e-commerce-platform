-- Supabase Storage buckets and ownership policies. Safe to replay on the test project.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('product-media', 'product-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('review-media', 'review-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public Access Product Media" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Review Media" ON storage.objects;
DROP POLICY IF EXISTS "Seller Upload Product Media" ON storage.objects;
DROP POLICY IF EXISTS "Buyer Upload Review Media" ON storage.objects;
DROP POLICY IF EXISTS "Seller Insert Product Media" ON storage.objects;
DROP POLICY IF EXISTS "Seller Update Product Media" ON storage.objects;
DROP POLICY IF EXISTS "Seller Delete Product Media" ON storage.objects;
DROP POLICY IF EXISTS "Buyer Insert Review Media" ON storage.objects;
DROP POLICY IF EXISTS "Buyer Update Review Media" ON storage.objects;
DROP POLICY IF EXISTS "Buyer Delete Review Media" ON storage.objects;

CREATE POLICY "Public Access Product Media"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-media');

CREATE POLICY "Public Access Review Media"
ON storage.objects FOR SELECT
USING (bucket_id = 'review-media');

-- Storage policies must validate ownership without granting authenticated users
-- direct table access (the application schema intentionally defaults to deny).
CREATE OR REPLACE FUNCTION public.can_manage_product_media(target_shop_id uuid, target_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.shop_id = target_shop_id
      AND s.owner_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.shop_id = s.shop_id AND p.product_id = target_product_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_review_media(target_review_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.review_id = target_review_id AND r.buyer_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_shop_media(target_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.shop_id = target_shop_id AND s.owner_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_product_media(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_review_media(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_shop_media(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_product_media(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_review_media(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_shop_media(uuid) TO authenticated;

CREATE POLICY "Seller Insert Product Media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-media'
  AND (storage.foldername(name))[1] = 'shops'
  AND (
    (name ~* '^shops/[0-9a-f-]{36}/logo\.(jpg|jpeg|png|webp)$'
      AND public.can_manage_shop_media(CASE
        WHEN (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
        THEN (storage.foldername(name))[2]::uuid END))
    OR ((storage.foldername(name))[3] = 'products'
      AND public.can_manage_product_media(
        CASE WHEN (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$' THEN (storage.foldername(name))[2]::uuid END,
        CASE WHEN (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$' THEN (storage.foldername(name))[4]::uuid END))
  )
);

CREATE POLICY "Seller Update Product Media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-media'
  AND owner_id = auth.uid()::text
  AND (storage.foldername(name))[1] = 'shops'
  AND (
    (name ~* '^shops/[0-9a-f-]{36}/logo\.(jpg|jpeg|png|webp)$'
      AND public.can_manage_shop_media(CASE
        WHEN (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
        THEN (storage.foldername(name))[2]::uuid END))
    OR ((storage.foldername(name))[3] = 'products'
      AND public.can_manage_product_media(
        CASE WHEN (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$' THEN (storage.foldername(name))[2]::uuid END,
        CASE WHEN (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$' THEN (storage.foldername(name))[4]::uuid END))
  )
)
WITH CHECK (
  bucket_id = 'product-media'
  AND owner_id = auth.uid()::text
  AND (storage.foldername(name))[1] = 'shops'
  AND (
    (name ~* '^shops/[0-9a-f-]{36}/logo\.(jpg|jpeg|png|webp)$'
      AND public.can_manage_shop_media(CASE
        WHEN (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
        THEN (storage.foldername(name))[2]::uuid END))
    OR ((storage.foldername(name))[3] = 'products'
      AND public.can_manage_product_media(
        CASE WHEN (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$' THEN (storage.foldername(name))[2]::uuid END,
        CASE WHEN (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$' THEN (storage.foldername(name))[4]::uuid END))
  )
);

CREATE POLICY "Seller Delete Product Media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-media'
  AND owner_id = auth.uid()::text
  AND (storage.foldername(name))[1] = 'shops'
  AND EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.owner_id = auth.uid()
      AND s.shop_id = CASE
        WHEN (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
        THEN (storage.foldername(name))[2]::uuid
      END
      AND (
        name ~* '^shops/[0-9a-f-]{36}/logo\.(jpg|jpeg|png|webp)$'
        OR (
          (storage.foldername(name))[3] = 'products'
          AND EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.shop_id = s.shop_id
              AND p.product_id = CASE
                WHEN (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
                THEN (storage.foldername(name))[4]::uuid
              END
          )
        )
      )
  )
);

CREATE POLICY "Buyer Insert Review Media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'review-media'
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (storage.foldername(name))[3] = 'reviews'
  AND public.can_manage_review_media(CASE
    WHEN (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
    THEN (storage.foldername(name))[4]::uuid END)
);

CREATE POLICY "Buyer Update Review Media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'review-media'
  AND owner_id = auth.uid()::text
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (storage.foldername(name))[3] = 'reviews'
  AND public.can_manage_review_media(CASE
    WHEN (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
    THEN (storage.foldername(name))[4]::uuid END)
)
WITH CHECK (
  bucket_id = 'review-media'
  AND owner_id = auth.uid()::text
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (storage.foldername(name))[3] = 'reviews'
  AND public.can_manage_review_media(CASE
    WHEN (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
    THEN (storage.foldername(name))[4]::uuid END)
);

CREATE POLICY "Buyer Delete Review Media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'review-media'
  AND owner_id = auth.uid()::text
  AND (storage.foldername(name))[1] = 'users'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (storage.foldername(name))[3] = 'reviews'
  AND public.can_manage_review_media(CASE
    WHEN (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
    THEN (storage.foldername(name))[4]::uuid END)
);
