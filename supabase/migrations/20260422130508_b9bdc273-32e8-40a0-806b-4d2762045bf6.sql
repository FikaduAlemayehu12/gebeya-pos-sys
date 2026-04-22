
-- Tighten "view" policies on public buckets so general listing isn't allowed via storage.objects
DROP POLICY IF EXISTS "View customer docs" ON storage.objects;
DROP POLICY IF EXISTS "View product images" ON storage.objects;

-- Re-create restricted to authed users explicitly (still public via URL since bucket is public)
CREATE POLICY "List customer docs (authed)" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'customer-docs' AND auth.uid() IS NOT NULL);

CREATE POLICY "List product images (authed)" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);
