GRANT SELECT ON public.comedores TO anon, authenticated;
GRANT SELECT ON public.preguntas TO anon, authenticated;
GRANT INSERT ON public.encuestas TO anon, authenticated;
GRANT INSERT ON public.respuestas TO anon, authenticated;
GRANT ALL ON public.comedores TO service_role;
GRANT ALL ON public.preguntas TO service_role;
GRANT ALL ON public.encuestas TO service_role;
GRANT ALL ON public.respuestas TO service_role;

DROP POLICY IF EXISTS encuestas_insert_public ON public.encuestas;
CREATE POLICY encuestas_insert_public
ON public.encuestas
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS respuestas_insert_public ON public.respuestas;
CREATE POLICY respuestas_insert_public
ON public.respuestas
FOR INSERT
TO anon, authenticated
WITH CHECK (true);