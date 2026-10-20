import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, ChevronDown } from "lucide-react";
import { ORDER_STATUS_OPTIONS } from "../../../lib/orderStatus";
import { formatIDR } from "../../../lib/format";
import {
  StatusBadge,
  buildWhatsAppActionLink,
  WHATSAPP_ACTION_TEMPLATES,
  formatAdminDate,
  getOrderItemCount,
} from "../adminUtils";

function AdminWhatsAppQuickAction({ order }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!order.customer_whatsapp) return null;

  // Smart primary action based on current status
  const primaryType = (() => {
    if (order.status === "pending") return "payment_reminder";
    if (order.status === "paid_reported" || order.status === "processing") return "processing";
    if (order.status === "done") return "credentials";
    return "chat";
  })();

  const primaryLink = buildWhatsAppActionLink(order, primaryType);

  return (
    <div className="admin-waActionWrap" ref={menuRef} style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}>
      <a
        className="btn btn-ghost btn-sm admin-waActionBtn"
        href={primaryLink}
        target="_blank"
        rel="noreferrer"
        title="Buka template WhatsApp cepat sesuai status"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, paddingRight: 6 }}
      >
        <MessageSquare size={13} />
        <span>WA</span>
      </a>
      <button
        type="button"
        className="btn btn-ghost btn-sm admin-waActionToggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Pilih template WhatsApp"
        title="Pilih template pesan WhatsApp"
        style={{ padding: "0 4px", minWidth: 20, borderLeft: "1px solid var(--line, rgba(255, 255, 255, 0.1))" }}
      >
        <ChevronDown size={11} />
      </button>

      {open ? (
        <div
          className="admin-waActionMenu"
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 150,
            minWidth: 230,
            background: "var(--card-bg, #1a2230)",
            border: "1px solid var(--line, rgba(255, 255, 255, 0.14))",
            borderRadius: 14,
            boxShadow: "0 14px 36px rgba(0, 0, 0, 0.45)",
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div
            style={{
              padding: "4px 8px 6px",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--muted, #8ea3bf)",
              borderBottom: "1px solid var(--line, rgba(255, 255, 255, 0.08))",
              marginBottom: 4,
            }}
          >
            Aksi Cepat Pesan WA
          </div>
          {WHATSAPP_ACTION_TEMPLATES.map((tpl) => {
            const link = buildWhatsAppActionLink(order, tpl.id);
            return (
              <a
                key={tpl.id}
                href={link}
                target="_blank"
                rel="noreferrer"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="admin-waMenuItem"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  padding: "6px 8px",
                  borderRadius: 10,
                  textDecoration: "none",
                  color: "var(--text, #fff)",
                  fontSize: 12,
                  lineHeight: 1.25,
                }}
              >
                <strong style={{ fontSize: 12 }}>{tpl.label}</strong>
                <span style={{ fontSize: 10, color: "var(--muted, #8ea3bf)", marginTop: 2 }}>{tpl.desc}</span>
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Memoized order row — virtual list re-renders only rows that change.
 */
function AdminOrderListItem({
  order,
  isSelected,
  onToggleSelect,
  onStatusChange,
  onOpenDetail,
  onCopyStatusLink,
}) {
  const itemCount = getOrderItemCount(order);

  const buyerEmail =
    order.buyer_email ||
    (() => {
      const m = String(order.notes || "").match(/Email buyer:\s*([^\s\n\r]+)/i);
      return m ? m[1] : null;
    })();

  return (
    <article className={`admin-orderListItem${isSelected ? " is-selected" : ""}`}>
      <label className="admin-orderListCheckbox">
        <input
          type="checkbox"
          className="admin-orderCheck"
          checked={isSelected}
          aria-label={`Pilih order ${order.order_code || order.id}`}
          onChange={(e) => onToggleSelect(order.id, e.target.checked)}
        />
      </label>

      <div className="admin-orderListMain">
        <div className="admin-orderListTop">
          <div className="admin-order-code">{order.order_code || order.id}</div>
          <StatusBadge status={order.status} />
        </div>
        <div className="admin-order-sub">
          {formatAdminDate(order.created_at)} · {itemCount} item
          {order.customer_whatsapp ? ` · ${order.customer_whatsapp}` : ""}
          {buyerEmail ? ` · ✉️ ${buyerEmail}` : ""}
        </div>
        <div className="admin-orderListBottom">
          <strong className="admin-orderTotal">{formatIDR(order.total_idr)}</strong>
          {order.promo_code ? <span className="admin-orderTag">{order.promo_code}</span> : null}
        </div>
      </div>

      <div className="admin-orderListRight">
        <select
          className="input admin-select admin-orderInlineSelect"
          value={String(order.status || "pending")}
          aria-label={`Ubah status order ${order.order_code || order.id}`}
          onChange={(e) => onStatusChange(order.id, e.target.value, order.status)}
        >
          {ORDER_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="admin-orderRowActions">
          <AdminWhatsAppQuickAction order={order} />
          <button className="btn btn-sm" type="button" onClick={() => onOpenDetail(order.id)}>
            Detail
          </button>
          <button
            className="btn btn-ghost btn-sm admin-desktopOnly"
            type="button"
            onClick={() => onCopyStatusLink(order.order_code)}
            title="Salin link status"
          >
            Link
          </button>
        </div>
      </div>
    </article>
  );
}

export default React.memo(AdminOrderListItem);
