-- ============================================================
-- MAIN CATERING — Schema reset (Spanish naming, normalized)
-- ============================================================

-- 1) Drop old objects (cascade everything that referenced them)
DROP TABLE IF EXISTS public.surveys CASCADE;
DROP TABLE IF EXISTS public.daily_menus CASCADE;
DROP TABLE IF EXISTS public.questions CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.app_settings CASCADE;
DROP TABLE IF EXISTS public.pdf_reports CASCADE;
DROP TABLE IF EXISTS public.ai_usage CASCADE;
DROP TABLE IF EXISTS public.ai_insights_cache CASCADE;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;

DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.comment_moderation_status CASCADE;
DROP TYPE IF EXISTS public.question_type CASCADE;
DROP TYPE IF EXISTS public.trend_answer CASCADE;
DROP TYPE IF EXISTS public.recommend_answer CASCADE;

-- 2) Enums
CREATE TYPE public.user_rol AS ENUM ('admin', 'operador');
CREATE TYPE public.pregunta_tipo AS ENUM ('escala_5', 'si_no', 'texto_abierto', 'texto_multiple_3');

-- 3) Tables
CREATE TABLE public.comedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  nombre text NOT NULL,
  empresa_cliente text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL DEFAULT '',
  rol public.user_rol NOT NULL,
  comedor_id uuid REFERENCES public.comedores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operador_requires_comedor CHECK (rol = 'admin' OR comedor_id IS NOT NULL)
);

CREATE TABLE public.preguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto text NOT NULL,
  tipo public.pregunta_tipo NOT NULL,
  orden int NOT NULL,
  activa boolean NOT NULL DEFAULT true,
  comedor_id uuid REFERENCES public.comedores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_preguntas_orden ON public.preguntas(orden);

CREATE TABLE public.encuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comedor_id uuid NOT NULL REFERENCES public.comedores(id) ON DELETE CASCADE,
  fecha timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_encuestas_comedor_fecha ON public.encuestas(comedor_id, fecha DESC);

CREATE TABLE public.respuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encuesta_id uuid NOT NULL REFERENCES public.encuestas(id) ON DELETE CASCADE,
  pregunta_id uuid NOT NULL REFERENCES public.preguntas(id) ON DELETE CASCADE,
  valor_numerico int CHECK (valor_numerico BETWEEN 1 AND 5),
  valor_booleano boolean,
  valor_texto text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_respuestas_encuesta ON public.respuestas(encuesta_id);
CREATE INDEX idx_respuestas_pregunta ON public.respuestas(pregunta_id);

CREATE TABLE public.reportes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comedor_id uuid NOT NULL REFERENCES public.comedores(id) ON DELETE CASCADE,
  fecha_desde date NOT NULL,
  fecha_hasta date NOT NULL,
  url_pdf text NOT NULL,
  analisis_ia jsonb,
  generado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4) Security-definer helpers (avoid RLS recursion on usuarios)
CREATE OR REPLACE FUNCTION public.current_user_rol()
RETURNS public.user_rol
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT rol FROM public.usuarios WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.current_user_comedor()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT comedor_id FROM public.usuarios WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'admin') $$;

-- 5) Enable RLS
ALTER TABLE public.comedores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preguntas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuestas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reportes   ENABLE ROW LEVEL SECURITY;

-- 6) Policies

-- comedores: public read (kiosk needs slug lookup); admin manages all
CREATE POLICY comedores_select_public ON public.comedores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY comedores_admin_all     ON public.comedores FOR ALL    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- usuarios: admin everything, user reads own
CREATE POLICY usuarios_self_select  ON public.usuarios FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY usuarios_admin_all    ON public.usuarios FOR ALL    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- preguntas: public read (kiosk); admin writes
CREATE POLICY preguntas_select_public ON public.preguntas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY preguntas_admin_all     ON public.preguntas FOR ALL    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- encuestas: anyone can INSERT (kiosk). SELECT: admin all, operador only own comedor.
CREATE POLICY encuestas_insert_public ON public.encuestas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY encuestas_select_admin  ON public.encuestas FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY encuestas_select_op     ON public.encuestas FOR SELECT TO authenticated USING (
  public.current_user_rol() = 'operador' AND comedor_id = public.current_user_comedor()
);
CREATE POLICY encuestas_delete_admin  ON public.encuestas FOR DELETE TO authenticated USING (public.is_admin());

-- respuestas: anyone INSERT; admin SELECT all; operador SELECT only of own comedor's encuestas.
CREATE POLICY respuestas_insert_public ON public.respuestas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY respuestas_select_admin  ON public.respuestas FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY respuestas_select_op     ON public.respuestas FOR SELECT TO authenticated USING (
  public.current_user_rol() = 'operador'
  AND EXISTS (SELECT 1 FROM public.encuestas e WHERE e.id = encuesta_id AND e.comedor_id = public.current_user_comedor())
);
CREATE POLICY respuestas_delete_admin ON public.respuestas FOR DELETE TO authenticated USING (public.is_admin());

-- reportes: admin only
CREATE POLICY reportes_admin_all ON public.reportes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7) Seed: 1 comedor + 16 preguntas + reasignar admin existente
INSERT INTO public.comedores (slug, nombre, empresa_cliente)
VALUES ('sp', 'Comedor S&P (Soler y Palau)', 'Soler y Palau');

INSERT INTO public.preguntas (texto, tipo, orden, comedor_id) VALUES
  ('¿Cómo consideras el sabor de la comida?', 'escala_5', 1, NULL),
  ('¿Cómo consideras la calidad de los alimentos?', 'escala_5', 2, NULL),
  ('¿Cómo consideras el sabor y calidad del plato fuerte?', 'escala_5', 3, NULL),
  ('¿Qué tan buena es la variedad del menú?', 'escala_5', 4, NULL),
  ('¿Cómo consideras la porción de los alimentos?', 'escala_5', 5, NULL),
  ('¿Cómo calificas el agua de sabor en el comedor?', 'escala_5', 6, NULL),
  ('¿Cómo consideras el tiempo de servicio del comedor?', 'escala_5', 7, NULL),
  ('¿Cómo consideras la variedad y calidad del postre?', 'escala_5', 8, NULL),
  ('¿Cómo consideras la temperatura de los alimentos?', 'escala_5', 9, NULL),
  ('¿Cómo consideras la limpieza de los utensilios (platos, cucharas, tenedores)?', 'escala_5', 10, NULL),
  ('¿Cómo consideras la limpieza del área?', 'escala_5', 11, NULL),
  ('¿El personal cumple con las medidas de higiene visibles (guantes y cubrebocas)?', 'escala_5', 12, NULL),
  ('¿Cómo consideras el trato del personal del comedor?', 'escala_5', 13, NULL),
  ('¿Has tenido algún incidente con alimentos?', 'si_no', 14, NULL),
  ('¿Qué propones para mejorar el servicio del comedor?', 'texto_multiple_3', 15, NULL),
  ('¿Qué 3 platos fuertes te gustaría que incluyéramos?', 'texto_multiple_3', 16, NULL);

-- Reasignar admin existente
INSERT INTO public.usuarios (id, nombre, rol, comedor_id)
SELECT 'e7a2a6e5-f277-45aa-a3e1-437f1f3f8e24'::uuid, 'Josep', 'admin', NULL
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = 'e7a2a6e5-f277-45aa-a3e1-437f1f3f8e24'::uuid)
ON CONFLICT (id) DO UPDATE SET rol = 'admin';