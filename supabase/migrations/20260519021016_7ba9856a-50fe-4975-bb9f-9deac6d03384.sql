DELETE FROM public.respuestas WHERE encuesta_id IN (SELECT id FROM public.encuestas);
DELETE FROM public.encuestas;
DELETE FROM public.reportes;