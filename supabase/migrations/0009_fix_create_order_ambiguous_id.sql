-- ============================================================================
-- Migration 0009: Fix ambiguous column reference "id" (SQLSTATE 42702)
-- inside public.create_order_with_stock_check(...)
--
-- Root cause:
--   `create_order_with_stock_check` declares `RETURNS TABLE(id uuid, ...)`,
--   which defines an implicit PL/pgSQL OUT variable named `id`.
--   In migration 0008, `UPDATE public.product_variants ... WHERE id = v_variant.id;`
--   left `id` unqualified, causing PostgreSQL to raise:
--     42702: column reference "id" is ambiguous
--     ("It could refer to either a PL/pgSQL variable or a table column.")
--
-- Fix:
--   Qualify table aliases (`pv` for `public.product_variants`, `pc` for
--   `public.promo_codes`, and `pcl` for `public.promo_claims`) inside
--   `public.create_order_with_stock_check`. Safe and idempotent to run in
--   Supabase SQL Editor on databases that already ran migration 0008.
-- ============================================================================

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
