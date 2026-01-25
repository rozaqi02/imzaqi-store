import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { usePromo } from "../hooks/usePromo";
import { formatIDR } from "../lib/format";
import CheckoutSteps from "../components/CheckoutSteps";
import EmptyState from "../components/EmptyState";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";

function calcTotal(subtotal, percent) {
  const disc = Math.round((subtotal * (percent || 0)) / 100);
  return { discount: disc, total: Math.max(0, subtotal - disc) };
}

export default function Checkout() {
  const nav = useNavigate();
  const cart = useCart();
  const { promo, apply, clear } = usePromo();
  const toast = useToast();

  const subtotal = cart.subtotal();
  const { discount, total } = calcTotal(subtotal, promo.percent);

  const [code, setCode] = useState(() => promo?.code || "");
  const [msg, setMsg] = useState("");

  usePageMeta({
    title: "Checkout",
    description:
      "Periksa keranjang, pakai kode promo (opsional), lalu lanjut ke pembayaran QRIS + upload bukti bayar.",
  });

  useEffect(() => {
    const next = promo?.code || "";
    setCode((prev) => (prev ? prev : next));
  }, [promo]);

  async function onApplyPromo() {
    const raw = String(code || "").trim();
    if (!raw) {
      const t = "Kode promo masih kosong.";
      setMsg(t);
      toast.error(t);
      return;
    }

    setMsg("");
    const res = await apply(raw);
    setMsg(res.message);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  }

  const itemCount = useMemo(() => cart.items.reduce((s, x) => s + x.qty, 0), [cart.items]);

  function goPay() {
    if (cart.items.length === 0) {
      setMsg("Keranjang masih kosong.");
      toast.error("Keranjang masih kosong.");
      return;
    }
    nav("/bayar");
  }

  return (
    <div className="page with-sticky-cta">
      <section className="section reveal">
        <div className="container section-head">
          <div>
            <h1 className="h1">Checkout</h1>
            <p className="muted">
              Periksa keranjang kamu. Kalau sudah benar, klik <b>Bayar sekarang</b> untuk masuk ke halaman QRIS.
            </p>
          </div>
        </div>

        <div className="container" style={{ marginBottom: 14 }}>
          <CheckoutSteps current="checkout" />
        </div>

        <div className="container checkout-pro">
          <div className="card pad">
            <div className="row between">
              <h3 className="h3">Keranjang</h3>
              <div className="muted">{itemCount} item</div>
            </div>

            {cart.items.length === 0 ? (
              <EmptyState
                icon="🛒"
                title="Keranjang kamu masih kosong"
                description="Pilih produk dulu dari halaman Produk, lalu balik lagi ke sini untuk checkout."
                primaryAction={{ label: "Pilih Produk", to: "/produk" }}
                secondaryAction={{ label: "Cek Status Order", to: "/status" }}
              />
            ) : (
              <div className="cart-list">
                {cart.items.map((item) => (
                  <div key={item.variant_id} className="cart-row">
                    <div className="cart-meta">
                      <div className="cart-title">{item.product_name}</div>
                      <div className="cart-sub">
                        {item.variant_name} • {item.duration_label}
                      </div>
                      <div className="cart-sub">{formatIDR(item.price_idr)}</div>
                    </div>

                    <div className="cart-actions">
                      <div className="qty-wrap">
                        <button className="qty-btn" onClick={() => cart.setQty(item.variant_id, item.qty - 1)} aria-label="Kurangi">
                          −
                        </button>
                        <input
                          className="qty"
                          type="number"
                          min="1"
                          max="99"
                          value={item.qty}
                          onChange={(e) => cart.setQty(item.variant_id, Number(e.target.value))}
                        />
                        <button className="qty-btn" onClick={() => cart.setQty(item.variant_id, item.qty + 1)} aria-label="Tambah">
                          +
                        </button>
                      </div>

                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          cart.remove(item.variant_id);
                          toast.info(`${item.product_name} dihapus`, {
                            title: "Keranjang",
                            actionLabel: "Undo",
                            duration: 6000,
                            onAction: () =>
                              cart.add(
                                {
                                  id: item.variant_id,
                                  product_id: item.product_id,
                                  product_name: item.product_name,
                                  name: item.variant_name,
                                  duration_label: item.duration_label,
                                  price_idr: item.price_idr,
                                },
                                item.qty
                              ),
                          });
                        }}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="divider" />

            <div className="promo-block">
              <div className="promo-row">
                <input
                  className="input"
                  placeholder="Kode promo (contoh: DISC50)"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <button className="btn btn-sm" onClick={onApplyPromo}>
                  Terapkan
                </button>
                {promo.percent ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      clear();
                      toast.info("Promo direset.");
                      setMsg("");
                    }}
                  >
                    Reset
                  </button>
                ) : null}
              </div>
              {msg ? <div className="hint">{msg}</div> : null}
            </div>
          </div>

          <div className="card pad checkout-summary">
            <h3 className="h3">Ringkasan</h3>

            <div className="totals">
              <div className="tot-row">
                <span>Subtotal</span>
                <b>{formatIDR(subtotal)}</b>
              </div>
              <div className="tot-row">
                <span>Diskon</span>
                <b>- {formatIDR(discount)}</b>
              </div>
              <div className="tot-row tot-big">
                <span>Total</span>
                <b>{formatIDR(total)}</b>
              </div>
            </div>

            {promo?.percent ? (
              <div className="hint subtle">
                Promo aktif: <b>{promo.code}</b> ({promo.percent}%)
              </div>
            ) : (
              <div className="hint subtle">
                Kamu bisa pakai kode promo kalau ada.
              </div>
            )}

            <div className="divider" />

            <button className="btn btn-wide" onClick={goPay} disabled={cart.items.length === 0}>
              Bayar sekarang
            </button>

            <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <Link className="btn btn-ghost btn-sm" to="/produk">
                + Tambah produk
              </Link>
              <Link className="btn btn-ghost btn-sm" to="/status">
                Cek status order
              </Link>
            </div>

            <div className="hint subtle">
              Setelah klik, kamu akan masuk ke halaman QRIS + upload bukti pembayaran.
            </div>

            <div className="trust-callout">
              <div className="trust-row">
                <span className="trust-pill">🔒 Bukti bayar tersimpan</span>
                <span className="trust-pill">⚡ Proses cepat</span>
                <span className="trust-pill">✅ Garansi paket</span>
              </div>
              <div className="hint subtle" style={{ marginTop: 8 }}>
                Tip: setelah order jadi, kamu akan dapat <b>ID Order</b> untuk pantau proses.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile sticky CTA */}
      <div className="sticky-cta" aria-label="Ringkasan checkout">
        <div className="sticky-cta-left">
          <div className="sticky-cta-title">Total</div>
          <div className="sticky-cta-value">{formatIDR(total)}</div>
        </div>
        <button className="btn" onClick={goPay} disabled={cart.items.length === 0}>
          Bayar
        </button>
      </div>
    </div>
  );
}
