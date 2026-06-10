
-- 1) Tighten comedores: explicit anon SELECT only on non-sensitive columns
REVOKE ALL ON public.comedores FROM anon;
GRANT SELECT (id, slug, nombre, activo) ON public.comedores TO anon;

DROP POLICY IF EXISTS comedores_select_public ON public.comedores;
CREATE POLICY comedores_select_anon_safe ON public.comedores
  FOR SELECT TO anon USING (true);
CREATE POLICY comedores_select_authenticated ON public.comedores
  FOR SELECT TO authenticated USING (true);

-- 2) Prevent privilege escalation: usuarios self-update cannot change rol or comedor_id
DROP POLICY IF EXISTS usuarios_self_update ON public.usuarios;
CREATE POLICY usuarios_self_update ON public.usuarios
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND rol = (SELECT u.rol FROM public.usuarios u WHERE u.id = auth.uid())
    AND comedor_id IS NOT DISTINCT FROM (SELECT u.comedor_id FROM public.usuarios u WHERE u.id = auth.uid())
  );

-- 3) Remove anon direct insert path on encuestas/respuestas; route only through service-role edge function
DROP POLICY IF EXISTS encuestas_insert_public ON public.encuestas;
DROP POLICY IF EXISTS respuestas_insert_public ON public.respuestas;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.encuestas FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.respuestas FROM anon, authenticated;
GRANT SELECT ON public.encuestas TO authenticated;
GRANT SELECT ON public.respuestas TO authenticated;
GRANT ALL ON public.encuestas TO service_role;
GRANT ALL ON public.respuestas TO service_role;

-- 4) DB-level integrity guard on score range
ALTER TABLE public.respuestas DROP CONSTRAINT IF EXISTS respuestas_valor_numerico_range;
ALTER TABLE public.respuestas ADD CONSTRAINT respuestas_valor_numerico_range
  CHECK (valor_numerico IS NULL OR (valor_numerico BETWEEN 1 AND 5));
