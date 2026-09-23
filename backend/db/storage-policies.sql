-- Supabase Storage Buckets & Policies Specification
-- Cung cấp bởi Người 2 (Database & Supabase) cho Mốc T2

-- 1. Tạo Buckets nếu chưa tồn tại
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('product-media', 'product-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('review-media', 'review-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Chính sách SELECT: Cho phép công chúng đọc ảnh sản phẩm và ảnh đánh giá (Public Read)
CREATE POLICY "Public Access Product Media"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-media');

CREATE POLICY "Public Access Review Media"
ON storage.objects FOR SELECT
USING (bucket_id = 'review-media');

-- 3. Chính sách INSERT Product Media:
-- Chỉ người bán sở hữu Shop mới được upload vào thư mục shops/{shop_id}/...
CREATE POLICY "Seller Upload Product Media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-media' AND
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.owner_id = auth.uid()
      AND (storage.foldername(name))[2] = s.shop_id::text
  )
);

-- 4. Chính sách INSERT Review Media:
-- Chỉ người mua mới được upload vào thư mục users/{user_id}/...
CREATE POLICY "Buyer Upload Review Media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'review-media' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
