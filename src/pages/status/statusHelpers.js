import { CheckCircle2, Clock3, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { getOrderStatusTone, prettyOrderStatus } from "../../lib/orderStatus";
import { formatIDR } from "../../lib/format";
import { supabase } from "../../lib/supabaseClient";

export const POLL_INTERVAL_MS = 30_000;
export const TERMINAL_STATUSES = new Set(["done", "cancelled", "expired"]);

export function prettyStatus(status) {
  const value = String(status || "pending");
  const map = {
    pending: "Menunggu Bayar",
    pending_payment: "Menunggu Bayar",
    paid_reported: "Menunggu Verifikasi",
    processing: "Diproses",
    done: "Selesai",
    cancelled: "Dibatalkan",
    expired: "Kedaluwarsa",
  };
  return map[value] || prettyOrderStatus(value);
}

export function getStatusMeta(orderOrStatus) {
  const order = typeof orderOrStatus === "object" && orderOrStatus !== null ? orderOrStatus : null;
  const value = String(order ? order.status : orderOrStatus || "pending");
  const tone = getOrderStatusTone(value);

  if (value === "done") {
    return {
      tone,
      icon: CheckCircle2,
      subtitle: order?.admin_note
        ? "Pesanan selesai! Catatan dan akses dari admin ada di bawah."
        : "Pesanan selesai. Cek email/WhatsApp atau hubungi admin bila perlu bantuan.",
    };
  }
  if (value === "processing") {
    return {
      tone,
      icon: RefreshCw,
      subtitle: "Pembayaran diterima. Admin sedang menyiapkan paket pesananmu.",
    };
  }
  if (value === "cancelled") {
    return {
      tone,
      icon: XCircle,
      subtitle: "Pesanan ini dibatalkan. Kamu bisa memesan ulang atau tanya admin.",
    };
  }
  if (value === "expired") {
    return {
      tone,
      icon: Clock3,
      subtitle: "Batas waktu pembayaran berakhir sehingga stok dilepas otomatis.",
    };
  }
  if (value === "paid_reported") {
    return {
      tone,
      icon: ShieldCheck,
      subtitle: order?.late_payment_report
        ? "Bukti bayar masuk melewati batas reservasi. Admin akan mengecek manual."
        : "Bukti bayar sudah masuk. Admin sedang memverifikasi pembayaranmu.",
    };
  }
  return {
    tone,
    icon: Clock3,
    subtitle: "Selesaikan pembayaran QRIS lalu kirim/unggah bukti bayar agar segera diproses.",
  };
}

export function getTimeline(status) {
  const value = String(status || "pending");
  if (value === "cancelled" || value === "expired") {
    return [
      { key: "pending", label: "Order Masuk", active: true, done: true },
      {
        key: value,
        label: value === "expired" ? "Kedaluwarsa" : "Dibatalkan",
        active: true,
        done: false,
      },
    ];
  }

  const normalized = value === "pending_payment" ? "pending" : value;
  const pastPending = normalized !== "pending";
  const isPaidReported = normalized === "paid_reported";
  const isProcessing = normalized === "processing";
  const isDone = normalized === "done";

  return [
    { key: "pending", label: "Order Masuk", active: true, done: pastPending },
    {
      key: "paid_reported",
      label: "Verifikasi",
      active: isPaidReported || isProcessing || isDone,
      done: isProcessing || isDone,
    },
    {
      key: "processing",
      label: "Diproses",
      active: isProcessing || isDone,
      done: isDone,
    },
    { key: "done", label: "Selesai", active: isDone, done: isDone },
  ];
}

export function getSafeOrderItems(items) {
  if (Array.isArray(items)) return items;
  if (typeof items === "string" && items.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function extractCredentials(text) {
  if (!text) return null;
  const lines = String(text).split("\n");
  let email = null;
  let password = null;

  for (const line of lines) {
    const emailMatch = line.match(/(?:email|surel|username|user|akun)\s*[:=]\s*([^\s]+)/i);
    if (emailMatch && !email) {
      email = emailMatch[1].trim();
    } else {
      const rawEmail = line.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
      if (rawEmail && !email && !line.toLowerCase().includes("bantuan") && !line.toLowerCase().includes("support")) {
        email = rawEmail[0];
      }
    }

    const passMatch = line.match(/(?:password|pass|sandi|pin)\s*[:=]\s*([^\s]+)/i);
    if (passMatch && !password) {
      password = passMatch[1].trim();
    }
  }

  if (!email && !password) {
    const comboMatch = String(text).match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})[:|\s]+([^\s\n]+)/);
    if (comboMatch) {
      email = comboMatch[1];
      password = comboMatch[2];
    }
  }

  if (email || password) {
    return { email, password };
  }
  return null;
}

export function sanitizeOrderInput(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export function normalizeOrderCode(value) {
  const cleaned = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return "";
  const withoutPrefix = cleaned.startsWith("IMZ") ? cleaned.slice(3) : cleaned;
  if (withoutPrefix.length === 8) return `IMZ-${withoutPrefix}`;
  return cleaned;
}

export async function fetchOrderByCode(orderCode) {
  const result = await supabase.rpc("get_order_public", { p_order_code: orderCode });
  if (result.error) throw result.error;
  return Array.isArray(result.data) ? result.data[0] : result.data;
}

export function formatDateShort(isoString) {
  if (!isoString) return "-";
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "-";
  }
}

export function formatRelativeTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "baru saja";
  if (seconds < 60) return `${seconds} dtk lalu`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} mnt lalu`;
  return `${Math.round(minutes / 60)} jam lalu`;
}

export function formatReservationCountdown(order, nowMs) {
  const status = String(order?.status || "");
  if ((status !== "pending" && status !== "pending_payment") || !order?.reservation_expires_at) {
    return null;
  }
  const expiresMs = new Date(order.reservation_expires_at).getTime();
  if (Number.isNaN(expiresMs)) return null;
  const remainingSec = Math.max(0, Math.floor((expiresMs - nowMs) / 1000));
  if (remainingSec <= 0) {
    return { label: "Batas pembayaran berakhir", isExpired: true };
  }
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  return {
    label: `Batas bayar ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
    isExpired: false,
  };
}

export function getPaymentMethodLabel(order) {
  if (Number(order?.total_idr || 0) <= 0) return "Gratis (Promo 100%)";
  const ref = String(order?.payment_reference || "").trim();
  if (ref) return `QRIS · ${ref}`;
  return "QRIS";
}

export function getVerificationLabel(order) {
  const raw = String(order?.verification_status || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "verified") return "Terverifikasi";
  if (raw === "reported") return "Menunggu dicek";
  if (raw === "rejected") return "Perlu konfirmasi ulang";
  if (raw === "unverified") return "Belum lapor bayar";
  return null;
}

export function buildOrderWaUrls({ order, fallbackCode = "", waNumber }) {
  const items = getSafeOrderItems(order?.items);
  const code = order?.order_code || fallbackCode || "";
  const itemLines = items
    .map((item) => `• ${item.product_name || "-"} / ${item.variant_name || "-"} x${item.qty || 1}`)
    .join("\n");

  const checkLines = [
    "Halo admin, saya ingin cek order.",
    "",
    `ID Order: ${code}`,
    order?.status ? `Status: ${prettyStatus(order.status)}` : null,
    order?.total_idr ? `Total: ${formatIDR(order.total_idr)}` : null,
    itemLines ? `\nItem:\n${itemLines}` : null,
  ].filter(Boolean);
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(checkLines.join("\n"))}`;

  let proofWaUrl = "";
  if (code) {
    const proofLines = [
      "Halo Admin Imzaqi Store, saya ingin mengirimkan bukti pembayaran:",
      "",
      `• ID Order: ${code}`,
      order?.total_idr ? `• Total Tagihan: ${formatIDR(order.total_idr)}` : null,
      itemLines ? `• Paket:\n${itemLines}` : null,
      "",
      "Berikut saya lampirkan foto bukti transfernya ya kak. Mohon segera dicek dan diproses. Terima kasih!",
    ].filter(Boolean);
    proofWaUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(proofLines.join("\n"))}`;
  }

  const warrantyLines = [
    "Halo Admin Imzaqi Store, saya ingin klaim garansi / kendala akun:",
    "",
    `• ID Order: ${code}`,
    itemLines
      ? `• Paket:\n${items.map((item) => `• ${item.product_name || "-"} / ${item.variant_name || "-"}`).join("\n")}`
      : null,
    "• Kendala Akun: [Tuliskan kendala di sini, misal: login kena limit / password berubah]",
    "",
    "Mohon dibantu ya admin. Terima kasih!",
  ].filter(Boolean);
  const claimWarrantyUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(warrantyLines.join("\n"))}`;

  return { waUrl, proofWaUrl, claimWarrantyUrl };
}
