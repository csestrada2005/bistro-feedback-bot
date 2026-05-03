
CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  function_name text NOT NULL,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  status text NOT NULL,
  error text
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cafeteria admins can read ai usage"
ON public.ai_usage FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'cafeteria_admin'::app_role));

CREATE TABLE public.ai_insights_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.ai_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read fresh insights cache"
ON public.ai_insights_cache FOR SELECT TO authenticated
USING (expires_at > now());

CREATE INDEX ai_insights_cache_expires_idx ON public.ai_insights_cache (expires_at);
CREATE INDEX ai_usage_created_idx ON public.ai_usage (created_at DESC);
