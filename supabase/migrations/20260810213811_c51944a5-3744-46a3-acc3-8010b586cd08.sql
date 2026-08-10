ALTER TABLE public.comedores
  ADD COLUMN IF NOT EXISTS plantilla_reporte TEXT NOT NULL DEFAULT 'estandar',
  ADD COLUMN IF NOT EXISTS escala_niveles INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS total_personal INTEGER;

DO $$ BEGIN
  ALTER TABLE public.comedores ADD CONSTRAINT comedores_plantilla_reporte_chk CHECK (plantilla_reporte IN ('estandar','sp'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.comedores ADD CONSTRAINT comedores_escala_niveles_chk CHECK (escala_niveles IN (4,5));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.reportes
  ADD COLUMN IF NOT EXISTS agrupaciones JSONB;

UPDATE public.comedores
  SET plantilla_reporte = 'sp', escala_niveles = 5
  WHERE slug = 'sp';

GRANT SELECT (id, slug, nombre, activo, escala_niveles) ON public.comedores TO anon;
GRANT SELECT (id, slug, nombre, activo, escala_niveles, plantilla_reporte, total_personal) ON public.comedores TO authenticated;

DROP VIEW IF EXISTS public.comedores_admin;
DROP FUNCTION IF EXISTS public.admin_comedores();
CREATE FUNCTION public.admin_comedores()
 RETURNS TABLE(id uuid, slug text, nombre text, empresa_cliente text, activo boolean, rotation_offset integer, created_at timestamp with time zone, plantilla_reporte text, escala_niveles integer, total_personal integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id, c.slug, c.nombre, c.empresa_cliente, c.activo, c.rotation_offset, c.created_at,
         c.plantilla_reporte, c.escala_niveles, c.total_personal
  FROM public.comedores c
  WHERE public.is_admin();
$function$;

CREATE VIEW public.comedores_admin WITH (security_invoker = true) AS
  SELECT * FROM public.admin_comedores();
REVOKE ALL ON public.comedores_admin FROM anon;
GRANT SELECT ON public.comedores_admin TO authenticated;
GRANT SELECT ON public.comedores_admin TO service_role;