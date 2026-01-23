import React from "react";

function formatIDR(n) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(n);
}

export default function ProductCard({ item, waNumber }) {
  const text = encodeURIComponent(
    `Halo kak, saya mau pesan:\n- ${item.name}\nHarga: ${formatIDR(item.price)}\n\nDari imzaqi.store`
  );

  const waLink = `https://wa.me/${waNumber}?text=${text}`;

  return (
    <div className="card">
      <div className="card-top">
        <div>
          <div className="card-title">{item.name}</div>
          <div className="card-desc">{item.desc}</div>
        </div>
        {item.badge ? <div className="badge">{item.badge}</div> : null}
      </div>

      <div className="card-bottom">
        <div className="price">{formatIDR(item.price)}</div>
        <a className="btn" href={waLink} target="_blank" rel="noreferrer">
          Beli via WhatsApp
        </a>
      </div>
    </div>
  );
}
