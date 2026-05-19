CREATE TABLE public.rum_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comedor_id uuid REFERENCES public.comedores(id) ON DELETE SET NULL,
  slug text NOT NULL,
  ttfb_ms integer,
  fcp_ms integer,
  lcp_ms integer,
  dom_interactive_ms integer,
  load_ms integer,
  device_type text,
  viewport_w integer,
  viewport_h integer,
  connection_type text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rum_metrics_slug_created_idx ON public.rum_metrics (slug, created_at DESC);
CREATE INDEX rum_metrics_created_idx ON public.rum_metrics (created_at DESC);

ALTER TABLE public.rum_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rum_insert_public"
  ON public.rum_metrics
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "rum_select_admin"
  ON public.rum_metrics
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "rum_delete_admin"
  ON public.rum_metrics
  FOR DELETE
  TO authenticated
  USING (is_admin());