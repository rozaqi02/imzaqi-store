-- ============================================================================
-- 0004_fix_order_closed_and_status_transitions.sql
-- ----------------------------------------------------------------------------
-- 1. Hapus trigger lama yang memblokir perubahan status order ('ORDER_CLOSED')
-- 2. Buat trigger transisi cerdas agar order 'cancelled' bisa diaktifkan kembali
--    ke 'done' / 'processing' dengan aman (stok produk dipotong kembali otomatis).
-- 3. Pastikan RPC auto_release_expired_orders terpasang (menghilangkan 404).
-- ============================================================================

-- 1) Cari & hapus trigger yang melempar ORDER_CLOSED pada tabel orders
DO $$
DECLARE
    trg RECORD;
BEGIN
    FOR trg IN (
        SELECT t.tgname, p.proname
        FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgrelid = 'public.orders'::regclass
          AND NOT t.tgisinternal
          AND pg_get_functiondef(p.oid) ILIKE '%ORDER_CLOSED%'
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.orders;', trg.tgname);
        RAISE NOTICE 'Trigger pemblokir status % (fungsi %) berhasil dihapus.', trg.tgname, trg.proname;
    END LOOP;
END $$;

-- 2) Buat fungsi & trigger transisi status cerdas
CREATE OR REPLACE FUNCTION public.handle_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it jsonb;
  v_id uuid;
  v_qty int;
BEGIN
  -- Jika berpindah dari status 'cancelled' ke status aktif ('done', 'processing', 'pending', 'paid_reported')
  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    -- Jika stok sebelumnya pernah dilepas saat order batal, potong kembali stoknya
    IF OLD.inventory_released_at IS NOT NULL THEN
      FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) LOOP
        v_id := NULLIF(it->>'variant_id', '')::uuid;
        v_qty := COALESCE((it->>'qty')::int, 1);
        IF v_id IS NOT NULL THEN
          UPDATE public.product_variants
             SET stock = GREATEST(stock - v_qty, 0),
                 sold_count = COALESCE(sold_count, 0) + v_qty,
                 updated_at = now()
           WHERE id = v_id;
        END IF;
      END LOOP;
      NEW.inventory_released_at := NULL;
    END IF;

    -- Tandai waktu komitmen inventaris
    IF NEW.inventory_committed_at IS NULL AND NEW.status IN ('processing', 'done') THEN
      NEW.inventory_committed_at := now();
    END IF;

    -- Jika langsung diubah ke selesai, verifikasi pembayarannya
    IF NEW.status = 'done' THEN
      NEW.verification_status := 'verified';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status_transition ON public.orders;
CREATE TRIGGER trg_order_status_transition
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_status_transition();

-- 3) Pasang / segarkan RPC auto_release_expired_orders
CREATE OR REPLACE FUNCTION public.auto_release_expired_orders(p_expiry_minutes integer default 60)
RETURNS TABLE (released_count integer, order_codes text[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
  codes text[] := '{}';
  cnt integer := 0;
BEGIN
  FOR r IN
    SELECT id, order_code
      FROM public.orders
     WHERE status = 'pending'
       AND (
         (reservation_expires_at IS NOT NULL AND reservation_expires_at < now())
         OR (reservation_expires_at IS NULL AND created_at < now() - (p_expiry_minutes || ' minutes')::interval)
       )
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.cancel_order_with_stock_restore(r.id);

    UPDATE public.orders
       SET status = 'expired',
           admin_note = COALESCE(admin_note || E'\n', '') || '[Sistem] Kedaluwarsa otomatis (stok & promo telah dipulihkan).'
     WHERE id = r.id;

    codes := array_append(codes, r.order_code);
    cnt := cnt + 1;
  END LOOP;

  RETURN QUERY SELECT cnt, codes;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_release_expired_orders(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_order_status_transition() TO authenticated;
