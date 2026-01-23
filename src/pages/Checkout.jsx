import React, { useEffect, useMemo, useState } from "react";
import { useCart } from "../context/CartContext";
import { usePromo } from "../hooks/usePromo";
import { formatIDR } from "../lib/format";
import { fetchSettings } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import { getVisitorIdAsUUID } from "../lib/visitor";

function calcTotal(subtotal, percent) {
  const disc = Math.round((subtotal * (percent || 0)) / 100);
  return { discount: disc, total: Math.max(0, subtotal - disc) };
}

export default function Checkout() {
  const cart = useCart();
  const { promo, apply, clear } = usePromo();
  const subtotal = cart.subtotal();
  const { discount, total } = calcTotal(subtotal, promo.percent);

  const [settings, setSettings] = useState({ whatsapp: { number: "6283136049987" } });
  const [code, setCode] = useState(() => (promo?.code || ""));
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const next = promo?.code || "";
    setCode((prev) => (prev ? prev : next));
  }, [promo]);


  useEffect(() => {
    let alive = true;
    fetchSettings().then(s => {
      if (!alive) return;
      setSettings({ whatsapp: s.whatsapp || { number: "6283136049987" } });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const waNumber = settings?.whatsapp?.number || "6283136049987";
  const qrisUrl = "/qris_payment.jpeg";

  const summaryText = useMemo(() => {
    const lines = cart.items.map(x => `- ${x.product_name} • ${x.variant_name} (${x.duration_label}) x${x.qty} = ${formatIDR(x.price_idr * x.qty)}`);
    lines.push(`Subtotal: ${formatIDR(subtotal)}`);
    if (promo.percent) lines.push(`Promo ${promo.code}: -${promo.percent}%`);
    lines.push(`Total: ${formatIDR(total)}`);
    return lines.join("\n");
  }, [cart.items, subtotal, total, promo]);

  async function onApplyPromo() {
    setMsg("");
    const res = await apply(code);
    setMsg(res.message);
  }

  async function onPaid() {
    if (cart.items.length === 0) {
      setMsg("Keranjang masih kosong.");
      return;
    }

    // create order record
    const visitor_id = getVisitorIdAsUUID();
    const orderPayload = {
      visitor_id,
      items: cart.items,
      subtotal_idr: subtotal,
      discount_percent: promo.percent || 0,
      total_idr: total,
      status: "paid_reported",
    };

    const { data, error } = await supabase.from("orders").insert(orderPayload).select("id").single();
    const orderId = data?.id || "-";
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(error);
    }

    const text = encodeURIComponent(
      `Halo kak, saya sudah bayar.\n\nOrder: ${orderId}\n\n${summaryText}\n\nMohon diproses ya 🙏`
    );

    window.location.href = `https://wa.me/${waNumber}?text=${text}`;
  }

  return (
    <div className="page">
      <section className="section reveal">
        <div className="container section-head">
          <div>
            <h1 className="h1">Checkout</h1>
            <p className="muted">Bayar via QRIS, lalu klik “Sudah bayar” untuk konfirmasi otomatis ke WhatsApp.</p>
          </div>
        </div>

        <div className="container checkout-grid">
          <div className="card pad">
            <h3 className="h3">Keranjang</h3>

            {cart.items.length === 0 ? (
              <div className="hint">Keranjang kosong. Tambahkan produk dari halaman Produk.</div>
            ) : (
              <div className="cart-list">
                {cart.items.map(item => (
                  <div key={item.variant_id} className="cart-row">
                    <div className="cart-meta">
                      <div className="cart-title">{item.product_name}</div>
                      <div className="cart-sub">{item.variant_name} • {item.duration_label}</div>
                      <div className="cart-sub">{formatIDR(item.price_idr)}</div>
                    </div>
                    <div className="cart-actions">
                      <input
                        className="qty"
                        type="number"
                        min="1"
                        max="99"
                        value={item.qty}
                        onChange={(e) => cart.setQty(item.variant_id, Number(e.target.value))}
                      />
                      <button className="btn btn-ghost btn-sm" onClick={() => cart.remove(item.variant_id)}>Hapus</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="divider" />

            <div className="promo-block">
              <div className="promo-row">
                <input className="input" placeholder="Kode promo (contoh: DISKON30)" value={code} onChange={(e) => setCode(e.target.value)} />
                <button className="btn btn-sm" onClick={onApplyPromo}>Terapkan</button>
                {promo.percent ? <button className="btn btn-ghost btn-sm" onClick={clear}>Reset</button> : null}
              </div>
              {msg ? <div className="hint">{msg}</div> : null}
            </div>

            <div className="totals">
              <div className="tot-row"><span>Subtotal</span><b>{formatIDR(subtotal)}</b></div>
              <div className="tot-row"><span>Diskon</span><b>- {formatIDR(discount)}</b></div>
              <div className="tot-row tot-big"><span>Total</span><b>{formatIDR(total)}</b></div>
            </div>
          </div>

          <div className="card pad">
            <h3 className="h3">Pembayaran QRIS</h3>
            {(
              <div className="qris-wrap">
                <img src={qrisUrl} alt="QRIS pembayaran" className="qris-img" />
              </div>
            )}

            <div className="divider" />

            <button className="btn btn-wide" onClick={onPaid}>Sudah bayar → WhatsApp</button>
            <div className="hint subtle">
              Konfirmasi akan dikirim ke WhatsApp: <b>{waNumber}</b>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
