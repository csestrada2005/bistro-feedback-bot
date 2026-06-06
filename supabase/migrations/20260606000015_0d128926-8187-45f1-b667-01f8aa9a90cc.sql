
UPDATE public.usuarios SET rol = 'cliente' WHERE rol = 'operador';

DROP POLICY IF EXISTS encuestas_select_op ON public.encuestas;
DROP POLICY IF EXISTS respuestas_select_op ON public.respuestas;
DROP POLICY IF EXISTS reportes_select_op ON public.reportes;
