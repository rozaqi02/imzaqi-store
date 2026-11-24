-- ============================================================================
-- 0007_security_and_stock_hardening.sql
-- Emergency security & inventory integrity hardening (synced with live DB).
-- ----------------------------------------------------------------------------
-- 1. Ubah is_admin() menjadi SECURITY DEFINER (cegah infinite recursion RLS)
-- 2. Hapus semua policy permisif allow_* & non-admin write di public + storage
-- 3. Batasi ukuran (5 MB) & MIME gambar pada storage buckets
-- 4. Perbaiki bug +2x double-restore stok (drop order_status_change_trigger)
--    dan satukan transisi stok di handle_order_status_transition + RPC admin
-- 5. Hardening create_order_with_stock_check: hitung harga, flash sale, promo,
--    diskon & total di server, FOR UPDATE urut UUID, p_buyer_email, order_items
-- 6. Sinkronkan return code validate_promo dengan frontend (format.js)
-- 7. Kunci RPC analitik & legacy dari anon, perbaiki timezone WIB & filter vitals
-- 8. Hapus index & constraint duplikat
-- ============================================================================

BEGIN;

-- 1) is_admin() SECURITY DEFINER (wajib sebelum perketat policy admin_users)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  )
  OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- 2) Bersihkan seluruh RLS policy pintu belakang (allow_* & non-admin write)
DROP POLICY IF EXISTS "allow_select_admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "admin can read admin_users" ON public.admin_users;
CREATE POLICY "admin can read admin_users"
  ON public.admin_users FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "allow_select_orders" ON public.orders;
DROP POLICY IF EXISTS "allow_insert_orders" ON public.orders;
DROP POLICY IF EXISTS "allow_update_orders" ON public.orders;
DROP POLICY IF EXISTS "auth_update_orders" ON public.orders;
DROP POLICY IF EXISTS "admin_read_all_orders" ON public.orders;
DROP POLICY IF EXISTS "visitor_read_own_orders" ON public.orders;
DROP POLICY IF EXISTS "admin read orders" ON public.orders;
DROP POLICY IF EXISTS "admin update orders" ON public.orders;
DROP POLICY IF EXISTS "admin manage orders" ON public.orders;
CREATE POLICY "admin manage orders"
  ON public.orders FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin read order_items" ON public.order_items;
CREATE POLICY "admin read order_items"
  ON public.order_items FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "allow_select_variants" ON public.product_variants;
DROP POLICY IF EXISTS "allow_insert_variants" ON public.product_variants;
DROP POLICY IF EXISTS "allow_update_variants" ON public.product_variants;
DROP POLICY IF EXISTS "allow_delete_variants" ON public.product_variants;
DROP POLICY IF EXISTS "admin insert variants" ON public.product_variants;
DROP POLICY IF EXISTS "admin update variants" ON public.product_variants;
DROP POLICY IF EXISTS "admin delete variants" ON public.product_variants;
DROP POLICY IF EXISTS "public read active variants" ON public.product_variants;
DROP POLICY IF EXISTS "admin manage variants" ON public.product_variants;
CREATE POLICY "public read active variants"
  ON public.product_variants FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "admin manage variants"
  ON public.product_variants FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "allow_select_products" ON public.products;
DROP POLICY IF EXISTS "allow_insert_products" ON public.products;
DROP POLICY IF EXISTS "allow_update_products" ON public.products;
DROP POLICY IF EXISTS "allow_delete_products" ON public.products;
DROP POLICY IF EXISTS "admin insert products" ON public.products;
DROP POLICY IF EXISTS "admin update products" ON public.products;
DROP POLICY IF EXISTS "admin delete products" ON public.products;
DROP POLICY IF EXISTS "public read active products" ON public.products;
DROP POLICY IF EXISTS "admin manage products" ON public.products;
CREATE POLICY "public read active products"
  ON public.products FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "admin manage products"
  ON public.products FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated can manage flash sales" ON public.flash_sales;
DROP POLICY IF EXISTS "Public can read active flash sales" ON public.flash_sales;
DROP POLICY IF EXISTS "public read active flash sales" ON public.flash_sales;
DROP POLICY IF EXISTS "admin manage flash sales" ON public.flash_sales;
CREATE POLICY "public read active flash sales"
  ON public.flash_sales FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "admin manage flash sales"
  ON public.flash_sales FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "allow_select_promo_codes" ON public.promo_codes;
DROP POLICY IF EXISTS "allow_insert_promo_codes" ON public.promo_codes;
DROP POLICY IF EXISTS "allow_update_promo_codes" ON public.promo_codes;
DROP POLICY IF EXISTS "public read active promo" ON public.promo_codes;
DROP POLICY IF EXISTS "admin manage promo" ON public.promo_codes;
CREATE POLICY "public read active promo"
  ON public.promo_codes FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "admin manage promo"
  ON public.promo_codes FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "allow_select_promo_claims" ON public.promo_claims;
DROP POLICY IF EXISTS "allow_insert_promo_claims" ON public.promo_claims;
DROP POLICY IF EXISTS "admin_read_promo_claims" ON public.promo_claims;
DROP POLICY IF EXISTS "anon claim promo" ON public.promo_claims;
DROP POLICY IF EXISTS "anon_insert_promo_claims" ON public.promo_claims;
DROP POLICY IF EXISTS "admin read claims" ON public.promo_claims;
DROP POLICY IF EXISTS "admin manage promo_claims" ON public.promo_claims;
CREATE POLICY "admin manage promo_claims"
  ON public.promo_claims FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "anon_insert_promo_attempts" ON public.promo_attempts;
DROP POLICY IF EXISTS "admin read promo_attempts" ON public.promo_attempts;
CREATE POLICY "admin read promo_attempts"
  ON public.promo_attempts FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "allow_select_site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "allow_update_site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "allow_upsert_site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "public read settings" ON public.site_settings;
DROP POLICY IF EXISTS "admin update settings" ON public.site_settings;
DROP POLICY IF EXISTS "admin manage settings" ON public.site_settings;
CREATE POLICY "public read settings"
  ON public.site_settings FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "admin manage settings"
  ON public.site_settings FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "allow_select_site_stats" ON public.site_stats;
DROP POLICY IF EXISTS "allow_update_site_stats" ON public.site_stats;
DROP POLICY IF EXISTS "Public can read stats" ON public.site_stats;
DROP POLICY IF EXISTS "public read site_stats" ON public.site_stats;
CREATE POLICY "public read site_stats"
  ON public.site_stats FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "allow_select_testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "allow_insert_testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "allow_update_testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "allow_delete_testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "public_read_testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "public read active testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "admin manage testimonials" ON public.testimonials;
CREATE POLICY "public read active testimonials"
  ON public.testimonials FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "admin manage testimonials"
  ON public.testimonials FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow admin select" ON public.page_views;
DROP POLICY IF EXISTS "Allow anon inserts" ON public.page_views;
DROP POLICY IF EXISTS "Allow public insert" ON public.page_views;
DROP POLICY IF EXISTS "anon insert page_views" ON public.page_views;
DROP POLICY IF EXISTS "public insert page_views" ON public.page_views;
DROP POLICY IF EXISTS "admin read page_views" ON public.page_views;
CREATE POLICY "public insert page_views"
  ON public.page_views FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "admin read page_views"
  ON public.page_views FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin read daily_stats" ON public.daily_stats;
CREATE POLICY "admin read daily_stats"
  ON public.daily_stats FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin read daily_visitors" ON public.daily_visitors;
CREATE POLICY "admin read daily_visitors"
  ON public.daily_visitors FOR SELECT TO authenticated
  USING (public.is_admin());

-- 3) Storage buckets & policies
UPDATE storage.buckets
   SET file_size_limit = 5242880,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
 WHERE id IN ('payment-proofs', 'product-icons', 'testimonials');

DROP POLICY IF EXISTS "anon_insert_payment_proofs" ON storage.objects;
DROP POLICY IF EXISTS "public_insert_payment_proofs" ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_product_icons" ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_testimonials" ON storage.objects;
DROP POLICY IF EXISTS "public upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "admin manage product icons" ON storage.objects;
DROP POLICY IF EXISTS "admin manage testimonials storage" ON storage.objects;

CREATE POLICY "public upload payment proofs"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND name LIKE 'orders/IMZ-%');

CREATE POLICY "admin manage product icons"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'product-icons' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-icons' AND public.is_admin());

CREATE POLICY "admin manage testimonials storage"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'testimonials' AND public.is_admin())
  WITH CHECK (bucket_id = 'testimonials' AND public.is_admin());

-- 4) Perbaiki bug double-restore stok & transisi status order
DROP TRIGGER IF EXISTS order_status_change_trigger ON public.orders;

CREATE OR REPLACE FUNCTION public.sync_daily_stats_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.daily_stats (date, total_orders, revenue_idr)
  VALUES (
    (NEW.created_at AT TIME ZONE 'Asia/Jakarta')::date,
    1,
    CASE WHEN NEW.status = 'done' THEN NEW.total_idr ELSE 0 END
  )
  ON CONFLICT (date) DO UPDATE
    SET total_orders = public.daily_stats.total_orders + 1,
        revenue_idr  = public.daily_stats.revenue_idr +
          CASE WHEN NEW.status = 'done' THEN NEW.total_idr ELSE 0 END;
  RETURN NEW;
END;
$$;

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
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_order_with_stock_restore(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_line record;
  v_restored_stock int := 0;
  v_restored_promo boolean := false;
BEGIN
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_order
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order tidak ditemukan');
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'restored_stock', 0, 'restored_promo', false, 'message', 'Order sudah dibatalkan sebelumnya');
  END IF;

  IF v_order.inventory_released_at IS NULL THEN
    FOR v_line IN
      SELECT (it->>'variant_id')::uuid AS variant_id,
             SUM(GREATEST(COALESCE((it->>'qty')::int, 1), 1))::int AS qty
        FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::jsonb)) it
       WHERE NULLIF(it->>'variant_id', '') IS NOT NULL
       GROUP BY 1
       ORDER BY 1
    LOOP
      UPDATE public.product_variants
         SET stock = stock + v_line.qty,
             sold_count = GREATEST(COALESCE(sold_count, 0) - v_line.qty, 0),
             updated_at = now()
       WHERE id = v_line.variant_id;
      v_restored_stock := v_restored_stock + v_line.qty;
    END LOOP;
  END IF;

  IF NULLIF(trim(COALESCE(v_order.promo_code, '')), '') IS NOT NULL THEN
    DELETE FROM public.promo_claims
     WHERE visitor_id = v_order.visitor_id
       AND UPPER(code) = UPPER(v_order.promo_code);

    UPDATE public.promo_codes
       SET used_count = GREATEST(COALESCE(used_count, 0) - 1, 0),
           updated_at = now()
     WHERE UPPER(code) = UPPER(v_order.promo_code);
    v_restored_promo := true;
  END IF;

  UPDATE public.orders
     SET status = 'cancelled',
         inventory_released_at = COALESCE(inventory_released_at, now())
   WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'ok', true,
    'restored_stock', v_restored_stock,
    'restored_promo', v_restored_promo
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_release_expired_orders(p_expiry_minutes integer DEFAULT 60)
RETURNS TABLE(released_count integer, order_codes text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_minutes int := GREATEST(30, LEAST(COALESCE(p_expiry_minutes, 60), 1440));
  r public.orders%ROWTYPE;
  v_line record;
  codes text[] := '{}';
  cnt int := 0;
BEGIN
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR r IN
    SELECT *
      FROM public.orders
     WHERE status = 'pending'
       AND (
         (reservation_expires_at IS NOT NULL AND reservation_expires_at < now())
         OR (reservation_expires_at IS NULL AND created_at < now() - make_interval(mins => v_minutes))
       )
     ORDER BY id
     FOR UPDATE SKIP LOCKED
  LOOP
    IF r.inventory_released_at IS NULL THEN
      FOR v_line IN
        SELECT (it->>'variant_id')::uuid AS variant_id,
               SUM(GREATEST(COALESCE((it->>'qty')::int, 1), 1))::int AS qty
          FROM jsonb_array_elements(COALESCE(r.items, '[]'::jsonb)) it
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
    END IF;

    IF NULLIF(trim(COALESCE(r.promo_code, '')), '') IS NOT NULL THEN
      DELETE FROM public.promo_claims
       WHERE visitor_id = r.visitor_id
         AND UPPER(code) = UPPER(r.promo_code);

      UPDATE public.promo_codes
         SET used_count = GREATEST(COALESCE(used_count, 0) - 1, 0),
             updated_at = now()
       WHERE UPPER(code) = UPPER(r.promo_code);
    END IF;

    UPDATE public.orders
       SET status = 'expired',
           inventory_released_at = COALESCE(inventory_released_at, now()),
           admin_note = COALESCE(admin_note || E'\n', '') || '[Sistem] Kedaluwarsa otomatis (stok & promo telah dipulihkan).'
     WHERE id = r.id;

    codes := array_append(codes, r.order_code);
    cnt := cnt + 1;
  END LOOP;

  RETURN QUERY SELECT cnt, codes;
END;
$$;

-- 5) Hardening checkout
DROP FUNCTION IF EXISTS public.create_order_with_stock_check(uuid, text, jsonb, text, bigint, integer, bigint, text, text, text);
DROP FUNCTION IF EXISTS public.create_order_with_stock_check(uuid, text, jsonb, text, integer, integer, integer, text, text, text);
DROP FUNCTION IF EXISTS public.create_order_with_stock_check(uuid, text, jsonb, text, integer, integer, integer, text, text, text, text);

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
      FROM public.promo_codes
     WHERE UPPER(code) = v_promo_input
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
      SELECT 1 FROM public.promo_claims
       WHERE visitor_id = p_visitor_id AND UPPER(code) = UPPER(v_promo.code)
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

    UPDATE public.product_variants
       SET stock = stock - v_line.qty,
           sold_count = COALESCE(sold_count, 0) + v_line.qty,
           updated_at = v_now
     WHERE id = v_variant.id;

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

    UPDATE public.promo_codes
       SET used_count = COALESCE(used_count, 0) + 1,
           updated_at = v_now
     WHERE code = v_promo.code;
  END IF;

  INSERT INTO public.orders (
    id, visitor_id, order_code, items, promo_code,
    subtotal_idr, discount_percent, total_idr,
    payment_proof_url, customer_whatsapp, notes, buyer_email,
    status, reservation_expires_at, created_at
  ) VALUES (
    v_order_id, p_visitor_id, v_order_code, v_canonical_items, v_promo.code,
    v_subtotal::integer, v_discount_percent, v_total::integer,
    NULLIF(trim(COALESCE(p_payment_proof_url, '')), ''),
    NULLIF(trim(COALESCE(p_customer_whatsapp, '')), ''),
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    NULLIF(trim(COALESCE(p_buyer_email, '')), ''),
    'pending', v_expiry, v_now
  );

  INSERT INTO public.order_items (
    order_id, variant_id, product_id, product_name, variant_name,
    duration_label, price_idr, qty, product_icon_url,
    description, guarantee_text, requires_buyer_email, created_at
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
    v_now
  FROM jsonb_array_elements(v_canonical_items) it;

  RETURN QUERY
  SELECT v_order_id, v_order_code, 'pending'::text,
         v_subtotal::integer, v_discount_percent, v_total::integer, v_expiry;
END;
$$;

-- 6) Sinkronisasi validate_promo dengan format.js
CREATE OR REPLACE FUNCTION public.validate_promo(p_code text, p_visitor_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempts integer;
  v_promo public.promo_codes%ROWTYPE;
  v_code text := UPPER(btrim(COALESCE(p_code, '')));
BEGIN
  IF v_code = '' THEN RETURN 0; END IF;

  IF p_visitor_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_attempts
      FROM public.promo_attempts
     WHERE visitor_id = p_visitor_id
       AND attempted_at > now() - interval '1 hour';
    IF v_attempts >= 10 THEN RETURN -4; END IF;
    INSERT INTO public.promo_attempts (visitor_id) VALUES (p_visitor_id);
  END IF;

  SELECT * INTO v_promo
    FROM public.promo_codes
   WHERE UPPER(code) = v_code
     AND is_active = true;

  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_promo.expired_at IS NOT NULL AND v_promo.expired_at < now() THEN RETURN -1; END IF;

  IF p_visitor_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.promo_claims
     WHERE visitor_id = p_visitor_id AND UPPER(code) = UPPER(v_promo.code)
  ) THEN
    RETURN -2;
  END IF;

  IF v_promo.max_uses IS NOT NULL AND COALESCE(v_promo.used_count, 0) >= v_promo.max_uses THEN
    RETURN -3;
  END IF;

  RETURN COALESCE(v_promo.percent, 0);
END;
$$;

-- 7) RPC stats publik & analitik admin-only
CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH wib AS (
    SELECT
      (now() AT TIME ZONE 'Asia/Jakarta')::date AS today_date,
      (date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta') AS today_start
  )
  SELECT json_build_object(
    'total_views',       COALESCE((SELECT total_views FROM public.site_stats WHERE id = 1), 0),
    'today_views',       COALESCE((SELECT CASE WHEN s.last_date = w.today_date THEN s.today_views ELSE 0 END
                                     FROM public.site_stats s, wib w WHERE s.id = 1), 0),
    'last_7_days_views', COALESCE((SELECT COUNT(*) FROM public.daily_visitors dv, wib w
                                    WHERE dv.visit_date >= w.today_date - 6), 0),
    'total_orders',      (SELECT COUNT(*)::int FROM public.orders WHERE COALESCE(status, '') NOT IN ('cancelled', 'expired')),
    'today_orders',      (SELECT COUNT(*)::int FROM public.orders o, wib w
                           WHERE o.created_at >= w.today_start
                             AND COALESCE(o.status, '') NOT IN ('cancelled', 'expired')),
    'week_orders',       (SELECT COUNT(*)::int FROM public.orders o, wib w
                           WHERE o.created_at >= w.today_start - interval '6 days'
                             AND COALESCE(o.status, '') NOT IN ('cancelled', 'expired'))
  );
$$;

CREATE OR REPLACE FUNCTION public.get_top_products()
RETURNS TABLE(product_id uuid, total_sold bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (item->>'product_id')::uuid AS product_id,
    SUM(COALESCE((item->>'qty')::int, 1))::bigint AS total_sold
  FROM public.orders o,
       jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS item
  WHERE COALESCE(o.status, '') NOT IN ('cancelled', 'expired')
    AND NULLIF(item->>'product_id', '') IS NOT NULL
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_stats(p_days integer DEFAULT 30)
RETURNS TABLE(stat_date date, unique_views bigint, total_orders bigint, revenue_idr bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 30), 365));
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      (now() AT TIME ZONE 'Asia/Jakarta')::date - (v_days - 1),
      (now() AT TIME ZONE 'Asia/Jakarta')::date,
      '1 day'::interval
    )::date AS d
  ),
  pv AS (
    SELECT (visited_at AT TIME ZONE 'Asia/Jakarta')::date AS d,
           COUNT(DISTINCT visitor_id) AS uv
      FROM public.page_views
     WHERE visited_at >= now() - make_interval(days => v_days)
       AND COALESCE(path, '') NOT LIKE '/__vitals/%'
     GROUP BY 1
  ),
  ord AS (
    SELECT (created_at AT TIME ZONE 'Asia/Jakarta')::date AS d,
           COUNT(*) AS cnt,
           COALESCE(SUM(CASE WHEN status = 'done' THEN total_idr ELSE 0 END), 0)::bigint AS rev
      FROM public.orders
     WHERE created_at >= now() - make_interval(days => v_days)
       AND COALESCE(status, '') NOT IN ('cancelled', 'expired')
     GROUP BY 1
  )
  SELECT ds.d AS stat_date,
         COALESCE(pv.uv, 0)::bigint AS unique_views,
         COALESCE(ord.cnt, 0)::bigint AS total_orders,
         COALESCE(ord.rev, 0)::bigint AS revenue_idr
    FROM date_series ds
    LEFT JOIN pv  ON pv.d  = ds.d
    LEFT JOIN ord ON ord.d = ds.d
   ORDER BY ds.d;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_visitor_stats(p_days integer DEFAULT 30)
RETURNS TABLE(total_visitors bigint, returning_visitors bigint, new_visitors bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 30), 365));
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  WITH window_visitors AS (
    SELECT visitor_id
      FROM public.page_views
     WHERE visited_at >= now() - make_interval(days => v_days)
       AND COALESCE(path, '') NOT LIKE '/__vitals/%'
     GROUP BY visitor_id
  ),
  first_seen AS (
    SELECT visitor_id, MIN(visited_at) AS first_visit
      FROM public.page_views
     WHERE visitor_id IN (SELECT visitor_id FROM window_visitors)
       AND COALESCE(path, '') NOT LIKE '/__vitals/%'
     GROUP BY visitor_id
  )
  SELECT COUNT(*)::bigint,
         COUNT(*) FILTER (WHERE first_visit <  now() - make_interval(days => v_days))::bigint,
         COUNT(*) FILTER (WHERE first_visit >= now() - make_interval(days => v_days))::bigint
    FROM first_seen;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_top_pages(p_days integer DEFAULT 30, p_limit integer DEFAULT 10)
RETURNS TABLE(path text, view_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 30), 365));
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 10), 100));
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT pv.path, COUNT(*)::bigint AS view_count
    FROM public.page_views pv
   WHERE pv.visited_at >= now() - make_interval(days => v_days)
     AND pv.path IS NOT NULL
     AND pv.path NOT LIKE '/__vitals/%'
   GROUP BY pv.path
   ORDER BY view_count DESC
   LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cohort_return(p_days integer DEFAULT 7)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 7), 365));
  v_cnt bigint;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH first_visits AS (
    SELECT visitor_id, MIN((visited_at AT TIME ZONE 'Asia/Jakarta')::date) AS first_day
      FROM public.page_views
     WHERE COALESCE(path, '') NOT LIKE '/__vitals/%'
     GROUP BY visitor_id
  ),
  returning_visitors AS (
    SELECT fv.visitor_id
      FROM first_visits fv
      JOIN public.page_views pv ON pv.visitor_id = fv.visitor_id
     WHERE pv.visited_at >= now() - make_interval(days => v_days)
       AND COALESCE(pv.path, '') NOT LIKE '/__vitals/%'
       AND (pv.visited_at AT TIME ZONE 'Asia/Jakarta')::date > fv.first_day
     GROUP BY fv.visitor_id
  )
  SELECT COUNT(*) INTO v_cnt FROM returning_visitors;

  RETURN COALESCE(v_cnt, 0);
END;
$$;

-- 8) REVOKE & GRANT eksplisit
REVOKE ALL ON FUNCTION public.auto_cancel_expired_orders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrease_stock_on_order(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_stock_on_cancel(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_snapshot(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_v3(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_orders_public_bulk(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_order_status_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_daily_stats_on_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_orders_decrement_stock() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.cancel_order_with_stock_restore(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_with_stock_restore(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.auto_release_expired_orders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_release_expired_orders(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_daily_stats(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_stats(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_visitor_stats(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_visitor_stats(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_top_pages(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_pages(integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_cohort_return(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cohort_return(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.create_order_with_stock_check(uuid, text, jsonb, text, bigint, integer, bigint, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock_check(uuid, text, jsonb, text, bigint, integer, bigint, text, text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.validate_promo(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_promo(text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_top_products() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_products() TO anon, authenticated;

-- 9) Bersihkan index & constraint duplikat
ALTER TABLE public.promo_claims DROP CONSTRAINT IF EXISTS promo_claims_unique;
ALTER TABLE public.promo_claims DROP CONSTRAINT IF EXISTS promo_claims_visitor_code_unique;
ALTER TABLE public.flash_sales DROP CONSTRAINT IF EXISTS checkout_flash_window;

DROP INDEX IF EXISTS public.idx_orders_order_code;
DROP INDEX IF EXISTS public.orders_checkout_code_unique;
DROP INDEX IF EXISTS public.idx_variants_product;
DROP INDEX IF EXISTS public.product_variants_product_idx;
DROP INDEX IF EXISTS public.order_items_order_idx;

COMMIT;
