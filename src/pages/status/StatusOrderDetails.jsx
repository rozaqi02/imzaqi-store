import React from "react";
import {
  ArrowUpRight,
  Clock3,
  Mail,
  MessageCircle,
  MessageSquareText,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { formatIDR, getProductIconTone } from "../../lib/format";
import {
  getPaymentMethodLabel,
  getSafeOrderItems,
  getVerificationLabel,
} from "./statusHelpers";

export default function StatusOrderDetails({
  order,
  itemCount,
  productLookup,
  waUrl,
  onReorder,
}) {
  const items = getSafeOrderItems(order?.items);
  const subtotalValue = Number(order?.subtotal_idr || 0);
  const totalValue = Number(order?.total_idr || 0);
  const discountValue = Math.max(0, subtotalValue - totalValue);
  const verificationLabel = getVerificationLabel(order);
  const paymentMethodLabel = getPaymentMethodLabel(order);
  const statusKey = String(order?.status || "pending");
  const showSideReorder =
    items.length > 0 && statusKey !== "done" && statusKey !== "cancelled" && statusKey !== "expired";
  const showSideSupport = statusKey !== "cancelled" && statusKey !== "expired";

  return (
    <div className="st-detailsGrid">
      <div className="st-main">
        <article className="st-card st-itemsCard">
          <div className="st-cardHead st-cardHead--compact">
            <h2 className="st-cardTitle">Paket Dibeli</h2>
            <span className="st-countBadge">{itemCount} item</span>
          </div>

          <div className="st-itemList">
            {items.map((item, index) => {
              const iconUrl = String(item?.product_icon_url || "").trim();
              const guarantee = String(item?.guarantee_text || "").trim();
              const variantName = String(item?.variant_name || "").trim();
              const durationLabel = String(item?.duration_label || "").trim();
              const matchedProduct =
                (item?.product_id ? productLookup.get(item.product_id) : null) ||
                (item?.product_name ? productLookup.get(String(item.product_name).toLowerCase().trim()) : null);
              const description = String(item?.description || matchedProduct?.description || "").trim();
              const requiresEmail = !!item?.requires_buyer_email;
              const qty = Number(item?.qty || 1);
              const unitPrice = Number(item?.price_idr || 0);
              const itemTotal = unitPrice * qty;
              const itemKey = item?.variant_id ? `${item.variant_id}-${index}` : `item-${index}`;

              return (
                <div key={itemKey} className="st-itemRow">
                  <div className="st-itemTop">
                    <div className="st-itemIcon" data-brand-icon={getProductIconTone(item) || undefined} aria-hidden="true">
                      {iconUrl ? (
                        <img src={iconUrl} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span>{String(item?.product_name || "P").slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>

                    <div className="st-itemMain">
                      <div className="st-itemName">{item?.product_name}</div>
                      {variantName ? <div className="st-itemVariant">{variantName}</div> : null}

                      {durationLabel || guarantee || requiresEmail ? (
                        <div className="st-itemFacts">
                          {durationLabel ? (
                            <span className="st-itemFact">
                              <Clock3 size={11} aria-hidden="true" />
                              <span>{durationLabel}</span>
                            </span>
                          ) : null}
                          {guarantee ? (
                            <span className="st-itemFact st-itemFact--guarantee">
                              <ShieldCheck size={11} aria-hidden="true" />
                              <span>{guarantee}</span>
                            </span>
                          ) : null}
                          {requiresEmail ? (
                            <span className="st-itemFact st-itemFact--email">
                              <Mail size={11} aria-hidden="true" />
                              <span>Perlu email aktivasi</span>
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="st-itemPrice">
                      <span className="st-itemPriceQty">×{qty}</span>
                      <b>{formatIDR(itemTotal)}</b>
                      {qty > 1 ? <small>{formatIDR(unitPrice)} / pcs</small> : null}
                    </div>
                  </div>

                  {description ? (
                    <details className="st-itemDescDetails">
                      <summary>Lihat detail paket</summary>
                      <div className="st-itemDesc">
                        <p className="st-itemDescText">{description}</p>
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>

          {order?.notes && String(order.notes).trim() ? (
            <div className="st-buyerNoteBox">
              <div className="st-buyerNoteLabel">
                <MessageSquareText size={13} aria-hidden="true" />
                <span>Catatan Pembeli</span>
              </div>
              <div className="st-noteBody">{order.notes}</div>
            </div>
          ) : null}
        </article>
      </div>

      <aside className="st-aside">
        <article className="st-card st-summaryCard">
          <div className="st-cardHead st-cardHead--compact">
            <h2 className="st-cardTitle">Ringkasan Bayar</h2>
          </div>

          <div className="st-payRows">
            {discountValue > 0 || order?.promo_code ? (
              <>
                <div className="st-payRow">
                  <span>Subtotal</span>
                  <b>{formatIDR(subtotalValue)}</b>
                </div>
                <div className="st-payRow is-discount">
                  <span className="st-promoLabel">
                    Promo
                    {order?.promo_code ? (
                      <code className="st-promoTag">{order.promo_code}</code>
                    ) : null}
                    {Number(order?.discount_percent || 0) > 0 ? (
                      <span>({order.discount_percent}%)</span>
                    ) : null}
                  </span>
                  <b className="st-discountVal">-{formatIDR(discountValue)}</b>
                </div>
              </>
            ) : null}

            <div className="st-payRow is-total">
              <span>Total Tagihan</span>
              <b>{formatIDR(totalValue)}</b>
            </div>
          </div>

          <dl className="st-summaryMeta">
            <div className="st-summaryMetaRow">
              <dt>Metode</dt>
              <dd>{paymentMethodLabel}</dd>
            </div>
            {verificationLabel ? (
              <div className="st-summaryMetaRow">
                <dt>Verifikasi</dt>
                <dd>{verificationLabel}</dd>
              </div>
            ) : null}
            {order?.buyer_email ? (
              <div className="st-summaryMetaRow">
                <dt>Email Aktivasi</dt>
                <dd className="st-buyerEmail">{order.buyer_email}</dd>
              </div>
            ) : null}
          </dl>

          {showSideSupport || showSideReorder ? (
            <div className="st-summaryActions">
              {showSideSupport ? (
                <a
                  className={`btn btn-wide btn-sm${statusKey === "processing" ? "" : " btn-ghost"}`}
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={15} strokeWidth={2.2} aria-hidden="true" />
                  <span>Hubungi Admin WA</span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              ) : null}
              {showSideReorder ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-wide btn-sm"
                  onClick={onReorder}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  <span>Pesan Lagi</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </article>
      </aside>
    </div>
  );
}
