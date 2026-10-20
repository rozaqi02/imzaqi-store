import React from "react";
import { MASCOTS_ENABLED } from "../lib/featureFlags";

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
  imzaqi_mascot: { src: "/mascots/imzaqi_mascot.png", alt: "Imzi, maskot resmi Imzaqi Store" },
  imzaqi_mascot_wave: { src: "/mascots/imzaqi_mascot_wave.png", alt: "Imzi menyapa pelanggan" },
  imzaqi_mascot_success: { src: "/mascots/imzaqi_mascot_success.png", alt: "Imzi merayakan pembayaran sukses" },
  imzaqi_mascot_sad: { src: "/mascots/imzaqi_mascot_sad.png", alt: "Imzi bersedih saat ada yang salah" },
};

export default function BannerGraphic({ name, className = "", style = {}, height = 24 }) {
  // Saklar maskot (lihat lib/featureFlags.js). Komponen ini adalah satu-satunya
  // titik render maskot, jadi menonaktifkannya di sini sudah menyembunyikan
  // maskot di seluruh UI tanpa perlu mengedit tiap call site.
  // Aset di public/mascots/ tetap dipertahankan agar mudah diaktifkan kembali.
  if (!MASCOTS_ENABLED) return null;

  if (!name || name === "none") return null;

  const mascot = MASCOT_MAP[name];
  if (!mascot) return null;

  const combinedClass = `promo-tickerMascot mascot-flow ${className}`.trim();
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
