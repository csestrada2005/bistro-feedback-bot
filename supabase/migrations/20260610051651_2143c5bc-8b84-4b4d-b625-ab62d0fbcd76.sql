
-- 1) Restrict anonymous column access on comedores (hide empresa_cliente from anon)
REVOKE SELECT ON public.comedores FROM anon;
GRANT SELECT (id, slug, nombre, activo) ON public.comedores TO anon;

-- 2) Tighten encuestas insert: must reference an existing active comedor
DROP POLICY IF EXISTS encuestas_insert_public ON public.encuestas;
CREATE POLICY encuestas_insert_public ON public.encuestas
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.comedores c
      WHERE c.id = encuestas.comedor_id AND c.activo = true
    )
  );

-- 3) Tighten respuestas insert: must reference an existing encuesta and a question
--    that belongs to that comedor (and is active)
DROP POLICY IF EXISTS respuestas_insert_public ON public.respuestas;
CREATE POLICY respuestas_insert_public ON public.respuestas
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.encuestas e
      JOIN public.comedor_preguntas cp
        ON cp.comedor_id = e.comedor_id AND cp.pregunta_id = respuestas.pregunta_id
      JOIN public.preguntas p
        ON p.id = respuestas.pregunta_id AND p.activa = true
      WHERE e.id = respuestas.encuesta_id
    )
  );

-- 4) Tighten rum_metrics insert (remove WITH CHECK true)
DROP POLICY IF EXISTS rum_insert_public ON public.rum_metrics;
CREATE POLICY rum_insert_public ON public.rum_metrics
  FOR INSERT TO anon, authenticated
  WITH CHECK (slug IS NOT NULL AND length(slug) BETWEEN 1 AND 100);

-- 5) Storage policies for the private pdf-reports bucket
-- Admins: full control
DROP POLICY IF EXISTS "pdf_reports_admin_all" ON storage.objects;
CREATE POLICY "pdf_reports_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'pdf-reports' AND public.is_admin())
  WITH CHECK (bucket_id = 'pdf-reports' AND public.is_admin());

-- Clients: read-only access to PDFs for reports of comedores they're assigned to
-- Files are expected to be stored under "<comedor_id>/..." path.
DROP POLICY IF EXISTS "pdf_reports_client_read" ON storage.objects;
CREATE POLICY "pdf_reports_client_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pdf-reports'
    AND public.current_user_rol() = 'cliente'::public.user_rol
    AND public.user_has_comedor(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
