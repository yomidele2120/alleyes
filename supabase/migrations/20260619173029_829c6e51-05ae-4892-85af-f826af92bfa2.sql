
CREATE POLICY "lens own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lens-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "lens own write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lens-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "lens own update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lens-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "lens own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lens-media' AND (storage.foldername(name))[1] = auth.uid()::text);
