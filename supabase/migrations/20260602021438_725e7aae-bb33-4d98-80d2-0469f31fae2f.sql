ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS operador_requires_comedor;
ALTER TABLE public.usuarios ADD CONSTRAINT operador_requires_comedor
  CHECK (rol IN ('admin','cliente') OR comedor_id IS NOT NULL);