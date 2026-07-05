-- ImzaQi — align is_admin() with existing admin_users table
-- Run in Supabase SQL Editor if login fails after app update.

-- ── is_admin(): admin_users OR app_metadata.role ──
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  )
  OR COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- ── Let logged-in users verify their own admin row (for client fallback) ──
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_users_self_read ON public.admin_users;
CREATE POLICY admin_users_self_read ON public.admin_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── Register your admin (replace email) ──
-- INSERT INTO public.admin_users (user_id, email)
-- SELECT id, email FROM auth.users WHERE email = 'admin@email.com'
-- ON CONFLICT (user_id) DO NOTHING;