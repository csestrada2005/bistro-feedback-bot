GRANT INSERT ON public.encuestas TO anon, authenticated;
GRANT INSERT ON public.respuestas TO anon, authenticated;
GRANT SELECT ON public.comedores TO anon, authenticated;
GRANT SELECT ON public.preguntas TO anon, authenticated;
GRANT INSERT ON public.rum_metrics TO anon, authenticated;
GRANT ALL ON public.encuestas, public.respuestas, public.comedores, public.preguntas, public.rum_metrics TO service_role;