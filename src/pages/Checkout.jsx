import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, ShoppingBag, WalletCards } from "lucide-react";
import { useCart } from "../context/CartContext";
import { usePromo } from "../hooks/usePromo";
import { formatIDR } from "../lib/format";
import CheckoutSteps from "../components/CheckoutSteps";
import EmptyState from "../components/EmptyState";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";

function calcTotal(subtotal, percent) {
  const discount = Math.round((subtotal * (percent || 0)) / 100);
  return { discount, total: Math.max(0, subtotal - discount) };
}

export default function Checkout() {
  const nav = useNavigate();
  const cart = useCart();
  const { promo, apply, clear } = usePromo();
  const toast = useToast();

  const promoPercent = Number(promo?.percent || 0);
  const subtotal = cart.subtotal();
  const { discount, total } = calcTotal(subtotal, promoPercent);

  const [code, setCode] = useState(() => promo?.code || "");
  const [msg, setMsg] = useState("");

  usePageMeta({
    title: "Checkout",
    description: "Ringkasan order sebelum masuk ke halaman pembayaran.",
  });

  useEffect(() => {
    const next = promo?.code || "";
    setCode((prev) => (prev ? prev : next));
  }, [promo]);

  const itemCount = useMemo(() => cart.items.reduce((sum, item) => sum + Number(item.qty || 0), 0), [cart.items]);

  async function onApplyPromo() {
    const raw = String(code || "").trim();
    if (!raw) {
      const text = "Kode promo kosong.";
      setMsg(text);
      toast.error(text);
      return;
    }

    setMsg("");
    const result = await apply(raw);
    setMsg(result.message);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }

  function goPay() {
    if (cart.items.length === 0) {
      const text = "Keranjang masih kosong.";
      setMsg(text);
      toast.error(text);
      return;
    }

    nav("/bayar");
  }

  return (
    <div className="page with-sticky-cta checkout-min">
      <section className="section reveal checkout-min-hero">
        <div className="container">
          <div className="checkout-min-head">
            <div>
              <h1 className="h1">Checkout</h1>
            </div>
          </div>
        </div>

        <div className="container" style={{ marginBottom: 14 }}>
          <CheckoutSteps current="checkout" />
        </div>

        <div className="container checkout-min-grid">
          <section className="card pad checkout-min-main">
            <div className="checkout-min-sectionHead">
              <h3 className="h3">Keranjang</h3>
              <span className="checkout-min-badge">{itemCount}</span>
            </div>

            {cart.items.length === 0 ? (
              <EmptyState
                icon="Bag"
                title="Keranjang kosong"
                description="Pilih produk dulu."
                primaryAction={{ label: "Produk", to: "/produk" }}
                secondaryAction={{ label: "Status", to: "/status" }}
              />
            ) : (
              <div className="checkout-min-items">
                {cart.items.map((item) => (
                  <div key={item.variant_id} className="checkout-min-item">
                    <div className="checkout-min-itemInfo">
                      <div className="checkout-min-itemTitle">{item.product_name}</div>
                      <div className="checkout-min-itemMeta">
                        <span>{item.variant_name}</span>
                        <span>{item.duration_label}</span>
                      </div>
                    </div>

                    <div className="checkout-min-itemSide">
                      <div className="checkout-min-itemPrice">{formatIDR(item.price_idr * item.qty)}</div>
                      <div className="checkout-min-qty">
                        <button className="qty-btn" onClick={() => cart.setQty(item.variant_id, item.qty - 1)} aria-label="Kurangi">
                          -
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
                    </div>

                    <button
                      className="btn btn-ghost btn-sm checkout-min-remove"
                      type="button"
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
                ))}
              </div>
            )}

            <div className="divider" />

            <div className="checkout-min-promo">
              <div className="checkout-min-promoRow">
                <input
                  className="input"
                  placeholder="Masukkan kode promo di sini"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <button className="btn btn-sm" type="button" onClick={onApplyPromo}>
                  Pakai
                </button>
                {promoPercent ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => {
                      clear();
                      setMsg("");
                      toast.info("Promo direset.");
                    }}
                  >
                    Reset
                  </button>
                ) : null}
              </div>
              {msg ? <div className="hint">{msg}</div> : null}
            </div>
          </section>

          <aside className="card pad checkout-min-side">
            <div className="checkout-min-sideTop">
              <div className="checkout-min-totalLabel">Total</div>
              <div className="checkout-min-totalValue">{formatIDR(total)}</div>
            </div>

            <div className="checkout-min-meter" aria-hidden="true">
              <span style={{ width: `${subtotal ? Math.max(18, (total / subtotal) * 100) : 100}%` }} />
            </div>

            <div className="checkout-min-breakdown">
              <div className="checkout-min-row">
                <span>Subtotal</span>
                <b>{formatIDR(subtotal)}</b>
              </div>
              {discount > 0 ? (
                <div className="checkout-min-row">
                  <span>Diskon</span>
                  <b>- {formatIDR(discount)}</b>
                </div>
              ) : null}
            </div>

            <div className="checkout-min-icons" aria-label="Langkah berikutnya">
              <div className="checkout-min-iconCard">
                <ShoppingBag size={16} />
                <span>Cek</span>
              </div>
              <div className="checkout-min-iconCard">
                <WalletCards size={16} />
                <span>Bayar</span>
              </div>
              <div className="checkout-min-iconCard">
                <ShieldCheck size={16} />
                <span>Upload</span>
              </div>
            </div>

            <button className="btn btn-wide checkout-min-go" type="button" onClick={goPay} disabled={cart.items.length === 0}>
              <span>Lanjut</span>
              <ArrowRight size={16} />
            </button>

            <div className="checkout-min-actions">
              <Link className="btn btn-ghost btn-sm" to="/produk">
                Produk
              </Link>
              <Link className="btn btn-ghost btn-sm" to="/status">
                Status
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <div className="sticky-cta" aria-label="Ringkasan checkout">
        <div className="sticky-cta-left">
          <div className="sticky-cta-title">Total</div>
          <div className="sticky-cta-value">{formatIDR(total)}</div>
        </div>
        <button className="btn" onClick={goPay} disabled={cart.items.length === 0} type="button">
          Lanjut
        </button>
      </div>
    </div>
  );
}
