import React, { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";

/**
 * Presentational pane: Testimoni.
 * Diekstrak dari AdminDashboard.jsx — semua state & handler tetap hidup di
 * container (AdminDashboard) dan diteruskan lewat props, sehingga komponen ini
 * murni tampilan dan mudah di-code-split / diuji.
 */
export default function TestimonialsPane({
  activeCount,
  testimonials,
  onAddTestimonials,
  onUpdateTestimonial,
  onDeleteTestimonial,
  openConfirm,
}) {
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);

  return (
    <div className="admin-panel admin-panel--fill admin-testimonialsPanel admin-workspacePane">
      <div className="admin-panel-head">
        <div>
          <div className="admin-panel-title">Testimoni</div>
          <div className="admin-panel-sub">{activeCount} tayang</div>
        </div>
      </div>

      <div className="admin-panel-body admin-panel-body--scroll">
        <div
          className="admin-notice admin-notice--warning"
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(234, 179, 8, 0.12)",
            border: "1px solid rgba(234, 179, 8, 0.35)",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle size={18} style={{ color: "#eab308", flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: "13px", lineHeight: "1.4" }}>
            <strong>Proteksi Privasi Pelanggan (P0):</strong> Pastikan screenshot chat/bukti transaksi sudah disensor (blur/crop) pada bagian alamat email, kata sandi, PIN, token, dan nomor telepon sebelum diunggah ke publik.
          </div>
        </div>

        <form
          className="admin-testimonial-form admin-stickyTools"
          onSubmit={(e) => {
            if (!privacyConfirmed) {
              e.preventDefault();
              return;
            }
            onAddTestimonials(e);
            setPrivacyConfirmed(false);
          }}
        >
          <label className="admin-fileBtn">
            <input name="files" type="file" accept="image/*" multiple required />
            Pilih gambar
          </label>
          <input name="caption" className="input" placeholder="Caption (opsional)" />
          <input name="customer_name" className="input" placeholder="Nama pelanggan" />
          <input name="product_name" className="input" placeholder="Produk yang dibeli" />
          <input name="purchased_at" className="input" type="date" aria-label="Tanggal pembelian" />
          <label className="admin-check">
            <input name="is_verified" type="checkbox" /> Pembelian terverifikasi
          </label>

          <label
            className="admin-check"
            style={{
              width: "100%",
              marginTop: 4,
              color: privacyConfirmed ? "inherit" : "#eab308",
              fontWeight: 500,
            }}
          >
            <input
              name="privacy_confirmed"
              type="checkbox"
              checked={privacyConfirmed}
              onChange={(e) => setPrivacyConfirmed(e.target.checked)}
              required
            />
            <ShieldCheck size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
            Saya telah memastikan tidak ada email, password, atau nomor telepon pelanggan pada gambar ini
          </label>

          <button className="btn btn-primary" type="submit" disabled={!privacyConfirmed}>
            Upload
          </button>
        </form>

        <div className="admin-grid" style={{ marginTop: 14 }}>
          {testimonials.map((t) => (
            <div key={t.id} className="admin-thumb">
              <img src={t.image_url} alt={t.caption || "testimoni"} />
              {t.caption ? <div className="admin-thumb-caption">{t.caption}</div> : null}
              {t.customer_name || t.product_name ? (
                <div className="admin-thumb-caption">
                  {[t.customer_name, t.product_name].filter(Boolean).join(" · ")}
                </div>
              ) : null}
              <div className="admin-thumb-actions">
                <button
                  className={"btn btn-sm " + (t.is_active ? "btn-ghost" : "")}
                  type="button"
                  onClick={() => onUpdateTestimonial(t.id, { is_active: !t.is_active })}
                >
                  {t.is_active ? "Off" : "On"}
                </button>
                <button
                  className={"btn btn-sm " + (t.is_verified ? "btn-primary" : "btn-ghost")}
                  type="button"
                  onClick={() => onUpdateTestimonial(t.id, { is_verified: !t.is_verified })}
                >
                  {t.is_verified ? "Verified" : "Verifikasi"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => {
                    openConfirm({
                      title: "Edit caption",
                      prompt: true,
                      promptDefault: t.caption || "",
                      promptLabel: "Caption",
                      confirmLabel: "Simpan",
                      onConfirm: (newCaption) =>
                        onUpdateTestimonial(t.id, { caption: String(newCaption || "") }),
                    });
                  }}
                >
                  Caption
                </button>
                <button className="btn btn-danger btn-sm" type="button" onClick={() => onDeleteTestimonial(t.id)}>
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
