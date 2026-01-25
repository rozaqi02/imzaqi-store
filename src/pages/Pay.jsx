import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/CartContext";
import { usePromo } from "../hooks/usePromo";
import { formatIDR } from "../lib/format";
import { fetchSettings } from "../lib/api";
import { getVisitorIdAsUUID } from "../lib/visitor";
import { makeOrderCode } from "../lib/orderCode";
import CheckoutSteps from "../components/CheckoutSteps";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";

function calcTotal(subtotal, percent) {
  const disc = Math.round((subtotal * (percent || 0)) / 100);
  return { discount: disc, total: Math.max(0, subtotal - disc) };
}

function OrderSuccessModal({ open, orderCode, onClose, waUrl, statusUrl, onCopied }) {
  if (!open) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(orderCode);
    } catch {
      const el = document.createElement("textarea");
      el.value = orderCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    if (typeof onCopied === "function") onCopied();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-head">
          <div>
            <div className="modal-title">Order berhasil dibuat</div>
            <div className="modal-sub">Simpan ID order untuk cek status.</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="order-code">
            <div className="muted">ID Order</div>
            <div className="order-code-value">{orderCode}</div>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={copy}>
              Salin
            </button>
            <a className="btn" href={waUrl} target="_blank" rel="noreferrer">
              Hubungi admin sekarang
            </a>
            <Link className="btn btn-ghost" to={statusUrl}>
              Cek Status
            </Link>
          </div>

          <div className="hint subtle" style={{ marginTop: 10 }}>
            Bukti bayar sudah kamu upload. Admin bisa langsung cek dari dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Pay() {
  const nav = useNavigate();
  const cart = useCart();
  const { promo } = usePromo();
  const toast = useToast();

  usePageMeta({
    title: "Pembayaran",
    description:
      "Scan QRIS, upload bukti pembayaran, lalu klik 'Aku sudah bayar' untuk membuat ID order dan mulai diproses.",
  });

  // Snapshot supaya kalau cart di-clear, ringkasan tetap ada (dan modal tetap stabil)
  const [snapshot, setSnapshot] = useState(cart.items);
  const lastSnapshot = useRef(cart.items);

  useEffect(() => {
    if (cart.items.length > 0) {
      setSnapshot(cart.items);
      lastSnapshot.current = cart.items;
    }
  }, [cart.items]);

  const items = snapshot || [];

  const subtotal = useMemo(() => items.reduce((sum, x) => sum + (x.price_idr * x.qty), 0), [items]);
  const { discount, total } = calcTotal(subtotal, promo.percent);

  const [settings, setSettings] = useState({ whatsapp: { number: "6283136049987" } });
  const waNumber = settings?.whatsapp?.number || "6283136049987";

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [orderCode, setOrderCode] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    let alive = true;
    fetchSettings()
      .then((s) => {
        if (!alive) return;
        setSettings({ whatsapp: s.whatsapp || { number: "6283136049987" } });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // Kalau user refresh dan cart kosong (dan belum sukses), balik ke checkout
    if (!ok && items.length === 0) {
      nav("/checkout", { replace: true });
    }
  }, [items.length, nav, ok]);

  const summaryText = useMemo(() => {
    const lines = items.map((x) => `- ${x.product_name} • ${x.variant_name} (${x.duration_label}) x${x.qty} = ${formatIDR(x.price_idr * x.qty)}`);
    lines.push(`Subtotal: ${formatIDR(subtotal)}`);
    if (promo?.percent) lines.push(`Promo ${promo.code}: -${promo.percent}%`);
    lines.push(`Total: ${formatIDR(total)}`);
    return lines.join("\n");
  }, [items, subtotal, total, promo]);

  const qrisUrl = "/qris_payment.jpeg";

  const waUrl = useMemo(() => {
    const text = encodeURIComponent(
      `Halo kak, saya sudah bayar.\n\nID Order: ${orderCode || "(menunggu)"}\n\n${summaryText}\n\nMohon diproses ya 🙏`
    );
    return `https://wa.me/${waNumber}?text=${text}`;
  }, [waNumber, orderCode, summaryText]);

  const statusUrl = useMemo(() => {
    const code = orderCode || "";
    return code ? `/status?order=${encodeURIComponent(code)}` : "/status";
  }, [orderCode]);

  function onPickFile(fileObj) {
    setErr("");
    if (!fileObj) {
      setFile(null);
      return;
    }

    const ext = String(fileObj.name.split(".").pop() || "").toLowerCase();
    const okExt = ["jpg", "jpeg", "png", "webp"].includes(ext);
    if (!okExt) {
      const t = "Format file harus JPG/JPEG/PNG/WEBP.";
      setErr(t);
      toast.error(t);
      setFile(null);
      return;
    }

    const max = 5 * 1024 * 1024; // 5MB
    if (fileObj.size > max) {
      const t = "File terlalu besar. Maksimal 5MB ya.";
      setErr(t);
      toast.error(t);
      setFile(null);
      return;
    }

    setFile(fileObj);
    toast.success(fileObj.name, { title: "Bukti pembayaran dipilih", duration: 2200 });
  }

  async function uploadProof(fileObj) {
    const ext = (fileObj.name.split(".").pop() || "jpg").toLowerCase();
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const visitor_id = getVisitorIdAsUUID();
    const path = `proofs/${visitor_id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

    const { error: upErr } = await supabase.storage
      .from("payment-proofs")
      .upload(path, fileObj, { cacheControl: "3600", upsert: false });

    if (upErr) throw upErr;

    const { data } = supabase.storage.from("payment-proofs").getPublicUrl(path);
    return data.publicUrl;
  }

  async function createOrder(payment_proof_url, nextCode) {
    const visitor_id = getVisitorIdAsUUID();

    const payload = {
      visitor_id,
      order_code: nextCode,
      items,
      promo_code: promo?.code || null,
      subtotal_idr: subtotal,
      discount_percent: promo?.percent || 0,
      total_idr: total,
      payment_proof_url,
      // Status awal (admin nanti bisa update: pending -> processing -> done)
      status: "pending",
    };

    const { data, error } = await supabase
      .from("orders")
      .insert(payload)
      .select("id,order_code")
      .single();

    if (error) throw error;
    return data;
  }

  async function onConfirmPaid() {
    setErr("");
    if (!file) {
      const t = "Wajib upload screenshot bukti pembayaran dulu.";
      setErr(t);
      toast.error(t);
      return;
    }
    if (items.length === 0) {
      const t = "Keranjang kosong.";
      setErr(t);
      toast.error(t);
      return;
    }

    setBusy(true);
    const loadingId = toast.loading("Memproses order…");
    try {
      const proofUrl = await uploadProof(file);

      // coba beberapa kali untuk hindari tabrakan order_code
      let final;
      let code = "";
      for (let i = 0; i < 10; i++) {
        code = makeOrderCode(4); // IMZ-xxxx
        try {
          final = await createOrder(proofUrl, code);
          break;
        } catch (e) {
          // 23505 = unique_violation
          if (e?.code === "23505") continue;
          throw e;
        }
      }
      if (!final) throw new Error("Gagal membuat ID order unik. Coba lagi.");

      setOrderCode(final.order_code || code);
      setOk(true);
      toast.remove(loadingId);
      toast.success("ID order berhasil dibuat", {
        title: final.order_code || code,
        duration: 3600,
      });

      // bersihkan keranjang setelah sukses
      cart.clear();
    } catch (e) {
      toast.remove(loadingId);
      const msg = e?.message || String(e);
      if (msg.toLowerCase().includes("order_code") || msg.toLowerCase().includes("payment_proof_url") || msg.toLowerCase().includes("promo_code")) {
        const t = "Database belum siap (kolom baru belum ditambahkan). Jalankan file SQL setup yang ada di project.";
        setErr(t + " Detail: " + msg);
        toast.error(t);
      } else if (msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("violates row-level")) {
        setErr(
          "Gagal memproses karena Policy (RLS) Supabase. " +
          "Buka SETUP_SUPABASE.md dan jalankan bagian **Storage policies & Orders policies**. " +
          "Detail: " + msg
        );
        toast.error("Gagal memproses karena policy Supabase (RLS).");
      } else {
        setErr("Gagal memproses. Pastikan bucket Storage sudah dibuat & public. Detail: " + msg);
        toast.error("Gagal memproses pembayaran. Coba lagi ya.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page with-sticky-cta">
      <section className="section reveal">
        <div className="container section-head">
          <div>
            <h1 className="h1">Pembayaran</h1>
            <p className="muted">
              Scan QRIS, upload bukti pembayaran, lalu klik <b>Aku sudah bayar</b>.
            </p>
          </div>
        </div>

        <div className="container" style={{ marginBottom: 14 }}>
          <CheckoutSteps current="pay" />
        </div>

        <div className="container pay-grid">
          <div className="card pad">
            <h3 className="h3">Total yang harus dibayar</h3>
            <div className="pay-total">{formatIDR(total)}</div>

            <div className="hint subtle">
              Subtotal: <b>{formatIDR(subtotal)}</b> • Diskon: <b>-{formatIDR(discount)}</b>
            </div>

            <div className="divider" />

            <div className="qris-wrap">
              <img src={qrisUrl} alt="QRIS pembayaran" className="qris-img" />
            </div>

            <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <a className="btn btn-ghost btn-sm" href={qrisUrl} target="_blank" rel="noreferrer">
                Buka QRIS (fullscreen)
              </a>
              <a className="btn btn-ghost btn-sm" href={waUrl} target="_blank" rel="noreferrer">
                Chat admin (opsional)
              </a>
            </div>

            <div className="divider" />

            <label className="label">Upload screenshot bukti pembayaran (wajib)</label>
            <input
              className="input"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                onPickFile(f);
                // allow re-picking same file
                e.target.value = "";
              }}
            />
            {file ? (
              <div className="hint subtle">
                Dipilih: <b>{file.name}</b> • {(file.size / 1024).toFixed(0)} KB
              </div>
            ) : null}

            {previewUrl ? (
              <div className="proof-preview" aria-label="Preview bukti pembayaran">
                <img src={previewUrl} alt="Preview bukti pembayaran" className="proof-img" />
              </div>
            ) : null}

            <div className="hint subtle">
              Pastikan nominal & tanggal transaksi terlihat jelas ya.
            </div>

            {err ? <div className="hint" style={{ color: "#ffd5dd" }}>{err}</div> : null}

            <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn" disabled={busy || !file} onClick={onConfirmPaid}>
                {busy ? "Memproses..." : "Aku sudah bayar"}
              </button>
              <Link className="btn btn-ghost" to="/checkout">
                Kembali
              </Link>
            </div>
          </div>

          <div className="card pad">
            <h3 className="h3">Ringkasan belanja</h3>

            <div className="cart-list">
              {items.map((x) => (
                <div key={x.variant_id} className="cart-row">
                  <div className="cart-meta">
                    <div className="cart-title">{x.product_name}</div>
                    <div className="cart-sub">{x.variant_name} • {x.duration_label}</div>
                    <div className="cart-sub">{formatIDR(x.price_idr)} × {x.qty}</div>
                  </div>
                  <div className="order-total">{formatIDR(x.price_idr * x.qty)}</div>
                </div>
              ))}
            </div>

            <div className="divider" />

            <div className="totals">
              <div className="tot-row"><span>Subtotal</span><b>{formatIDR(subtotal)}</b></div>
              <div className="tot-row"><span>Diskon</span><b>- {formatIDR(discount)}</b></div>
              <div className="tot-row tot-big"><span>Total</span><b>{formatIDR(total)}</b></div>
            </div>

            {promo?.percent ? (
              <div className="hint subtle">
                Promo: <b>{promo.code}</b> ({promo.percent}%)
              </div>
            ) : null}

            <div className="divider" />

            <a className="btn btn-ghost btn-wide" href={waUrl} target="_blank" rel="noreferrer">
              Chat admin (opsional)
            </a>

            <div className="hint subtle">
              Tombol di atas opsional. Order tetap bisa dibuat tanpa chat, asal upload bukti pembayaran.
            </div>
          </div>
        </div>
      </section>

      {!ok ? (
        <div className="sticky-cta" aria-label="Aksi pembayaran">
          <div className="sticky-cta-left">
            <div className="sticky-cta-title">Total</div>
            <div className="sticky-cta-value">{formatIDR(total)}</div>
          </div>
          <button className="btn" disabled={busy || !file} onClick={onConfirmPaid}>
            {busy ? "Memproses…" : "Aku sudah bayar"}
          </button>
        </div>
      ) : null}

      <OrderSuccessModal
        open={ok}
        orderCode={orderCode}
        onClose={() => setOk(false)}
        waUrl={waUrl}
        statusUrl={statusUrl}
        onCopied={() => toast.success("ID order disalin")}
      />
    </div>
  );
}
