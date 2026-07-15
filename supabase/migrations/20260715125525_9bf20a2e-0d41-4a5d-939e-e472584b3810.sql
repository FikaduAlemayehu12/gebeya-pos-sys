
CREATE POLICY "msg_att_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'message-attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "msg_att_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "msg_att_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'message-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
