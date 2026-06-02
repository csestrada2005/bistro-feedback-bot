DROP POLICY IF EXISTS reportes_select_cliente ON public.reportes;
CREATE POLICY reportes_select_cliente ON public.reportes
  FOR SELECT TO authenticated
  USING (current_user_rol() = 'cliente'::user_rol AND estado = 'publicado');