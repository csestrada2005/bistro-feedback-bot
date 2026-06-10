
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS kiosk_exit_pin_hash TEXT;

DROP POLICY IF EXISTS usuarios_self_update ON public.usuarios;
CREATE POLICY usuarios_self_update ON public.usuarios
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_my_kiosk_pin(_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'PIN debe ser de 4 dígitos';
  END IF;
  UPDATE public.usuarios
    SET kiosk_exit_pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf'))
    WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_kiosk_pin(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_kiosk_pin(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.comedor_has_kiosk_pin(p_comedor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_comedores uc
    JOIN public.usuarios u ON u.id = uc.usuario_id
    WHERE uc.comedor_id = p_comedor_id
      AND u.rol = 'cliente'
      AND u.kiosk_exit_pin_hash IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.comedor_has_kiosk_pin(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_kiosk_pin(p_comedor_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_comedores uc
    JOIN public.usuarios u ON u.id = uc.usuario_id
    WHERE uc.comedor_id = p_comedor_id
      AND u.rol = 'cliente'
      AND u.kiosk_exit_pin_hash IS NOT NULL
      AND u.kiosk_exit_pin_hash = extensions.crypt(p_pin, u.kiosk_exit_pin_hash)
  );
$$;

GRANT EXECUTE ON FUNCTION public.verify_kiosk_pin(UUID, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_kiosk_pin_set()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND kiosk_exit_pin_hash IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.my_kiosk_pin_set() TO authenticated;
