
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pdf-reports', 'pdf-reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can read pdf reports"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pdf-reports' AND (
    has_role(auth.uid(), 'cafeteria_admin'::app_role) OR
    has_role(auth.uid(), 'hr_viewer'::app_role)
  )
);

CREATE POLICY "Cafeteria admins can upload pdf reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pdf-reports' AND has_role(auth.uid(), 'cafeteria_admin'::app_role)
);

CREATE POLICY "Cafeteria admins can update pdf reports"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'pdf-reports' AND has_role(auth.uid(), 'cafeteria_admin'::app_role)
);

CREATE POLICY "Cafeteria admins can delete pdf reports"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pdf-reports' AND has_role(auth.uid(), 'cafeteria_admin'::app_role)
);
