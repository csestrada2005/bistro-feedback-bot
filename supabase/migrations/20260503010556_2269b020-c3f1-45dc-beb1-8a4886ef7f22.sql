
CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  service_hours jsonb NOT NULL DEFAULT '[{"label":"Comida","start_h":12,"start_m":0,"end_h":15,"end_m":0}]'::jsonb,
  cooldown_hours integer NOT NULL DEFAULT 4,
  min_response_ms integer NOT NULL DEFAULT 3000,
  quorum integer NOT NULL DEFAULT 20,
  alert_drop_pct numeric NOT NULL DEFAULT 15,
  alert_menu_score numeric NOT NULL DEFAULT 2.5,
  alert_pending_comments integer NOT NULL DEFAULT 10,
  alert_emails text[] NOT NULL DEFAULT '{}',
  pdf_company_name text NOT NULL DEFAULT '',
  pdf_color text NOT NULL DEFAULT '#0f172a',
  pdf_logo_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

INSERT INTO public.app_settings (id) VALUES (1);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
ON public.app_settings FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Cafeteria admins can update settings"
ON public.app_settings FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cafeteria_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'cafeteria_admin'::app_role));

INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-branding', 'pdf-branding', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view branding files"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'pdf-branding');

CREATE POLICY "Cafeteria admins can upload branding"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pdf-branding' AND has_role(auth.uid(), 'cafeteria_admin'::app_role));

CREATE POLICY "Cafeteria admins can update branding"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'pdf-branding' AND has_role(auth.uid(), 'cafeteria_admin'::app_role));

CREATE POLICY "Cafeteria admins can delete branding"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pdf-branding' AND has_role(auth.uid(), 'cafeteria_admin'::app_role));
