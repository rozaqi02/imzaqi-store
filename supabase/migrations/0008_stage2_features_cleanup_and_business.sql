-- ============================================================================
-- 0008_stage2_features_cleanup_and_business.sql
-- Tahap 2 & 3: Sinkronisasi fitur frontend + bersihkan storage page_views +
-- fondasi profit (HPP), masa aktif/renewal H-3, dan audit log admin.
-- ----------------------------------------------------------------------------
-- Prasyarat: 0007_security_and_stock_hardening.sql sudah dijalankan.
-- Idempoten & dibungkus transaksi BEGIN...COMMIT.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1) FUNNEL ANALYTICS (selaras 100% dengan AdminDashboard.jsx & Status.jsx)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.funnel_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id uuid,
  session_id uuid NOT NULL,
  event_name text NOT NULL,
  path text,
  product_id uuid,
  variant_id uuid,
  order_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funnel_events DROP CONSTRAINT IF EXISTS funnel_events_event_name_check;
ALTER TABLE public.funnel_events ADD CONSTRAINT funnel_events_event_name_check CHECK (
  event_name IN (
    'view_product',
    'add_to_cart',
    'buy_now',
    'begin_checkout',
    'apply_promo',
    'restock_request',
    'qris_opened',
    'manual_selected',
    'payment_failed',
    'payment_reported',
    'order_completed',
    'order_reviewed'
  )
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_created_at
  ON public.funnel_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_session
  ON public.funnel_events (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_name_created
  ON public.funnel_events (event_name, created_at DESC);

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "funnel_events_insert" ON public.funnel_events;
DROP POLICY IF EXISTS "anon insert funnel_events" ON public.funnel_events;
DROP POLICY IF EXISTS "public insert funnel_events" ON public.funnel_events;
DROP POLICY IF EXISTS "admin read funnel_events" ON public.funnel_events;
DROP POLICY IF EXISTS "admin manage funnel_events" ON public.funnel_events;

CREATE POLICY "public insert funnel_events"
  ON public.funnel_events FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(COALESCE(path, '')) <= 500
    AND pg_column_size(metadata) <= 4096
  );

CREATE POLICY "admin manage funnel_events"
  ON public.funnel_events FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT INSERT ON public.funnel_events TO anon, authenticated;
GRANT SELECT, DELETE ON public.funnel_events TO authenticated;

-- Drop dulu agar tidak bentrok tipe return bila versi lama mengembalikan TABLE
DROP FUNCTION IF EXISTS public.get_funnel_summary(integer);

CREATE OR REPLACE FUNCTION public.get_funnel_summary(p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 7), 90));
  v_start timestamptz := now() - make_interval(days => v_days);
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH ordered(event_name, step_order) AS (
    VALUES
      ('view_product', 1),
      ('add_to_cart', 2),
      ('begin_checkout', 3),
      ('qris_opened', 4),
      ('payment_reported', 5),
      ('order_completed', 6)
  ),
  counts AS (
    SELECT o.step_order,
           o.event_name,
           COUNT(DISTINCT fe.session_id)::bigint AS sessions
      FROM ordered o
      LEFT JOIN public.funnel_events fe
        ON (
          fe.event_name = o.event_name
          OR (o.event_name = 'add_to_cart' AND fe.event_name = 'buy_now')
        )
       AND fe.created_at >= v_start
     GROUP BY o.step_order, o.event_name
  ),
  rated AS (
    SELECT step_order,
           event_name,
           sessions,
           LAG(sessions) OVER (ORDER BY step_order) AS prev_sessions
      FROM counts
  )
  SELECT jsonb_build_object(
    'days', v_days,
    'steps', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'event_name', event_name,
          'sessions', sessions,
          'rate_from_previous',
            CASE
              WHEN prev_sessions IS NULL OR prev_sessions = 0 THEN 0
              ELSE ROUND((sessions::numeric / prev_sessions::numeric) * 100, 1)
            END
        ) ORDER BY step_order
      ),
      '[]'::jsonb
    )
  )
    INTO v_result
    FROM rated;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_funnel_summary(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_funnel_summary(integer) TO authenticated;

-- ============================================================================
-- 2) UPLOAD BUKTI PEMBAYARAN AMAN (Status.jsx -> report_order_payment)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.report_order_payment(
  p_order_code text,
  p_payment_proof_url text DEFAULT NULL,
  p_payment_reference text DEFAULT NULL
)
RETURNS TABLE (
  order_code text,
  status text,
  payment_proof_url text,
  payment_reported_at timestamptz,
  verification_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text := UPPER(trim(COALESCE(p_order_code, '')));
  v_proof text := NULLIF(trim(COALESCE(p_payment_proof_url, '')), '');
  v_ref text := NULLIF(trim(COALESCE(p_payment_reference, '')), '');
  v_order public.orders%ROWTYPE;
  v_is_late boolean := false;
BEGIN
  IF v_code = '' THEN
    RAISE EXCEPTION 'ID pesanan wajib diisi.';
  END IF;

  IF v_proof IS NULL AND v_ref IS NULL THEN
    RAISE EXCEPTION 'Bukti atau referensi pembayaran wajib diisi.';
  END IF;

  -- Batasi URL bukti hanya dari bucket payment-proofs Supabase (anti URL phishing)
  IF v_proof IS NOT NULL
     AND v_proof !~* '^https://[a-z0-9.-]+/storage/v1/object/public/payment-proofs/orders/IMZ-[A-Z0-9-]+/[0-9]+\.(jpg|jpeg|png|webp)$' THEN
    RAISE EXCEPTION 'URL bukti pembayaran tidak valid.';
  END IF;

  IF v_ref IS NOT NULL AND char_length(v_ref) > 120 THEN
    RAISE EXCEPTION 'Referensi pembayaran terlalu panjang.';
  END IF;

  SELECT * INTO v_order
    FROM public.orders o
   WHERE UPPER(o.order_code) = v_code
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan.';
  END IF;

  IF v_order.status NOT IN ('pending', 'pending_payment', 'paid_reported') THEN
    RAISE EXCEPTION 'Pesanan sudah diproses atau ditutup.';
  END IF;

  -- Cegah orang lain menimpa bukti transfer yang sudah diunggah
  IF v_proof IS NOT NULL AND v_order.payment_proof_url IS NOT NULL THEN
    RAISE EXCEPTION 'Bukti pembayaran untuk pesanan ini sudah diunggah sebelumnya.';
  END IF;

  v_is_late := (v_order.reservation_expires_at IS NOT NULL AND v_order.reservation_expires_at < now());

  UPDATE public.orders o
     SET payment_proof_url = COALESCE(v_proof, o.payment_proof_url),
         payment_reference = COALESCE(v_ref, o.payment_reference),
         payment_reported_at = COALESCE(o.payment_reported_at, now()),
         late_payment_report = COALESCE(o.late_payment_report, false) OR v_is_late,
         verification_status = CASE WHEN v_proof IS NOT NULL OR v_ref IS NOT NULL THEN 'reported' ELSE o.verification_status END,
         status = CASE WHEN o.status IN ('pending', 'pending_payment') THEN 'paid_reported' ELSE o.status END
   WHERE o.id = v_order.id;

  RETURN QUERY
  SELECT o.order_code, o.status, o.payment_proof_url, o.payment_reported_at, o.verification_status
    FROM public.orders o
   WHERE o.id = v_order.id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_order_payment(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_order_payment(text, text, text) TO anon, authenticated;

-- ============================================================================
-- 3) KOLOM TERSTRUKTUR TESTIMONI + MODERATED REVIEW + REFERRAL ORDERS
-- ============================================================================
ALTER TABLE public.testimonials
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS purchased_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating smallint;

ALTER TABLE public.testimonials DROP CONSTRAINT IF EXISTS testimonials_rating_check;
ALTER TABLE public.testimonials ADD CONSTRAINT testimonials_rating_check
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

-- Izinkan pembeli kirim ulasan dari /status ke antrean moderasi (wajib is_active = false)
DROP POLICY IF EXISTS "public submit moderated testimonial" ON public.testimonials;
CREATE POLICY "public submit moderated testimonial"
  ON public.testimonials FOR INSERT TO anon, authenticated
  WITH CHECK (
    is_active = false
    AND is_verified = false
    AND char_length(COALESCE(caption, '')) <= 600
  );

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS referral_code text;

CREATE INDEX IF NOT EXISTS idx_orders_referral_code
  ON public.orders (referral_code)
  WHERE referral_code IS NOT NULL;

-- ============================================================================
-- 4) BERSIHKAN 16.270+ SAMPAH /__vitals/* DI page_views + RETENTION HELPER
-- ============================================================================
DELETE FROM public.page_views
 WHERE path LIKE '/__vitals/%';

CREATE OR REPLACE FUNCTION public.cleanup_old_telemetry(p_retention_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days integer := GREATEST(30, LEAST(COALESCE(p_retention_days, 90), 730));
  v_cutoff timestamptz := now() - make_interval(days => v_days);
  v_pv bigint := 0;
  v_fe bigint := 0;
  v_pa bigint := 0;
  v_rb bigint := 0;
BEGIN
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.page_views WHERE visited_at < v_cutoff OR path LIKE '/__vitals/%';
  GET DIAGNOSTICS v_pv = ROW_COUNT;

  DELETE FROM public.funnel_events WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_fe = ROW_COUNT;

  DELETE FROM public.promo_attempts WHERE attempted_at < now() - interval '7 days';
  GET DIAGNOSTICS v_pa = ROW_COUNT;

  DELETE FROM public.checkout_rate_buckets WHERE window_start < now() - interval '7 days';
  GET DIAGNOSTICS v_rb = ROW_COUNT;

  RETURN jsonb_build_object(
    'retention_days', v_days,
    'deleted_page_views', v_pv,
    'deleted_funnel_events', v_fe,
    'deleted_promo_attempts', v_pa,
    'deleted_rate_buckets', v_rb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_telemetry(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_telemetry(integer) TO authenticated;

-- ============================================================================
-- 5) FONDASI BISNIS TAHAP 3: HPP/PROFIT BERSIH, RENEWAL H-3, AUDIT LOG ADMIN
-- ============================================================================

-- 5a) Tabel harga modal (HPP) terpisah — STRICT ADMIN ONLY (anon tidak pernah bisa baca!)
CREATE TABLE IF NOT EXISTS public.variant_costs (
  variant_id uuid NOT NULL PRIMARY KEY REFERENCES public.product_variants(id) ON DELETE CASCADE,
  cost_idr integer NOT NULL DEFAULT 0 CHECK (cost_idr >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.variant_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manage variant_costs" ON public.variant_costs;
CREATE POLICY "admin manage variant_costs"
  ON public.variant_costs FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5b) Durasi langganan (hari) & pelacakan masa aktif / renewal H-3 di order_items
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS duration_days integer;

ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_duration_days_check;
ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_duration_days_check
  CHECK (duration_days IS NULL OR duration_days > 0);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_cost_idr integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_reminded_at timestamptz;

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_unit_cost_check;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_unit_cost_check
  CHECK (unit_cost_idr >= 0);

CREATE INDEX IF NOT EXISTS idx_order_items_expires_at
  ON public.order_items (expires_at)
  WHERE expires_at IS NOT NULL;

-- 5c) Audit log admin
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created
  ON public.admin_audit_logs (created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manage audit_logs" ON public.admin_audit_logs;
CREATE POLICY "admin manage audit_logs"
  ON public.admin_audit_logs FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5d) Update create_order_with_stock_check: otomatis snapshot unit_cost_idr & referral_code
CREATE OR REPLACE FUNCTION public.create_order_with_stock_check(
  p_visitor_id uuid,
  p_order_code text,
  p_items jsonb,
  p_promo_code text,
  p_subtotal_idr bigint,
  p_discount_percent integer,
  p_total_idr bigint,
  p_payment_proof_url text DEFAULT NULL,
  p_customer_whatsapp text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_buyer_email text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  order_code text,
  status text,
  subtotal_idr integer,
  discount_percent integer,
  total_idr integer,
  reservation_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_order_id uuid := gen_random_uuid();
  v_order_code text := UPPER(trim(COALESCE(p_order_code, '')));
  v_promo_input text := NULLIF(UPPER(trim(COALESCE(p_promo_code, ''))), '');
  v_promo public.promo_codes%ROWTYPE;
  v_discount_percent integer := 0;
  v_line record;
  v_variant record;
  v_flash_discount integer;
  v_effective_price integer;
  v_subtotal bigint := 0;
  v_discount_amount bigint := 0;
  v_total bigint := 0;
  v_canonical_items jsonb := '[]'::jsonb;
  v_expiry timestamptz := v_now + interval '60 minutes';
  v_referral text := NULLIF(left(trim(COALESCE(substring(COALESCE(p_notes, '') FROM '(?i)(?:^|\n)Ref:\s*([^\r\n]+)'), '')), 64), '');
BEGIN
  IF p_visitor_id IS NULL THEN
    RAISE EXCEPTION 'Visitor ID wajib diisi.';
  END IF;

  IF v_order_code = '' OR length(v_order_code) > 32 THEN
    RAISE EXCEPTION 'Kode order tidak valid.';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Keranjang kosong atau tidak valid.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_items) x
     WHERE COALESCE(x->>'variant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR COALESCE(x->>'qty', '') !~ '^[1-9][0-9]?$'
  ) THEN
    RAISE EXCEPTION 'Format item atau jumlah tidak valid.';
  END IF;

  IF v_promo_input IS NOT NULL THEN
    SELECT * INTO v_promo
      FROM public.promo_codes AS pc
     WHERE UPPER(pc.code) = v_promo_input
     FOR UPDATE;

    IF NOT FOUND OR NOT v_promo.is_active THEN
      RAISE EXCEPTION 'Kode promo tidak valid atau tidak aktif.';
    END IF;
    IF v_promo.expired_at IS NOT NULL AND v_promo.expired_at < v_now THEN
      RAISE EXCEPTION 'Kode promo sudah kedaluwarsa.';
    END IF;
    IF v_promo.max_uses IS NOT NULL AND COALESCE(v_promo.used_count, 0) >= v_promo.max_uses THEN
      RAISE EXCEPTION 'Kuota kode promo sudah habis.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.promo_claims AS pcl
       WHERE pcl.visitor_id = p_visitor_id AND UPPER(pcl.code) = UPPER(v_promo.code)
    ) THEN
      RAISE EXCEPTION 'Kamu sudah pernah menggunakan kode promo ini.';
    END IF;

    v_discount_percent := v_promo.percent;
  END IF;

  FOR v_line IN
    SELECT (x->>'variant_id')::uuid AS variant_id,
           SUM((x->>'qty')::int)::int AS qty
      FROM jsonb_array_elements(p_items) x
     GROUP BY 1
     ORDER BY 1
  LOOP
    IF v_line.qty < 1 OR v_line.qty > 99 THEN
      RAISE EXCEPTION 'Jumlah item tidak valid (1-99).';
    END IF;

    SELECT pv.*, p.name AS product_name, p.icon_url AS product_icon_url, p.is_active AS product_active
      INTO v_variant
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
     WHERE pv.id = v_line.variant_id
     FOR UPDATE OF pv;

    IF NOT FOUND OR NOT v_variant.is_active OR NOT v_variant.product_active THEN
      RAISE EXCEPTION 'Varian tidak ditemukan atau nonaktif.';
    END IF;

    IF COALESCE(v_variant.stock, 0) < v_line.qty THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk %.', v_variant.name;
    END IF;

    SELECT MAX(fs.discount_percent) INTO v_flash_discount
      FROM public.flash_sales fs
     WHERE fs.variant_id = v_variant.id
       AND fs.is_active = true
       AND fs.starts_at <= v_now
       AND fs.ends_at >= v_now;

    IF v_flash_discount IS NOT NULL AND v_flash_discount > 0 THEN
      v_effective_price := ROUND(v_variant.price_idr * (1.0 - v_flash_discount / 100.0))::integer;
    ELSE
      v_effective_price := v_variant.price_idr;
    END IF;

    v_subtotal := v_subtotal + (v_effective_price::bigint * v_line.qty);

    UPDATE public.product_variants AS pv
       SET stock = pv.stock - v_line.qty,
           sold_count = COALESCE(pv.sold_count, 0) + v_line.qty,
           updated_at = v_now
     WHERE pv.id = v_variant.id;

    v_canonical_items := v_canonical_items || jsonb_build_array(
      jsonb_build_object(
        'variant_id', v_variant.id,
        'product_id', v_variant.product_id,
        'product_name', v_variant.product_name,
        'variant_name', v_variant.name,
        'duration_label', v_variant.duration_label,
        'price_idr', v_effective_price,
        'qty', v_line.qty,
        'product_icon_url', v_variant.product_icon_url,
        'description', COALESCE(v_variant.description, ''),
        'guarantee_text', v_variant.guarantee_text,
        'requires_buyer_email', COALESCE(v_variant.requires_buyer_email, false)
      )
    );
  END LOOP;

  v_discount_amount := ROUND((v_subtotal * v_discount_percent)::numeric / 100.0)::bigint;
  v_total := GREATEST(0, v_subtotal - v_discount_amount);

  IF ABS(v_subtotal - COALESCE(p_subtotal_idr, -1)) > 1
     OR v_discount_percent <> COALESCE(p_discount_percent, 0)
     OR ABS(v_total - COALESCE(p_total_idr, -1)) > 1 THEN
    RAISE EXCEPTION 'Subtotal mismatch. Harga atau promo terbaru berubah, cek ulang keranjang.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_promo.code IS NOT NULL THEN
    INSERT INTO public.promo_claims (visitor_id, code, claimed_at)
    VALUES (p_visitor_id, v_promo.code, v_now);

    UPDATE public.promo_codes AS pc
       SET used_count = COALESCE(pc.used_count, 0) + 1,
           updated_at = v_now
     WHERE pc.code = v_promo.code;
  END IF;

  INSERT INTO public.orders (
    id, visitor_id, order_code, items, promo_code,
    subtotal_idr, discount_percent, total_idr,
    payment_proof_url, customer_whatsapp, notes, buyer_email, referral_code,
    status, reservation_expires_at, created_at
  ) VALUES (
    v_order_id, p_visitor_id, v_order_code, v_canonical_items, v_promo.code,
    v_subtotal::integer, v_discount_percent, v_total::integer,
    NULLIF(trim(COALESCE(p_payment_proof_url, '')), ''),
    NULLIF(trim(COALESCE(p_customer_whatsapp, '')), ''),
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    NULLIF(trim(COALESCE(p_buyer_email, '')), ''),
    v_referral,
    'pending', v_expiry, v_now
  );

  INSERT INTO public.order_items (
    order_id, variant_id, product_id, product_name, variant_name,
    duration_label, price_idr, qty, product_icon_url,
    description, guarantee_text, requires_buyer_email, unit_cost_idr, created_at
  )
  SELECT
    v_order_id,
    (it->>'variant_id')::uuid,
    (it->>'product_id')::uuid,
    COALESCE(it->>'product_name', ''),
    COALESCE(it->>'variant_name', ''),
    it->>'duration_label',
    COALESCE((it->>'price_idr')::int, 0),
    COALESCE((it->>'qty')::int, 1),
    it->>'product_icon_url',
    it->>'description',
    it->>'guarantee_text',
    COALESCE((it->>'requires_buyer_email')::boolean, false),
    COALESCE(vc.cost_idr, 0),
    v_now
  FROM jsonb_array_elements(v_canonical_items) it
  LEFT JOIN public.variant_costs vc ON vc.variant_id = (it->>'variant_id')::uuid;

  RETURN QUERY
  SELECT v_order_id, v_order_code, 'pending'::text,
         v_subtotal::integer, v_discount_percent, v_total::integer, v_expiry;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_with_stock_check(uuid, text, jsonb, text, bigint, integer, bigint, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock_check(uuid, text, jsonb, text, bigint, integer, bigint, text, text, text, text) TO anon, authenticated;

-- 5e) Update trigger status order: otomatis isi activated_at & expires_at saat 'done'
CREATE OR REPLACE FUNCTION public.handle_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_line record;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('cancelled', 'expired')
     AND OLD.status NOT IN ('cancelled', 'expired')
     AND OLD.inventory_released_at IS NULL
     AND NEW.inventory_released_at IS NULL THEN
    FOR v_line IN
      SELECT (it->>'variant_id')::uuid AS variant_id,
             SUM(GREATEST(COALESCE((it->>'qty')::int, 1), 1))::int AS qty
        FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) it
       WHERE NULLIF(it->>'variant_id', '') IS NOT NULL
       GROUP BY 1
       ORDER BY 1
    LOOP
      UPDATE public.product_variants
         SET stock = stock + v_line.qty,
             sold_count = GREATEST(COALESCE(sold_count, 0) - v_line.qty, 0),
             updated_at = now()
       WHERE id = v_line.variant_id;
    END LOOP;
    NEW.inventory_released_at := now();
  END IF;

  IF OLD.status IN ('cancelled', 'expired')
     AND NEW.status NOT IN ('cancelled', 'expired') THEN
    IF OLD.inventory_released_at IS NOT NULL THEN
      FOR v_line IN
        SELECT (it->>'variant_id')::uuid AS variant_id,
               SUM(GREATEST(COALESCE((it->>'qty')::int, 1), 1))::int AS qty
          FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) it
         WHERE NULLIF(it->>'variant_id', '') IS NOT NULL
         GROUP BY 1
         ORDER BY 1
      LOOP
        UPDATE public.product_variants
           SET stock = GREATEST(stock - v_line.qty, 0),
               sold_count = COALESCE(sold_count, 0) + v_line.qty,
               updated_at = now()
         WHERE id = v_line.variant_id;
      END LOOP;
      NEW.inventory_released_at := NULL;
    END IF;
  END IF;

  IF NEW.inventory_committed_at IS NULL AND NEW.status IN ('processing', 'done') THEN
    NEW.inventory_committed_at := now();
  END IF;

  IF NEW.status = 'done' THEN
    NEW.verification_status := 'verified';

    -- Stempel masa aktif & tanggal expired untuk fitur reminder perpanjangan H-3
    UPDATE public.order_items oi
       SET activated_at = COALESCE(oi.activated_at, now()),
           expires_at = COALESCE(
             oi.expires_at,
             CASE
               WHEN pv.duration_days IS NOT NULL AND pv.duration_days > 0
                 THEN now() + make_interval(days => pv.duration_days)
               ELSE NULL
             END
           )
      FROM public.product_variants pv
     WHERE oi.order_id = NEW.id
       AND oi.variant_id = pv.id
       AND oi.expires_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_order_status_transition() FROM PUBLIC, anon, authenticated;

-- 5f) RPC Admin: Daftar langganan akan habis dalam N hari (Renewal Engine)
CREATE OR REPLACE FUNCTION public.get_expiring_subscriptions(p_within_days integer DEFAULT 3)
RETURNS TABLE(
  order_item_id uuid,
  order_id uuid,
  order_code text,
  customer_whatsapp text,
  buyer_email text,
  product_name text,
  variant_name text,
  duration_label text,
  activated_at timestamptz,
  expires_at timestamptz,
  renewal_reminded_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_within_days, 3), 30));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    oi.id AS order_item_id,
    o.id AS order_id,
    o.order_code,
    o.customer_whatsapp,
    o.buyer_email,
    oi.product_name,
    oi.variant_name,
    oi.duration_label,
    oi.activated_at,
    oi.expires_at,
    oi.renewal_reminded_at
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.status = 'done'
    AND oi.expires_at IS NOT NULL
    AND oi.expires_at BETWEEN now() - interval '1 day' AND now() + make_interval(days => v_days)
  ORDER BY oi.expires_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_expiring_subscriptions(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_expiring_subscriptions(integer) TO authenticated;

-- 5g) RPC Admin: Ringkasan omzet vs modal (HPP) vs profit bersih harian
CREATE OR REPLACE FUNCTION public.get_profit_summary(p_days integer DEFAULT 30)
RETURNS TABLE(
  stat_date date,
  done_orders bigint,
  revenue_idr bigint,
  cost_idr bigint,
  profit_idr bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 30), 365));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      (now() AT TIME ZONE 'Asia/Jakarta')::date - (v_days - 1),
      (now() AT TIME ZONE 'Asia/Jakarta')::date,
      '1 day'::interval
    )::date AS d
  ),
  order_costs AS (
    SELECT
      oi.order_id,
      COALESCE(SUM(oi.unit_cost_idr::bigint * oi.qty), 0)::bigint AS total_cost_idr
    FROM public.order_items oi
    GROUP BY oi.order_id
  ),
  daily AS (
    SELECT
      (o.created_at AT TIME ZONE 'Asia/Jakarta')::date AS d,
      COUNT(*)::bigint AS done_orders,
      COALESCE(SUM(o.total_idr), 0)::bigint AS revenue_idr,
      COALESCE(SUM(COALESCE(oc.total_cost_idr, 0)), 0)::bigint AS cost_idr
    FROM public.orders o
    LEFT JOIN order_costs oc ON oc.order_id = o.id
    WHERE o.status = 'done'
      AND o.created_at >= now() - make_interval(days => v_days)
    GROUP BY 1
  )
  SELECT
    ds.d AS stat_date,
    COALESCE(daily.done_orders, 0)::bigint AS done_orders,
    COALESCE(daily.revenue_idr, 0)::bigint AS revenue_idr,
    COALESCE(daily.cost_idr, 0)::bigint AS cost_idr,
    (COALESCE(daily.revenue_idr, 0) - COALESCE(daily.cost_idr, 0))::bigint AS profit_idr
  FROM date_series ds
  LEFT JOIN daily ON daily.d = ds.d
  ORDER BY ds.d;
END;
$$;

REVOKE ALL ON FUNCTION public.get_profit_summary(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profit_summary(integer) TO authenticated;

COMMIT;
