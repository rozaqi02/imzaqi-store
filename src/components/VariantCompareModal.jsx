import React from "react";
import { createPortal } from "react-dom";
import { Clock3, Info, Mail, X } from "lucide-react";
import { formatIDR } from "../lib/format";

function classifyType(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("private")) return "Private";
  if (n.includes("sharing")) return "Sharing";
  if (n.includes("family")) return "Family";
  if (n.includes("student")) return "Student";
  if (n.includes("basic")) return "Basic";
  return "—";
}

export default function VariantCompareModal({ open, variants, flashSaleMap, onClose }) {
  if (!open || !variants || !variants.length) return null;

  return createPortal(
    <div className="modal-backdrop vcm-backdrop" onMouseDown={() => onClose?.()} role="presentation">
      <div
        className="vcm"
        role="dialog"
        aria-modal="true"
        aria-label="Bandingkan varian"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="vcm-head">
          <div className="vcm-title">Bandingkan Varian</div>
          <button className="modal-close" type="button" onClick={() => onClose?.()} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="vcm-body">
          <table className="vcm-table">
            <thead>
              <tr>
                <th className="vcm-labelCol">Detail</th>
                {variants.map((v) => (
                  <th key={v.id} className="vcm-valCol">{v.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="vcm-labelCol">Harga</td>
                {variants.map((v) => {
                  const flash = flashSaleMap?.get(v.id);
                  const price = flash && flash > 0
                    ? Math.round(v.price_idr * (1 - flash / 100))
                    : v.price_idr;
                  return (
                    <td key={v.id} className="vcm-valCol">
                      <strong>{formatIDR(price)}</strong>
                      {flash && flash > 0 ? (
                        <span className="vcm-original">{formatIDR(v.price_idr)}</span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="vcm-labelCol">Tipe</td>
                {variants.map((v) => (
                  <td key={v.id} className="vcm-valCol">{classifyType(v.name)}</td>
                ))}
              </tr>
              <tr>
                <td className="vcm-labelCol">Durasi</td>
                {variants.map((v) => (
                  <td key={v.id} className="vcm-valCol">
                    <Clock3 size={12} />
                    {v.duration_label || "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="vcm-labelCol">Stok</td>
                {variants.map((v) => (
                  <td key={v.id} className="vcm-valCol">{Number(v.stock || 0)}</td>
                ))}
              </tr>
              <tr>
                <td className="vcm-labelCol">Garansi</td>
                {variants.map((v) => (
                  <td key={v.id} className="vcm-valCol">{v.guarantee_text || "Replace 24 Jam"}</td>
                ))}
              </tr>
              {variants.some((v) => v.requires_buyer_email) ? (
                <tr>
                  <td className="vcm-labelCol">Butuh Email</td>
                  {variants.map((v) => (
                    <td key={v.id} className="vcm-valCol">
                      {v.requires_buyer_email ? <Mail size={12} /> : "—"}
                    </td>
                  ))}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="vcm-foot">
          <div className="vcm-hint">
            <Info size={13} />
            <span>Scroll horizontal buat semua varian</span>
          </div>
          <button className="btn btn-sm" type="button" onClick={() => onClose?.()}>
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
