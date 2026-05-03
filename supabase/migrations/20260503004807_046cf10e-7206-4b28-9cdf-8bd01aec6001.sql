
-- Enums
CREATE TYPE public.app_role AS ENUM ('cafeteria_admin', 'hr_viewer');
CREATE TYPE public.trend_answer AS ENUM ('peor', 'igual', 'mejor');
CREATE TYPE public.recommend_answer AS ENUM ('no', 'tal_vez', 'si');
CREATE TYPE public.comment_moderation_status AS ENUM ('pending', 'approved', 'archived', 'deleted');
CREATE TYPE public.question_kind AS ENUM ('scale_5', 'trend_3', 'recommend_3', 'comment');

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role helper (security definer to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE POLICY "Users can read their own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- questions
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_num INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type public.question_kind NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read questions"
  ON public.questions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Cafeteria admins can insert questions"
  ON public.questions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'cafeteria_admin'));

CREATE POLICY "Cafeteria admins can update questions"
  ON public.questions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'cafeteria_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'cafeteria_admin'));

CREATE POLICY "Cafeteria admins can delete questions"
  ON public.questions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'cafeteria_admin'));

-- daily_menus
CREATE TABLE public.daily_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  main_dish TEXT NOT NULL,
  side_dish TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read daily menus"
  ON public.daily_menus FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Cafeteria admins can insert menus"
  ON public.daily_menus FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'cafeteria_admin'));

CREATE POLICY "Cafeteria admins can update menus"
  ON public.daily_menus FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'cafeteria_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'cafeteria_admin'));

CREATE POLICY "Cafeteria admins can delete menus"
  ON public.daily_menus FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'cafeteria_admin'));

-- surveys
CREATE TABLE public.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  question_1_score INT NOT NULL CHECK (question_1_score BETWEEN 1 AND 5),
  question_2_score INT NOT NULL CHECK (question_2_score BETWEEN 1 AND 5),
  question_3_trend public.trend_answer NOT NULL,
  question_4_recommend public.recommend_answer NOT NULL,
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 200),
  comment_status public.comment_moderation_status NOT NULL DEFAULT 'pending',
  response_time_ms INT NOT NULL CHECK (response_time_ms >= 0),
  device_fingerprint TEXT NOT NULL,
  daily_menu_id UUID REFERENCES public.daily_menus(id) ON DELETE SET NULL,
  is_flagged BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX surveys_fingerprint_created_idx
  ON public.surveys (device_fingerprint, created_at DESC);
CREATE INDEX surveys_created_idx ON public.surveys (created_at DESC);
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

-- Kiosk submits anonymously; service role (edge function) bypasses RLS but
-- we also allow anon insert as a safety net for direct client use cases.
CREATE POLICY "Anyone can submit a survey"
  ON public.surveys FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Cafeteria admins can read surveys"
  ON public.surveys FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'cafeteria_admin'));

CREATE POLICY "Cafeteria admins can update surveys"
  ON public.surveys FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'cafeteria_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'cafeteria_admin'));

CREATE POLICY "Cafeteria admins can delete surveys"
  ON public.surveys FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'cafeteria_admin'));

-- pdf_reports
CREATE TABLE public.pdf_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pdf_url TEXT NOT NULL
);
ALTER TABLE public.pdf_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cafeteria admins and HR can read reports"
  ON public.pdf_reports FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'cafeteria_admin')
    OR public.has_role(auth.uid(), 'hr_viewer')
  );

CREATE POLICY "Cafeteria admins can insert reports"
  ON public.pdf_reports FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'cafeteria_admin'));

CREATE POLICY "Cafeteria admins can update reports"
  ON public.pdf_reports FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'cafeteria_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'cafeteria_admin'));

CREATE POLICY "Cafeteria admins can delete reports"
  ON public.pdf_reports FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'cafeteria_admin'));
