-- 1) Remove table-wide SELECT for anon on comedores (table grant overrode column grants)
REVOKE SELECT ON public.comedores FROM anon;
GRANT SELECT (id, slug, nombre, activo) ON public.comedores TO anon;

-- 2) Replace SECURITY DEFINER view with an invoker view over a definer function
CREATE OR REPLACE FUNCTION public.admin_comedores()
RETURNS TABLE (
  id uuid,
  slug text,
  nombre text,
  empresa_cliente text,
  activo boolean,
  rotation_offset integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.slug, c.nombre, c.empresa_cliente, c.activo, c.rotation_offset, c.created_at
  FROM public.comedores c
  WHERE public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.admin_comedores() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_comedores() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_comedores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_comedores() TO service_role;

DROP VIEW IF EXISTS public.comedores_admin;
CREATE VIEW public.comedores_admin
WITH (security_invoker = true, security_barrier = true) AS
SELECT id, slug, nombre, empresa_cliente, activo, rotation_offset, created_at
FROM public.admin_comedores();

REVOKE ALL ON public.comedores_admin FROM anon;
GRANT SELECT ON public.comedores_admin TO authenticated;
GRANT SELECT ON public.comedores_admin TO service_role;