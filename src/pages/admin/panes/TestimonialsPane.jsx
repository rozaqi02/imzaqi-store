import React from "react";

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
  return (
    <div className="admin-panel admin-panel--fill admin-testimonialsPanel admin-workspacePane">
      <div className="admin-panel-head">
        <div>
          <div className="admin-panel-title">Testimoni</div>
          <div className="admin-panel-sub">{activeCount} tayang</div>
        </div>
      </div>

      <div className="admin-panel-body admin-panel-body--scroll">
        <form className="admin-testimonial-form admin-stickyTools" onSubmit={onAddTestimonials}>
          <label className="admin-fileBtn">
            <input name="files" type="file" accept="image/*" multiple />
            Pilih gambar
          </label>
          <input name="caption" className="input" placeholder="Caption (opsional)" />
          <input name="customer_name" className="input" placeholder="Nama pelanggan" />
          <input name="product_name" className="input" placeholder="Produk yang dibeli" />
          <input name="purchased_at" className="input" type="date" aria-label="Tanggal pembelian" />
          <label className="admin-check"><input name="is_verified" type="checkbox" /> Pembelian terverifikasi</label>
          <button className="btn btn-primary" type="submit">
            Upload
          </button>
        </form>

        <div className="admin-grid" style={{ marginTop: 14 }}>
          {testimonials.map((t) => (
            <div key={t.id} className="admin-thumb">
              <img src={t.image_url} alt={t.caption || "testimoni"} />
              {t.caption ? <div className="admin-thumb-caption">{t.caption}</div> : null}
              {(t.customer_name || t.product_name) ? <div className="admin-thumb-caption">{[t.customer_name, t.product_name].filter(Boolean).join(" · ")}</div> : null}
              <div className="admin-thumb-actions">
                <button
                  className={"btn btn-sm " + (t.is_active ? "btn-ghost" : "")}
                  type="button"
                  onClick={() => onUpdateTestimonial(t.id, { is_active: !t.is_active })}
                >
                  {t.is_active ? "Off" : "On"}
                </button>
                <button className={"btn btn-sm " + (t.is_verified ? "btn-primary" : "btn-ghost")} type="button" onClick={() => onUpdateTestimonial(t.id, { is_verified: !t.is_verified })}>
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
