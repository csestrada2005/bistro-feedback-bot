ALTER TABLE public.encuestas
  ADD COLUMN IF NOT EXISTS es_prueba boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS encuestas_es_prueba_idx
  ON public.encuestas (comedor_id, es_prueba, fecha);

CREATE POLICY "encuestas_update_admin"
  ON public.encuestas
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());