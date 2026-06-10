
CREATE TABLE IF NOT EXISTS public.assistant_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  tool TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.assistant_actions TO authenticated;
GRANT ALL ON public.assistant_actions TO service_role;

ALTER TABLE public.assistant_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY assistant_actions_admin_select ON public.assistant_actions
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY assistant_actions_admin_insert ON public.assistant_actions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND admin_id = auth.uid());

CREATE INDEX IF NOT EXISTS assistant_actions_admin_created_idx
  ON public.assistant_actions (admin_id, created_at DESC);
