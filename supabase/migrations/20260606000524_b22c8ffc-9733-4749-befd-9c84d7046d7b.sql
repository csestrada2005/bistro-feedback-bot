
CREATE TABLE public.usuario_comedores (
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  comedor_id UUID NOT NULL REFERENCES public.comedores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, comedor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_comedores TO authenticated;
GRANT ALL ON public.usuario_comedores TO service_role;

ALTER TABLE public.usuario_comedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY usuario_comedores_self_select ON public.usuario_comedores
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin());

CREATE POLICY usuario_comedores_admin_all ON public.usuario_comedores
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Migrar asignaciones actuales
INSERT INTO public.usuario_comedores (usuario_id, comedor_id)
SELECT id, comedor_id FROM public.usuarios
WHERE comedor_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Función auxiliar
CREATE OR REPLACE FUNCTION public.user_has_comedor(_user_id UUID, _comedor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuario_comedores
    WHERE usuario_id = _user_id AND comedor_id = _comedor_id
  )
$$;

-- Endurecer política de reportes para clientes
DROP POLICY IF EXISTS reportes_select_cliente ON public.reportes;
CREATE POLICY reportes_select_cliente ON public.reportes
  FOR SELECT TO authenticated
  USING (
    public.current_user_rol() = 'cliente'::user_rol
    AND estado = 'publicado'
    AND public.user_has_comedor(auth.uid(), comedor_id)
  );
