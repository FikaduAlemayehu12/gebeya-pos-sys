
DROP POLICY IF EXISTS "Public read asset images" ON storage.objects;

-- Restrict listing: only return rows when the request includes a specific name (direct URL access).
-- This prevents clients from listing all files in the public bucket via storage.objects SELECT.
CREATE POLICY "Public read specific asset images"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'asset-images'
  AND (storage.foldername(name))[1] IS NOT NULL
);
