import React, { useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Clock3,
  Flame,
  Info,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";
import { formatGuaranteeLabel, formatIDR, packDisplayName } from "../lib/format";
import { useDialogA11y } from "../hooks/useDialogA11y";

function classifyType(name) {
  const n = String(name || "").toLowerCase();
  if (n.match(/sharing|share/)) return "Sharing";
  if (n.match(/fam|family/)) return "Family";
  if (n.match(/private|privat|prem|\bpro\b|standart|ultimate|diamond/)) return "Private";
  if (n.match(/student/)) return "Student";
  if (n.match(/basic/)) return "Basic";
  return "Lainnya";
}

function getEffectivePrice(variant, flashSaleMap) {
  const flash = flashSaleMap?.get(variant.id);
  const base = Number(variant.price_idr || 0);
  if (flash && flash > 0) return Math.round(base * (1 - flash / 100));
  return base;
}

function stockTone(stock) {
  const safe = Number(stock ?? 0);
  if (safe <= 0) return "out";
  if (safe <= 5) return "low";
  if (safe <= 20) return "mid";
  return "ok";
}

function stockLabel(stock) {
  const safe = Number(stock ?? 0);
  if (safe <= 0) return "Habis";
  return String(safe);
}

function normalizeGuarantee(text) {
  return formatGuaranteeLabel(text || "Replace 24 Jam");
}

function normalizeDuration(text) {
  const value = String(text || "—").trim();
  if (!value || value === "—") return "—";
  return value.toLowerCase().startsWith("durasi") ? value : value;
}

const ROWS = [
  { key: "price", label: "Harga" },
  { key: "type", label: "Tipe" },
  { key: "duration", label: "Durasi", icon: Clock3 },
  { key: "stock", label: "Stok" },
  { key: "guarantee", label: "Garansi", icon: ShieldCheck },
  { key: "email", label: "Butuh Email", icon: Mail },
];

export default function VariantCompareModal({
  open,
  variants,
  flashSaleMap,
  onClose,
}) {
  const dialogRef = useRef(null);

  useDialogA11y({
    open,
    containerRef: dialogRef,
    onClose,
    initialFocusSelector: ".vcm-close",
  });

  const enriched = useMemo(() => {
    if (!variants?.length) return { items: [], bestPriceId: null, hasDiff: {}, showEmailRow: false };

    const items = variants.map((variant) => {
      const flash = flashSaleMap?.get(variant.id) || 0;
      const price = getEffectivePrice(variant, flashSaleMap);
      return {
        variant,
        flash,
        price,
        type: classifyType(variant.name),
        duration: normalizeDuration(variant.duration_label),
        guarantee: normalizeGuarantee(variant.guarantee_text),
        stock: Number(variant.stock ?? 0),
        requiresEmail: Boolean(variant.requires_buyer_email),
      };
    });

    const inStock = items.filter((item) => item.stock > 0);
    const pricePool = inStock.length ? inStock : items;
    const minPrice = Math.min(...pricePool.map((item) => item.price));
    const bestPriceId = pricePool.find((item) => item.price === minPrice)?.variant.id ?? null;

    const hasDiff = {
      price: new Set(items.map((item) => item.price)).size > 1,
      type: new Set(items.map((item) => item.type)).size > 1,
      duration: new Set(items.map((item) => item.duration)).size > 1,
      stock: new Set(items.map((item) => item.stock)).size > 1,
      guarantee: new Set(items.map((item) => item.guarantee)).size > 1,
      email: new Set(items.map((item) => item.requiresEmail)).size > 1,
    };

    const showEmailRow = hasDiff.email || items.some((item) => item.requiresEmail);

    return { items, bestPriceId, hasDiff, showEmailRow };
  }, [variants, flashSaleMap]);

  if (!open || !variants?.length) return null;

  const { items, bestPriceId, hasDiff, showEmailRow } = enriched;
  const showScrollHint = variants.length > 2;
  const visibleRows = ROWS.filter((row) => row.key !== "email" || showEmailRow);

  const renderCell = (rowKey, item) => {
    const { variant, flash, price, type, duration, guarantee, stock, requiresEmail } = item;
    const isBest = bestPriceId === variant.id && stock > 0;

    switch (rowKey) {
      case "price":
        return (
          <div className="vcm-priceCell">
            <strong className={isBest ? "is-best" : ""}>{formatIDR(price)}</strong>
            {flash > 0 ? (
              <>
                <span className="vcm-original">{formatIDR(variant.price_idr)}</span>
                <span className="vcm-chip vcm-chip--flash">
                  <Flame size={10} aria-hidden="true" />
                  -{flash}%
                </span>
              </>
            ) : null}
          </div>
        );
      case "type":
        return <span className="vcm-typeBadge">{type}</span>;
      case "duration":
        return (
          <span className="vcm-inlineValue">
            <Clock3 size={12} aria-hidden="true" />
            {duration}
          </span>
        );
      case "stock":
        return <span className={`vcm-stock ${stockTone(stock)}`}>{stockLabel(stock)}</span>;
      case "guarantee":
        return <span className="vcm-inlineValue">{guarantee}</span>;
      case "email":
        return requiresEmail ? (
          <span className="vcm-inlineValue">
            <Mail size={12} aria-hidden="true" />
            Wajib
          </span>
        ) : (
          <span className="vcm-muted">—</span>
        );
      default:
        return null;
    }
  };

  return createPortal(
    <div className="modal-backdrop vcm-backdrop" onMouseDown={() => onClose?.()} role="presentation">
      <div
        ref={dialogRef}
        className="vcm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vcm-title"
        aria-describedby="vcm-desc"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="vcm-head">
          <div className="vcm-headText">
            <p className="vcm-label">Paket</p>
            <h2 id="vcm-title" className="vcm-title">Bandingkan</h2>
            <p id="vcm-desc" className="vcm-subtitle">Harga, durasi, stok, dan garansi.</p>
          </div>
          <button
            className="vcm-close"
            type="button"
            onClick={() => onClose?.()}
            aria-label="Tutup perbandingan"
          >
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>

        <div className="vcm-body">
          <div className="vcm-tableWrap">
            <table className="vcm-table">
              <thead>
                <tr>
                  <th className="vcm-labelCol" scope="col">Detail</th>
                  {items.map((item) => {
                    const isBest = bestPriceId === item.variant.id && item.stock > 0;
                    return (
                      <th
                        key={item.variant.id}
                        className={[
                          "vcm-valCol",
                          isBest ? "is-best" : "",
                          item.stock <= 0 ? "is-out" : "",
                        ].filter(Boolean).join(" ")}
                        scope="col"
                      >
                        <span className="vcm-colName">{packDisplayName(item.variant, variants)}</span>
                        <span className="vcm-colMeta">{item.duration}</span>
                        {isBest ? (
                          <span className="vcm-chip vcm-chip--best">Termurah</span>
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.key} className={hasDiff[row.key] ? "is-diff" : ""}>
                    <th className="vcm-labelCol" scope="row">
                      {row.icon ? <row.icon size={12} aria-hidden="true" /> : null}
                      {row.label}
                    </th>
                    {items.map((item) => (
                      <td key={`${row.key}-${item.variant.id}`} className="vcm-valCol">
                        {renderCell(row.key, item)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="vcm-foot">
          {showScrollHint ? (
            <div className="vcm-hint">
              <Info size={13} aria-hidden="true" />
              <span>Geser ke samping untuk lihat semua varian</span>
            </div>
          ) : (
            <div className="vcm-hint vcm-hint--muted">
              <Info size={13} aria-hidden="true" />
              <span>Baris yang disorot = nilai berbeda antar paket</span>
            </div>
          )}
          <button className="btn btn-sm vcm-dismissBtn" type="button" onClick={() => onClose?.()}>
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}