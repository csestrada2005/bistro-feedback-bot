
-- 1) Restrict authenticated column access on comedores: hide empresa_cliente from non-admins
REVOKE SELECT ON public.comedores FROM authenticated;
GRANT SELECT (id, slug, nombre, activo, rotation_offset, created_at) ON public.comedores TO authenticated;

-- 2) Admin-only view that exposes empresa_cliente
CREATE OR REPLACE VIEW public.comedores_admin
WITH (security_invoker = true, security_barrier = true) AS
SELECT id, slug, nombre, empresa_cliente, activo, rotation_offset, created_at
FROM public.comedores
WHERE public.is_admin();

GRANT SELECT ON public.comedores_admin TO authenticated;

-- 3) Tighten rum_metrics insert: require a real active comedor by slug
DROP POLICY IF EXISTS rum_insert_public ON public.rum_metrics;
CREATE POLICY rum_insert_public ON public.rum_metrics
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    slug IS NOT NULL
    AND length(slug) BETWEEN 1 AND 100
    AND EXISTS (
      SELECT 1 FROM public.comedores c
      WHERE c.slug = rum_metrics.slug AND c.activo = true
    )
    AND (
      comedor_id IS NULL OR EXISTS (
        SELECT 1 FROM public.comedores c2 WHERE c2.id = rum_metrics.comedor_id
      )
    )
  );
