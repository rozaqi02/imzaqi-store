import { getCatalogPriceRange, isKnownOutOfStock, summarizeCatalogCopy } from "./format";
import { isAcademicProduct } from "./productCategories";

export const PROMOTION_DEFAULTS = {
  flash_sale_popup: { enabled: false },
  academic_popup: { enabled: false },
  new_product_popup: { enabled: false, product_id: "", title: "", description: "", badge: "PRODUK BARU", button_text: "Lihat produknya", link: "", show_on: "home" },
  new_product_banner: { enabled: false, type: "product", product_id: "", text: "", badge: "", color: "orange", banner_style: "minimal_border", link_style: "underline", icon: "none", graphic: "bell_megaphone", link: "" },
  service_banner: { enabled: false, text: "Proses 5–30 menit · Garansi replace · Checkout QRIS", badge: "", color: "green", banner_style: "minimal_border", link_style: "underline", icon: "none", graphic: "shield_star", link: "/produk" },
};

export const BANNER_TYPES = [
  { id: "product", label: "Produk baru", description: "Kenalkan satu produk dari katalog." },
  { id: "flash", label: "Flash sale", description: "Ikuti diskon aktif secara otomatis." },
  { id: "academic", label: "Jasa akademik", description: "Arahkan pelanggan ke layanan kampus." },
  { id: "custom", label: "Pengumuman bebas", description: "Tulis pesan dan tautan sendiri." },
];

export const BANNER_STYLES = [
  { id: "minimal_border", label: "Garis Bawah Aksen", description: "Background bersih dengan garis bawah aksen warna (seperti contoh)." },
  { id: "solid", label: "Warna Penuh (Solid)", description: "Warna pekat penuh di seluruh baris banner." },
  { id: "gradient", label: "Gradasi Modern", description: "Gradasi warna halus & modern." },
  { id: "pill_outline", label: "Kapsul / Outline", description: "Bingkai kapsul melayang dengan border warna." },
];

export const BANNER_GRAPHICS = [
  { id: "bell_megaphone", label: "Lonceng & Megafon 🔔", description: "Maskot hijau bertopi lonceng emas berseru dengan megafon." },
  { id: "rocket_speed", label: "Roket Kilat 🚀", description: "Maskot roket hijau turbo dengan semburan api kilat." },
  { id: "gift_box", label: "Hadiah Kado 🎁", description: "Maskot kado hijau berpita ceria & kilauan bintang." },
  { id: "shield_star", label: "Perisai Garansi 🛡️", description: "Maskot perisai hijau tangguh dengan bintang emas garansi." },
  { id: "discount_tag", label: "Diskon Belanja 🏷️", description: "Maskot kupon diskon hijau ceria dengan tanda %." },
  { id: "flash_lightning", label: "Petir Flash Sale ⚡", description: "Maskot kilat hijau energetik untuk diskon waktu terbatas." },
  { id: "academic_grad", label: "Topi Wisuda Pelajar 🎓", description: "Maskot pelajar hijau berkacamata dengan toga & ijazah." },
  { id: "headset_support", label: "CS Siaga 24/7 🎧", description: "Maskot layanan hijau ber-headset ramah & siap bantu." },
  { id: "qris_wallet", label: "Dompet & QRIS 💳", description: "Maskot dompet hijau dengan koin & kartu scan QRIS." },
  { id: "sparkle_celebration", label: "Bintang Pesta Baru ✨", description: "Maskot bintang hijau ceria bertopi pesta & konfeti." },
  { id: "none", label: "Tanpa Karakter", description: "Tampilan teks & ikon standar tanpa karakter grafis." },
];

export const BANNER_LINK_STYLES = [
  { id: "underline", label: "Garis Bawah", description: "Teks tautan bergaris bawah jelas." },
  { id: "underline_hover", label: "Garis saat Hover", description: "Garis bawah muncul saat diarahkan kursor." },
  { id: "bold_arrow", label: "Tebal + Panah →", description: "Teks tebal dengan panah penunjuk." },
  { id: "pill_button", label: "Tombol Mini", description: "Tautan berupa tombol pill kontras." },
  { id: "plain", label: "Polos", description: "Teks menyatu tanpa dekorasi khusus." },
];

export const BANNER_ICONS = [
  { id: "none", label: "Tanpa Ikon" },
  { id: "bell", label: "Lonceng 🔔" },
  { id: "megaphone", label: "Megafon 📢" },
  { id: "zap", label: "Petir ⚡" },
  { id: "sparkles", label: "Bintang ✨" },
  { id: "shield", label: "Perisai 🛡️" },
  { id: "tag", label: "Diskon 🏷️" },
];

export const BANNER_COLORS = [
  { id: "orange", label: "Oranye", color: "#f97316" },
  { id: "green", label: "Hijau", color: "#009e60" },
  { id: "yellow", label: "Kuning", color: "#f59e0b" },
  { id: "red", label: "Merah", color: "#dc2626" },
  { id: "black", label: "Hitam", color: "#181818" },
  { id: "blue", label: "Biru", color: "#0284c7" },
];

export function normalizePromotion(key, value = {}) {
  const defaults = PROMOTION_DEFAULTS[key];
  if (!defaults) return value || {};
  const result = Object.fromEntries(Object.entries(defaults).map(([field, fallback]) =>
    [field, field === "enabled" ? value?.enabled === true : String(value?.[field] ?? fallback).trim()]
  ));
  if (key === "new_product_popup") result.show_on = result.show_on === "all" ? "all" : "home";
  if (key === "new_product_banner" || key === "service_banner") {
    if (!BANNER_COLORS.some(c => c.id === result.color)) result.color = "green";
    if (!BANNER_STYLES.some(s => s.id === result.banner_style)) result.banner_style = "minimal_border";
    if (!BANNER_GRAPHICS.some(g => g.id === result.graphic)) result.graphic = key === "service_banner" ? "shield_star" : "bell_megaphone";
    if (!BANNER_LINK_STYLES.some(ls => ls.id === result.link_style)) result.link_style = "underline";
    if (!BANNER_ICONS.some(ic => ic.id === result.icon)) result.icon = "none";
  }
  if (key === "new_product_banner") {
    if (!BANNER_TYPES.some(type => type.id === result.type)) result.type = "product";
    if (!value?.type && !result.product_id && result.text) result.type = "custom";
  }
  if (key === "service_banner") {
    if (!result.text) result.text = "Proses 5–30 menit · Garansi replace · Checkout QRIS";
    if (!result.link) result.link = "/produk";
  }
  return result;
}

export function productPromotionCopy(product) {
  return {
    title: product ? `Baru hadir: ${product.name}` : "Produk baru di Imzaqi Store",
    description: summarizeCatalogCopy(product?.description) || "Temukan pilihan paket dan detail produk di katalog kami.",
    text: product ? `${product.name} sekarang tersedia. Lihat paketnya!` : "Produk baru tersedia. Jelajahi katalog kami!",
    link: product?.slug ? `/produk/${product.slug}` : "/produk",
  };
}

export function isPromotionLinkValid(value) {
  const link = String(value || "").trim();
  if (!link) return true;
  if (/\s|[\\\u0000-\u001f]/.test(link)) return false;
  if (link.startsWith("/") && !link.startsWith("//")) return true;
  try { return ["http:", "https:"].includes(new URL(link).protocol); }
  catch { return false; }
}

export function promotionDestination(link, product) {
  return String(link || "").trim() && isPromotionLinkValid(link) ? String(link).trim() : productPromotionCopy(product).link;
}

export function resolvePromotionCopy(config, product) {
  const automatic = productPromotionCopy(product);
  const variants = (product?.product_variants || []).filter(v => v.is_active !== false);
  return {
    title: config.title || automatic.title,
    description: config.description || automatic.description,
    text: config.text || automatic.text,
    badge: config.badge || ("show_on" in config ? "PRODUK BARU" : "BARU"),
    button: config.button_text || "Lihat produknya",
    link: promotionDestination(config.link, product),
    price: getCatalogPriceRange(variants).minPrice,
  };
}

export function resolveBannerCopy(config, products = [], sales = [], now = Date.now()) {
  const type = config.type || "product";
  const product = products.find(item => String(item.id) === String(config.product_id) && item.is_active !== false);
  if (type === "flash") {
    const offer = readyFlashPromotions(sales, products, now)
      .map(sale => {
        const item = products.find(candidate => candidate.is_active !== false && (candidate.product_variants || []).some(variant => variant.id === sale.variant_id));
        return item ? { sale, item } : null;
      }).filter(Boolean).sort((a, b) => Number(b.sale.discount_percent) - Number(a.sale.discount_percent))[0];
    return offer ? {
      available: true, badge: config.badge || "FLASH SALE",
      text: `Flash sale ${offer.item.name} · -${Number(offer.sale.discount_percent)}%`,
      link: productPromotionCopy(offer.item).link,
    } : { available: false, badge: config.badge || "FLASH SALE", text: "Menunggu flash sale aktif", link: "/produk" };
  }
  if (type === "academic") {
    const academic = products.filter(item => item.is_active !== false && isAcademicProduct(item));
    const item = academic.find(candidate => String(candidate.id) === String(config.product_id)) || academic[0];
    return {
      available: Boolean(item), badge: config.badge || "JASA AKADEMIK",
      text: item ? `Butuh bantuan kuliah? Lihat ${item.name}` : "Menunggu layanan akademik aktif",
      link: item ? productPromotionCopy(item).link : "/produk?line=academic",
    };
  }
  if (type === "custom") return {
    available: Boolean(config.text?.trim()), badge: config.badge || "INFO",
    text: config.text?.trim() || "Tulis pesan pengumumanmu di sini",
    link: promotionDestination(config.link, null),
  };
  const copy = resolvePromotionCopy(config, product);
  return { available: Boolean(product), badge: copy.badge, text: copy.text, link: copy.link };
}

export function validatePromotion(key, config, products = []) {
  const errors = {};
  if (config.enabled && (key !== "new_product_banner" || ["product", "custom"].includes(config.type)) && !isPromotionLinkValid(config.link)) errors.link = "Gunakan alamat seperti /produk/netflix atau https://contoh.com.";
  const product = (products || []).find(p => String(p.id) === String(config.product_id) && p.is_active !== false);
  if (config.enabled && key === "new_product_popup" && !product) errors.product_id = "Pilih produk aktif agar logo, harga, dan tautannya bisa ditampilkan.";
  if (config.enabled && key === "new_product_banner") {
    if (config.type === "product" && !product) errors.product_id = "Pilih produk aktif untuk banner produk baru.";
    if (config.type === "custom" && !config.text?.trim()) errors.text = "Tulis pesan untuk pengumuman bebas.";
  }
  if (config.enabled && key === "service_banner") {
    if (!config.text?.trim()) errors.text = "Tulis pesan informasi layanan.";
    if (!isPromotionLinkValid(config.link)) errors.link = "Gunakan alamat seperti /produk atau https://contoh.com.";
  }
  return errors;
}

export function readyFlashPromotions(sales, products, now = Date.now()) {
  return (sales || []).filter(sale => {
    if (sale.is_active === false || !(Date.parse(sale.starts_at) <= now) || !(Date.parse(sale.ends_at) > now)) return false;
    if (!(Number(sale.discount_percent) > 0 && Number(sale.discount_percent) < 100)) return false;
    return products.some(product => product.is_active !== false && (product.product_variants || []).some(variant =>
      variant.id === sale.variant_id && variant.is_active !== false && !isKnownOutOfStock(variant)
    ));
  });
}
