-- Grant standard table privileges; RLS policies still enforce row-level access.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comedor_preguntas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comedores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.encuestas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preguntas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reportes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.respuestas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rum_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_comedores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios TO authenticated;

GRANT ALL ON public.assistant_actions TO service_role;
GRANT ALL ON public.comedor_preguntas TO service_role;
GRANT ALL ON public.comedores TO service_role;
GRANT ALL ON public.encuestas TO service_role;
GRANT ALL ON public.preguntas TO service_role;
GRANT ALL ON public.reportes TO service_role;
GRANT ALL ON public.respuestas TO service_role;
GRANT ALL ON public.rum_metrics TO service_role;
GRANT ALL ON public.usuario_comedores TO service_role;
GRANT ALL ON public.usuarios TO service_role;

-- Anonymous access only where a permissive policy already allows it.
GRANT SELECT ON public.comedores TO anon;
GRANT SELECT ON public.preguntas TO anon;
GRANT SELECT ON public.comedor_preguntas TO anon;
GRANT INSERT ON public.rum_metrics TO anon;