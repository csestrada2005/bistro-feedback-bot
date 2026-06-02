-- Extend reportes table
ALTER TABLE public.reportes
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'borrador',
  ADD COLUMN IF NOT EXISTS resumen text,
  ADD COLUMN IF NOT EXISTS kpis jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recomendaciones jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS alertas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS publicado_at timestamptz,
  ADD COLUMN IF NOT EXISTS publicado_por uuid;

-- Validación de estado mediante CHECK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reportes_estado_check'
  ) THEN
    ALTER TABLE public.reportes
      ADD CONSTRAINT reportes_estado_check CHECK (estado IN ('borrador','publicado'));
  END IF;
END $$;

-- RLS adicional: operador puede ver reportes de su comedor
DROP POLICY IF EXISTS reportes_select_op ON public.reportes;
CREATE POLICY reportes_select_op
  ON public.reportes
  FOR SELECT
  TO authenticated
  USING (current_user_rol() = 'operador'::user_rol AND comedor_id = current_user_comedor());

-- RLS adicional: cliente solo ve publicados de su comedor
DROP POLICY IF EXISTS reportes_select_cliente ON public.reportes;
CREATE POLICY reportes_select_cliente
  ON public.reportes
  FOR SELECT
  TO authenticated
  USING (current_user_rol() = 'cliente'::user_rol AND comedor_id = current_user_comedor() AND estado = 'publicado');

-- Asegurar grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reportes TO authenticated;
GRANT ALL ON public.reportes TO service_role;