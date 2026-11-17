DROP POLICY IF EXISTS comedores_select_anon_safe ON public.comedores;
DROP POLICY IF EXISTS comedores_select_authenticated ON public.comedores;
CREATE POLICY comedores_select_anon_active ON public.comedores FOR SELECT TO anon USING (activo = true);
CREATE POLICY comedores_select_authenticated ON public.comedores FOR SELECT TO authenticated
  USING (activo = true OR public.is_admin() OR public.user_has_comedor(auth.uid(), id));

DROP POLICY IF EXISTS preguntas_select_public ON public.preguntas;
CREATE POLICY preguntas_select_anon_active ON public.preguntas FOR SELECT TO anon USING (activa = true);
CREATE POLICY preguntas_select_authenticated ON public.preguntas FOR SELECT TO authenticated
  USING (activa = true OR public.is_admin());