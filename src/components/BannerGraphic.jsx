import React from "react";

const MASCOT_MAP = {
  bell_megaphone: { src: "/mascots/bell_megaphone.png", alt: "Maskot Lonceng & Megafon" },
  rocket_speed: { src: "/mascots/rocket_speed.png", alt: "Maskot Roket Kilat" },
  gift_box: { src: "/mascots/gift_box.png", alt: "Maskot Hadiah Kado" },
  shield_star: { src: "/mascots/shield_star.png", alt: "Maskot Perisai Garansi" },
  discount_tag: { src: "/mascots/discount_tag.png", alt: "Maskot Diskon Belanja" },
  flash_lightning: { src: "/mascots/flash_lightning.png", alt: "Maskot Petir Flash Sale" },
  academic_grad: { src: "/mascots/academic_grad.png", alt: "Maskot Topi Wisuda Pelajar" },
  headset_support: { src: "/mascots/headset_support.png", alt: "Maskot CS Siaga 24/7" },
  qris_wallet: { src: "/mascots/qris_wallet.png", alt: "Maskot Dompet & QRIS" },
  sparkle_celebration: { src: "/mascots/sparkle_celebration.png", alt: "Maskot Bintang Pesta Baru" },
};

export default function BannerGraphic({ name, className = "", style = {}, height = 24 }) {
  if (!name || name === "none") return null;

  const mascot = MASCOT_MAP[name];
  if (!mascot) return null;

  const combinedClass = `promo-tickerMascot ${className}`.trim();
  const aspectStyle = {
    height,
    width: "auto",
    display: "inline-block",
    verticalAlign: "middle",
    objectFit: "contain",
    pointerEvents: "none",
    userSelect: "none",
    ...style,
  };

  return (
    <img
      src={mascot.src}
      alt={mascot.alt}
      className={combinedClass}
      style={aspectStyle}
      loading="lazy"
      draggable={false}
    />
  );
}
