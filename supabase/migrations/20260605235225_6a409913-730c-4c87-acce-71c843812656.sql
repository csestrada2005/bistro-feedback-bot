
-- 1. Junction table
CREATE TABLE public.comedor_preguntas (
  comedor_id UUID NOT NULL REFERENCES public.comedores(id) ON DELETE CASCADE,
  pregunta_id UUID NOT NULL REFERENCES public.preguntas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comedor_id, pregunta_id)
);

GRANT SELECT ON public.comedor_preguntas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comedor_preguntas TO authenticated;
GRANT ALL ON public.comedor_preguntas TO service_role;

ALTER TABLE public.comedor_preguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY comedor_preguntas_select_public ON public.comedor_preguntas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY comedor_preguntas_admin_all ON public.comedor_preguntas FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 2. Rotation offset
ALTER TABLE public.comedores ADD COLUMN IF NOT EXISTS rotation_offset INT NOT NULL DEFAULT 0;

-- 3. Clean previous data + seed
DELETE FROM public.respuestas;
DELETE FROM public.encuestas;
DELETE FROM public.preguntas;

INSERT INTO public.preguntas (texto, tipo, orden, activa, comedor_id) VALUES
  ('Calidad general de la comida de hoy', 'escala_5', 1, true, NULL),
  ('Sabor y sazón de los platillos', 'escala_5', 2, true, NULL),
  ('Temperatura de los alimentos', 'escala_5', 3, true, NULL),
  ('Variedad del menú esta semana', 'escala_5', 4, true, NULL),
  ('Frescura de los ingredientes', 'escala_5', 5, true, NULL),
  ('Tamaño de la porción servida', 'escala_5', 6, true, NULL),
  ('Presentación de los platillos', 'escala_5', 7, true, NULL),
  ('Limpieza general del comedor', 'escala_5', 8, true, NULL),
  ('Limpieza de mesas y sillas', 'escala_5', 9, true, NULL),
  ('Limpieza de utensilios y vajilla', 'escala_5', 10, true, NULL),
  ('Amabilidad del personal de servicio', 'escala_5', 11, true, NULL),
  ('Rapidez de atención en la fila', 'escala_5', 12, true, NULL),
  ('Disponibilidad de bebidas', 'escala_5', 13, true, NULL),
  ('Disponibilidad de postres y fruta', 'escala_5', 14, true, NULL),
  ('Calidad de las ensaladas', 'escala_5', 15, true, NULL),
  ('Calidad de las sopas', 'escala_5', 16, true, NULL),
  ('Calidad del plato fuerte', 'escala_5', 17, true, NULL),
  ('Calidad de las guarniciones', 'escala_5', 18, true, NULL),
  ('Comodidad del área de comedor', 'escala_5', 19, true, NULL),
  ('Iluminación y ventilación del espacio', 'escala_5', 20, true, NULL),
  ('Tiempo total de tu visita hoy', 'escala_5', 21, true, NULL),
  ('Satisfacción general con la experiencia', 'escala_5', 22, true, NULL),
  ('¿Recomendarías el comedor a un compañero?', 'si_no', 23, true, NULL),
  ('¿Encontraste opciones saludables suficientes?', 'si_no', 24, true, NULL),
  ('¿El menú del día estuvo claramente publicado?', 'si_no', 25, true, NULL),
  ('¿Hubo alguna falla en el servicio hoy?', 'si_no', 26, true, NULL),
  ('Cuéntanos qué fue lo que más te gustó hoy', 'texto_abierto', 27, true, NULL),
  ('Comparte cualquier comentario sobre el servicio', 'texto_abierto', 28, true, NULL),
  ('Propón 3 mejoras para el comedor', 'texto_multiple_3', 29, true, NULL),
  ('Propón 3 platillos que te gustaría ver en el menú', 'texto_multiple_3', 30, true, NULL);

-- Assign all 30 to every existing comedor
INSERT INTO public.comedor_preguntas (comedor_id, pregunta_id)
SELECT c.id, p.id
FROM public.comedores c
CROSS JOIN public.preguntas p;

-- 4. Rotation RPC
CREATE OR REPLACE FUNCTION public.get_next_survey_questions(p_comedor_id UUID)
RETURNS TABLE (id UUID, texto TEXT, tipo public.pregunta_tipo, orden INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INT;
  v_count INT;
  v_take INT := 5;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.preguntas p
  JOIN public.comedor_preguntas cp ON cp.pregunta_id = p.id
  WHERE cp.comedor_id = p_comedor_id AND p.activa = true;

  IF v_count = 0 THEN
    RETURN;
  END IF;

  SELECT COALESCE(rotation_offset, 0) INTO v_offset
  FROM public.comedores
  WHERE comedores.id = p_comedor_id
  FOR UPDATE;

  v_offset := v_offset % v_count;

  RETURN QUERY
  WITH ordered AS (
    SELECT p.id, p.texto, p.tipo, p.orden,
           ROW_NUMBER() OVER (ORDER BY p.orden, p.id) - 1 AS rn
    FROM public.preguntas p
    JOIN public.comedor_preguntas cp ON cp.pregunta_id = p.id
    WHERE cp.comedor_id = p_comedor_id AND p.activa = true
  )
  SELECT o.id, o.texto, o.tipo, o.orden
  FROM ordered o
  WHERE ((o.rn - v_offset + v_count) % v_count) < v_take
  ORDER BY ((o.rn - v_offset + v_count) % v_count);

  UPDATE public.comedores
    SET rotation_offset = (v_offset + v_take) % v_count
    WHERE comedores.id = p_comedor_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_survey_questions(UUID) TO anon, authenticated;
