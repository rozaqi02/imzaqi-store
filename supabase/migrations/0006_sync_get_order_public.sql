-- ============================================================================
-- 0006_sync_get_order_public.sql
-- Sinkronisasi RPC public.get_order_public(p_order_code) agar mengembalikan
-- kolom non-sensitif yang sudah ada pada tabel public.orders:
--   payment_proof_url, payment_reported_at, payment_reference,
--   reservation_expires_at, verification_status, late_payment_report
--
-- Privasi tetap terjaga: customer_whatsapp dan visitor_id TIDAK diekspos.
-- Idempoten & aman dijalankan ulang di Supabase SQL Editor.
-- ============================================================================

drop function if exists public.get_order_public(text);

create or replace function public.get_order_public(p_order_code text)
returns table (
  order_code text,
  status text,
  items jsonb,
  subtotal_idr integer,
  discount_percent integer,
  total_idr integer,
  promo_code text,
  created_at timestamptz,
  admin_note text,
  notes text,
  buyer_email text,
  payment_proof_url text,
  payment_reported_at timestamptz,
  payment_reference text,
  reservation_expires_at timestamptz,
  verification_status text,
  late_payment_report boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_order_code, '')));
begin
  if v_code = '' then
    return;
  end if;

  return query
    select
      o.order_code,
      o.status,
      o.items,
      o.subtotal_idr,
      o.discount_percent,
      o.total_idr,
      o.promo_code,
      o.created_at,
      o.admin_note,
      o.notes,
      o.buyer_email,
      o.payment_proof_url,
      o.payment_reported_at,
      o.payment_reference,
      o.reservation_expires_at,
      o.verification_status,
      o.late_payment_report
    from public.orders o
    where upper(o.order_code) = v_code
    limit 1;
end;
$$;

grant execute on function public.get_order_public(text) to anon, authenticated;
