-- ============================================================================
-- 0003_stock_and_order_enhancements.sql
-- ----------------------------------------------------------------------------
-- 1. Auto-release stok pesanan kedaluwarsa (Ghost Stock Elimination)
-- 2. Concurrency guard kuota promo code (Anti-Race Condition)
-- 3. Inisialisasi reservation_expires_at saat checkout baru
-- ============================================================================

-- 1) RPC auto_release_expired_orders
create or replace function public.auto_release_expired_orders(p_expiry_minutes integer default 60)
returns table (released_count integer, order_codes text[])
language plpgsql security definer
as $$
declare
  r record;
  codes text[] := '{}';
  cnt integer := 0;
begin
  for r in
    select id, order_code
      from public.orders
     where status = 'pending'
       and (
         (reservation_expires_at is not null and reservation_expires_at < now())
         or (reservation_expires_at is null and created_at < now() - (p_expiry_minutes || ' minutes')::interval)
       )
     for update skip locked
  loop
    -- Kembalikan stok produk & lepas klaim promo
    perform public.cancel_order_with_stock_restore(r.id);

    -- Tandai order sebagai kedaluwarsa dengan catatan sistem
    update public.orders
       set status = 'expired',
           admin_note = coalesce(admin_note || E'\n', '') || '[Sistem] Kedaluwarsa otomatis (stok & promo telah dipulihkan).'
     where id = r.id;

    codes := array_append(codes, r.order_code);
    cnt := cnt + 1;
  end loop;

  return query select cnt, codes;
end;
$$;

grant execute on function public.auto_release_expired_orders(integer) to anon, authenticated;

-- 2) Update create_order_with_stock_check dengan perlindungan kuota promo & masa reservasi
create or replace function public.create_order_with_stock_check(
  p_visitor_id uuid,
  p_order_code text,
  p_items jsonb,
  p_promo_code text,
  p_subtotal_idr integer,
  p_discount_percent integer,
  p_total_idr integer,
  p_payment_proof_url text,
  p_customer_whatsapp text,
  p_notes text default null,
  p_buyer_email text default null
)
returns table (order_code text, status text, id uuid)
language plpgsql security definer
as $$
declare
  it jsonb;
  v_id uuid;
  v_qty int;
  v_stock int;
begin
  -- Kunci dan kurangi stok varian
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_id  := nullif(it->>'variant_id', '')::uuid;
    v_qty := coalesce((it->>'qty')::int, 1);
    if v_id is not null then
      select stock into v_stock
        from public.product_variants where id = v_id for update;
      if coalesce(v_stock, 0) < v_qty then
        raise exception 'Stok tidak mencukupi untuk item %', coalesce(it->>'product_name', it->>'name', '?');
      end if;
      update public.product_variants
         set stock = stock - v_qty,
             sold_count = coalesce(sold_count, 0) + v_qty,
             updated_at = now()
       where id = v_id;
    end if;
  end loop;

  -- Klaim kode promo dengan concurrency check pada max_uses
  if nullif(p_promo_code, '') is not null then
    insert into public.promo_claims (code, visitor_id)
    select p_promo_code, p_visitor_id
     where not exists (
       select 1 from public.promo_claims
        where code = p_promo_code and visitor_id = p_visitor_id);

    update public.promo_codes
       set used_count = coalesce(used_count, 0) + 1,
           updated_at = now()
     where code = p_promo_code
       and (max_uses is null or used_count < max_uses);

    if not found then
      raise exception 'Kuota kode promo % sudah habis', p_promo_code;
    end if;
  end if;

  -- Buat baris pesanan dengan batas masa reservasi (60 menit)
  insert into public.orders
    (order_code, status, items, subtotal_idr, discount_percent, total_idr,
     promo_code, customer_whatsapp, payment_proof_url, notes, buyer_email, visitor_id, reservation_expires_at)
  values
    (p_order_code, 'pending', coalesce(p_items, '[]'::jsonb), p_subtotal_idr,
     p_discount_percent, p_total_idr, nullif(p_promo_code, ''),
     p_customer_whatsapp, p_payment_proof_url, p_notes, nullif(trim(p_buyer_email), ''), p_visitor_id,
     now() + interval '60 minutes');

  return query
    select o.order_code, o.status, o.id
      from public.orders o where o.order_code = p_order_code;
end $$;
