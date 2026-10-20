import React, { useState } from "react";
import { Plus } from "lucide-react";
import AdminPicker from "../components/AdminPicker";

function toLocalDatetimeInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function FlashSalePane({
  flashSales,
  liveFlashCount,
  allVariants,
  products,
  flashVariantOptions,
  formatIDR,
  toast,
  openConfirm,
  fetchAllFlashSales,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale,
  setFlashSales,
}) {
  const [flashFormOpen, setFlashFormOpen] = useState(false);
  const [flashForm, setFlashForm] = useState({
    variant_id: "",
    discount_percent: "",
    starts_at: "",
    ends_at: "",
  });

  return (
    <div className="admin-panel admin-panel--fill admin-flashsalePanel admin-workspacePane">
      <div className="admin-panel-head admin-panel-head--split">
        <div>
          <div className="admin-panel-title">Flash sale</div>
          <div className="admin-panel-sub">{liveFlashCount} live sekarang</div>
        </div>
        <div className="admin-panel-headActions">
          <button className="btn btn-sm btn-primary" type="button" onClick={() => setFlashFormOpen(true)}>
            <Plus size={14} /> Buat
          </button>
        </div>
      </div>

      <div className="admin-panel-body admin-panel-body--scroll">
        {flashFormOpen ? (
          <div className="admin-promo-card" style={{ marginBottom: 16, padding: 16 }}>
            <div className="admin-panel-title" style={{ fontSize: 14, marginBottom: 12 }}>
              {flashForm.id ? "Edit Flash Sale" : "Buat Flash Sale Baru"}
            </div>
            <div className="admin-form-grid">
              <div className="admin-field-full">
                <AdminPicker
                  label="Varian flash sale"
                  placeholder="Pilih produk dan paket"
                  value={flashForm.variant_id}
                  options={flashVariantOptions}
                  onChange={(id) => setFlashForm((f) => ({ ...f, variant_id: id }))}
                />
              </div>
              <label className="admin-field">
                <span>Diskon (%)</span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="99"
                  placeholder="10"
                  value={flashForm.discount_percent}
                  onChange={(e) => setFlashForm((f) => ({ ...f, discount_percent: e.target.value }))}
                />
              </label>
              <label className="admin-field">
                <span>Mulai</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={flashForm.starts_at}
                  onChange={(e) => setFlashForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
              </label>
              <label className="admin-field">
                <span>Berakhir</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={flashForm.ends_at}
                  onChange={(e) => setFlashForm((f) => ({ ...f, ends_at: e.target.value }))}
                />
              </label>
            </div>
            {flashForm.variant_id && flashForm.discount_percent ? (() => {
              const v = allVariants.find((x) => x.id === flashForm.variant_id);
              if (!v) return null;
              const discounted = Math.round(v.price_idr * (1 - Number(flashForm.discount_percent) / 100));
              return (
                <div className="admin-promo-preview" style={{ marginTop: 8 }}>
                  <span className="admin-promo-previewLabel">Preview harga</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                    <span style={{ textDecoration: "line-through", color: "var(--brand-muted)", fontSize: 13 }}>
                      {formatIDR(v.price_idr)}
                    </span>
                    <span className="admin-promo-previewPrice">{formatIDR(discounted)}</span>
                    <span style={{ fontSize: 11, color: "var(--brand-muted)" }}>(-{flashForm.discount_percent}%)</span>
                  </div>
                </div>
              );
            })() : null}
            <div className="admin-form-actions" style={{ marginTop: 12 }}>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => {
                  setFlashFormOpen(false);
                  setFlashForm({ variant_id: "", discount_percent: "", starts_at: "", ends_at: "" });
                }}
              >
                Batal
              </button>
              <button
                className="btn btn-sm"
                type="button"
                onClick={async () => {
                  if (!flashForm.variant_id || !flashForm.discount_percent || !flashForm.starts_at || !flashForm.ends_at) {
                    toast.error("Lengkapi semua field");
                    return;
                  }
                  const disc = Math.floor(Number(flashForm.discount_percent));
                  if (!Number.isFinite(disc) || disc < 1 || disc > 99) {
                    toast.error("Diskon flash sale harus antara 1% – 99%");
                    return;
                  }
                  if (new Date(flashForm.ends_at) <= new Date(flashForm.starts_at)) {
                    toast.error("Tanggal selesai harus setelah tanggal mulai");
                    return;
                  }
                  const tid = toast.loading("Menyimpan flash sale");
                  try {
                    if (flashForm.id) {
                      await updateFlashSale(flashForm.id, {
                        variant_id: flashForm.variant_id,
                        discount_percent: disc,
                        starts_at: new Date(flashForm.starts_at).toISOString(),
                        ends_at: new Date(flashForm.ends_at).toISOString(),
                      });
                    } else {
                      await createFlashSale({
                        variant_id: flashForm.variant_id,
                        discount_percent: disc,
                        starts_at: new Date(flashForm.starts_at).toISOString(),
                        ends_at: new Date(flashForm.ends_at).toISOString(),
                      });
                    }
                    setFlashSales(await fetchAllFlashSales());
                    setFlashFormOpen(false);
                    setFlashForm({ variant_id: "", discount_percent: "", starts_at: "", ends_at: "" });
                    toast.remove(tid);
                    toast.success("Flash sale disimpan");
                  } catch (e) {
                    toast.remove(tid);
                    toast.error(e?.message || "Gagal simpan flash sale");
                  }
                }}
              >
                Simpan
              </button>
            </div>
          </div>
        ) : null}

        {flashSales.length === 0 ? (
          <div className="admin-emptyInline">Belum ada flash sale. Klik "Buat Flash Sale" untuk mulai.</div>
        ) : (
          <div className="admin-promo-grid">
            {flashSales.map((fs) => {
              const now = new Date();
              const isExpired = new Date(fs.ends_at) < now;
              const isUpcoming = new Date(fs.starts_at) > now;
              const isLive = !isExpired && !isUpcoming && fs.is_active;
              const variant = allVariants.find((v) => v.id === fs.variant_id);
              const product = (products || []).find((p) =>
                (p.product_variants || []).some((v) => v.id === fs.variant_id)
              );

              return (
                <div key={fs.id} className={`admin-promo-card ${isExpired ? "is-expired" : ""}`}>
                  <div className="admin-promo-cardTop">
                    <div className="admin-promo-cardLeft">
                      <div className="admin-promo-cardCode">
                        <span>{product?.name || "?"} - {variant?.name || fs.variant_id.slice(0, 8)}</span>
                      </div>
                      <span className={`admin-promoBadge ${isLive ? "active" : isExpired ? "expired" : "off"}`}>
                        {isLive ? "Live" : isExpired ? "Berakhir" : isUpcoming ? "Akan datang" : "Nonaktif"}
                      </span>
                    </div>
                    <div className="admin-promo-cardDiscount">{fs.discount_percent}%</div>
                  </div>

                  <div className="admin-promo-cardMeta">
                    <span>Mulai: {new Date(fs.starts_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    <span>Akhir: {new Date(fs.ends_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>

                  <div className="admin-promo-cardActions">
                    <button
                      className="btn btn-sm btn-ghost"
                      type="button"
                      onClick={() => {
                        setFlashForm({
                          id: fs.id,
                          variant_id: fs.variant_id,
                          discount_percent: String(fs.discount_percent),
                          starts_at: toLocalDatetimeInput(fs.starts_at),
                          ends_at: toLocalDatetimeInput(fs.ends_at),
                        });
                        setFlashFormOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      type="button"
                      onClick={() => {
                        openConfirm({
                          title: "Hapus flash sale",
                          message: "Hapus flash sale ini?",
                          confirmLabel: "Ya, hapus",
                          danger: true,
                          onConfirm: async () => {
                            const tid = toast.loading("Menghapus");
                            try {
                              await deleteFlashSale(fs.id);
                              setFlashSales(await fetchAllFlashSales());
                              toast.remove(tid);
                              toast.success("Dihapus");
                            } catch (e) {
                              toast.remove(tid);
                              toast.error("Gagal hapus");
                            }
                          },
                        });
                      }}
                    >
                      Hapus
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      type="button"
                      onClick={async () => {
                        const tid = toast.loading("Update");
                        try {
                          await updateFlashSale(fs.id, { is_active: !fs.is_active });
                          setFlashSales(await fetchAllFlashSales());
                          toast.remove(tid);
                        } catch (e) {
                          toast.remove(tid);
                          toast.error("Gagal update");
                        }
                      }}
                    >
                      {fs.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
