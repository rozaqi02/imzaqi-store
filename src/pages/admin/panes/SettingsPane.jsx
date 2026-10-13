import React from "react";
import StorefrontPromotionSettings from "../components/StorefrontPromotionSettings";
import { formatAdminDate, formatCompactNumber } from "../adminUtils";

/**
 * Presentational pane: Pengaturan (Kontak & pembayaran, promosi storefront,
 * catatan sistem). Diekstrak dari AdminDashboard.jsx — semua state & handler
 * tetap di container dan diteruskan lewat props dengan nama yang identik,
 * sehingga body JSX tidak berubah sama sekali.
 */
export default function SettingsPane({
  settingsWhatsApp,
  setSettingsWhatsApp,
  settingsQrisBase,
  setSettingsQrisBase,
  settingsQrisImageUrl,
  setSettingsQrisImageUrl,
  saveWhatsApp,
  saveQrisSettings,
  settings,
  promotionDraftCache,
  products,
  flashSales,
  setSettings,
  handleSelectTab,
  lastSyncedAt,
  qrisModeLabel,
  qrisModeCopy,
  storePulse,
  analyticsSummary,
}) {
  return (
    <div className="admin-settingsGrid admin-workspaceScroll">
      <div className="admin-panel">
        {/* Section 1: Kontak & Pembayaran */}
        <div className="admin-panel-head">
          <div>
            <div className="admin-panel-title">Kontak & pembayaran</div>
            <div className="admin-panel-sub">WA admin + payload QRIS checkout</div>
          </div>
        </div>

        <div className="admin-panel-body">
          <div className="admin-form-grid admin-form-grid--settings">
            <label className="admin-field admin-field-full">
              <span>WhatsApp Admin</span>
              <input
                className="input"
                value={settingsWhatsApp}
                placeholder="62813..."
                onChange={(e) => setSettingsWhatsApp(e.target.value)}
              />
              <div className="hint subtle">Format angka saja, contoh 62813…</div>
            </label>

            <label className="admin-field admin-field-full">
              <span>QRIS Base Payload</span>
              <textarea
                className="input admin-textarea"
                rows={4}
                value={settingsQrisBase}
                placeholder="000201..."
                onChange={(e) => setSettingsQrisBase(e.target.value)}
              />
              <div className="hint subtle">Dipakai generate QR dengan nominal otomatis.</div>
            </label>

            <label className="admin-field admin-field-full">
              <span>Fallback QR Image URL</span>
              <input
                className="input"
                value={settingsQrisImageUrl}
                placeholder="https://..."
                onChange={(e) => setSettingsQrisImageUrl(e.target.value)}
              />
              <div className="hint subtle">Opsional jika generator QR gagal.</div>
            </label>
          </div>

          <div className="admin-form-actions">
            <button className="btn btn-primary" type="button" onClick={() => saveWhatsApp(settingsWhatsApp)}>
              Simpan WhatsApp
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => saveQrisSettings(settingsQrisBase, settingsQrisImageUrl)}>
              Simpan QRIS
            </button>
          </div>
        </div>

        <StorefrontPromotionSettings
          settings={settings}
          draftCache={promotionDraftCache}
          products={products}
          flashSales={flashSales}
          onSaved={(key, value) => setSettings(current => ({ ...current, [key]: value }))}
          onManageFlashSales={() => handleSelectTab("flashsale")}
          onManageProducts={() => handleSelectTab("products")}
        />

        {/* Section 3: Catatan sistem */}
        <div className="admin-panel-head" style={{ borderTop: "1px solid var(--admin-border, rgba(255,255,255,0.08))", paddingTop: 20 }}>
          <div>
            <div className="admin-panel-title">Catatan sistem</div>
            <div className="admin-panel-sub">Status operasional singkat</div>
          </div>
        </div>

        <div className="admin-panel-body admin-stack">
          <div className="admin-miniCard">
            <span>Last sync</span>
            <strong>{lastSyncedAt ? formatAdminDate(lastSyncedAt) : "-"}</strong>
            <small>Refresh manual bila data belum terbaru</small>
          </div>
          <div className="admin-miniCard">
            <span>QRIS</span>
            <strong>{qrisModeLabel}</strong>
            <small>{qrisModeCopy}</small>
          </div>
          <div className="admin-miniCard">
            <span>Traffic hari ini</span>
            <strong>{formatCompactNumber(storePulse.today_views)} views</strong>
            <small>{storePulse.today_orders || analyticsSummary.todayOrders} order masuk</small>
          </div>
        </div>
      </div>
    </div>
  );
}
