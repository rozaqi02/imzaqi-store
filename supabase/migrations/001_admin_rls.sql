-- ImzaQi Store — Admin RLS hardening
-- Apply via Supabase SQL Editor or `supabase db push`
--
-- Prerequisites:
-- 1. Disable public sign-up in Supabase Auth (or restrict to invite-only)
-- 2. Register admin via admin_users table (preferred):
--    INSERT INTO admin_users (user_id, email)
--    SELECT id, email FROM auth.users WHERE email = 'admin@yourdomain.com';
--    Or set app_metadata.role = 'admin' on auth.users

-- ── Helper: is current JWT an admin? ──
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

-- ── RPC: report payment mismatch (replaces direct client UPDATE from Pay.jsx) ──
CREATE OR REPLACE FUNCTION public.report_order_payment_mismatch(
  p_order_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET
    status = 'paid_reported',
    notes = COALESCE(p_notes, notes)
  WHERE id = p_order_id
    AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not eligible for payment report';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.report_order_payment_mismatch(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_order_payment_mismatch(uuid, text) TO anon, authenticated;

-- ── Orders: admin full access; public reads via existing RPCs only ──
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_admin_select ON public.orders;
CREATE POLICY orders_admin_select ON public.orders
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS orders_admin_update ON public.orders;
CREATE POLICY orders_admin_update ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS orders_admin_delete ON public.orders;
CREATE POLICY orders_admin_delete ON public.orders
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── Catalog & settings: admin writes ──
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_admin_all ON public.products;
CREATE POLICY products_admin_all ON public.products
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS variants_admin_all ON public.product_variants;
CREATE POLICY variants_admin_all ON public.product_variants
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promos_admin_all ON public.promo_codes;
CREATE POLICY promos_admin_all ON public.promo_codes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_admin_all ON public.site_settings;
CREATE POLICY settings_admin_all ON public.site_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS testimonials_admin_all ON public.testimonials;
CREATE POLICY testimonials_admin_all ON public.testimonials
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── cancel_order_with_stock_restore: admin only (wrap existing function if present) ──
-- If function already exists, add at top of function body:
--   IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;