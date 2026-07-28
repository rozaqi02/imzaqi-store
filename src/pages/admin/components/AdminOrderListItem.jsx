import React from "react";
import { ORDER_STATUS_OPTIONS } from "../../../lib/orderStatus";
import { formatIDR } from "../../../lib/format";
import {
  StatusBadge,
  buildWhatsAppLink,
  formatAdminDate,
  getOrderItemCount,
} from "../adminUtils";

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
  const whatsappLink = buildWhatsAppLink(order.customer_whatsapp);

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
          {whatsappLink ? (
            <a className="btn btn-ghost btn-sm" href={whatsappLink} target="_blank" rel="noreferrer">
              WA
            </a>
          ) : null}
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
