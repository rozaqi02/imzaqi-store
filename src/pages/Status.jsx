import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { fireConfetti } from "../components/Confetti";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BadgePercent,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Flame,
  History,
  Info,
  Mail,
  MessageCircle,
  MessageSquareText,
  Package,
  PartyPopper,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  Trash2,
  Upload,
  WalletCards,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { formatIDR, getProductIconTone, toWhatsAppDigits } from "../lib/format";
import { fetchSettings, fetchProducts } from "../lib/api";
import { STORE_WHATSAPP } from "../lib/productCategories";
import { prettyOrderStatus, getOrderStatusTone } from "../lib/orderStatus";
import { useCart } from "../context/CartContext";
import { compressImage } from "../utils/imageCompress";
import {
  getOrderHistory,
  updateOrderHistoryStatus,
  updateOrderHistoryEntry,
  removeOrderFromHistory,
  clearOrderHistory,
} from "../lib/orderHistory";
import CheckoutSteps from "../components/CheckoutSteps";
import { StatusHero } from "../components/StorefrontHero";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { warn } from "../lib/log";
import { copyToClipboard } from "../utils/clipboard";
import { recordCompletedOrder } from "../lib/loyalty";
import { getVisitorIdAsUUID } from "../lib/visitor";
import { trackFunnelEvent } from "../lib/funnelAnalytics";

// Constants

const POLL_INTERVAL_MS = 30_000;
const TERMINAL_STATUSES = new Set(["done", "cancelled", "expired"]);

// Helpers

function prettyStatus(status) {
  const value = String(status || "pending");
  const map = {
    pending: "Pending",
    processing: "Diproses",
    done: "Selesai",
    paid_reported: "Menunggu verifikasi",
    cancelled: "Dibatalkan",
  };
  return map[value] || prettyOrderStatus(value);
}

function getStatusMeta(status) {
  const value = String(status || "pending");
  const tone = getOrderStatusTone(value);
  if (value === "done") return { tone, icon: CheckCircle2 };
  if (value === "processing") return { tone, icon: RefreshCw };
  if (value === "cancelled") return { tone, icon: XCircle };
  if (value === "expired") return { tone, icon: Clock3 };
  if (value === "paid_reported") return { tone, icon: ShieldCheck };
  return { tone, icon: Clock3 };
}

function getTimeline(status) {
  const value = String(status || "pending");
  if (value === "cancelled" || value === "expired") {
    return [
      { key: "pending", label: "Order masuk", active: true, done: true },
      { key: value, label: value === "expired" ? "Kedaluwarsa" : "Dibatalkan", active: true, done: false },
    ];
  }
  const pastPending = value !== "pending";
  const isPaidReported = value === "paid_reported";
  const isProcessing = value === "processing";
  const isDone = value === "done";
  return [
    { key: "pending", label: "Order masuk", active: true, done: pastPending },
    {
      key: "paid_reported",
      label: "Menunggu verifikasi",
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

function extractCredentials(text) {
  if (!text) return null;
  const lines = text.split("\n");
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
    const comboMatch = text.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})[:|\s]+([^\s\n]+)/);
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

// Dipakai saat onChange - hanya uppercase + strip spasi, biarkan user hapus dengan bebas
function sanitizeOrderInput(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

// Kode pesanan baru selalu memakai 8 karakter acak. Jangan memotong input karena
// itu dapat mengubah kode panjang menjadi kode lain yang valid.
function normalizeOrderCode(value) {
  // Strip semua karakter non-alphanumeric
  const cleaned = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return "";
  // Cek apakah sudah ada prefix IMZ
  const withoutPrefix = cleaned.startsWith("IMZ") ? cleaned.slice(3) : cleaned;
  if (withoutPrefix.length === 8) return `IMZ-${withoutPrefix}`;
  // Kode belum lengkap atau di luar format, kembalikan mentah untuk ditampilkan error
  return cleaned;
}

function toFriendlyStatusError() {
  return "Status belum bisa diambil. Coba lagi nanti.";
}

async function fetchOrderByCode(orderCode) {
  const result = await supabase.rpc("get_order_public", { p_order_code: orderCode });
  if (result.error) throw result.error;
  return Array.isArray(result.data) ? result.data[0] : result.data;
}

function statusTone(status) {
  return getOrderStatusTone(status);
}

function formatDate(isoString) {
  if (!isoString) return "-";
  try {
    return new Date(isoString).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "-";
  }
}

function formatRelativeTime(date) {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "baru saja";
  if (seconds < 60) return `${seconds} dtk lalu`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} mnt lalu`;
  return `${Math.round(minutes / 60)} jam lalu`;
}

// Sub-components

function FlowStep({ step, index }) {
  const isExpired = step.key === "expired";
  const isCancelled = step.key === "cancelled" || isExpired;
  const stateText = step.done
    ? "Selesai"
    : step.active
      ? (isExpired ? "Habis" : isCancelled ? "Batal" : "Aktif")
      : "Menunggu";
  return (
    <div className={`st-flowStep${step.active ? " is-active" : ""}${step.done ? " is-done" : ""}${isCancelled ? " is-cancelled" : ""}`}>
      <div className="st-flowNumber" aria-hidden="true">
        {step.done ? (
          <Check size={14} strokeWidth={3} />
        ) : isCancelled ? (
          <X size={14} strokeWidth={3} />
        ) : (
          <span>{index}</span>
        )}
      </div>
      <div className="st-flowCopy">
        <strong>{step.label}</strong>
        <small>{stateText}</small>
      </div>
    </div>
  );
}

// Micro Celebration on Done
function DoneCelebration({ show, onDismiss }) {
  useEffect(() => {
    if (!show) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 3;
    fireConfetti(cx, cy);
    // Track semua timer agar bisa di-clear saat unmount
    const t1 = setTimeout(() => fireConfetti(cx - 80, cy + 20), 200);
    const t2 = setTimeout(() => fireConfetti(cx + 80, cy + 20), 400);
    const t3 = setTimeout(onDismiss, 3200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <div className="st-doneCelebration" role="status" aria-live="assertive">
      <div className="st-doneCelebration-inner">
        <span className="st-doneCelebration-icon" aria-hidden="true"><PartyPopper size={26} /></span>
        <div className="st-doneCelebration-text">
          <strong>Pesananmu sudah selesai!</strong>
          <span>Terima kasih sudah belanja di Imzaqi Store.</span>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, hint, tone = "", icon: Icon }) {
  return (
    <article className={`st-infoCard${tone ? ` is-${tone}` : ""}`}>
      <div className="st-infoCard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        <span>{label}</span>
        {Icon && <Icon size={14} style={{ opacity: 0.8, color: "var(--st-muted)" }} />}
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function PostTransactionReview({ order, waUrl, toast }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingReview, setExistingReview] = useState(() => {
    try {
      const saved = typeof window !== "undefined" && window.localStorage
        ? localStorage.getItem(`imzaqi_review_${order?.order_code}`)
        : null;
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const RATING_LABELS = {
    5: "Sangat Puas! ★★★★★",
    4: "Puas & Lancar",
    3: "Cukup Baik",
    2: "Kurang Puas",
    1: "Perlu Peningkatan",
  };

  const QUICK_CHIPS = [
    "Akun Kilat",
    "Garansi Aman",
    "Admin Responsif",
    "Harga Pas",
    "Rekomen",
  ];

  const handleAddChip = (chip) => {
    setReviewText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chip;
      if (trimmed.includes(chip)) return prev;
      return `${trimmed}, ${chip}`;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const effectiveText = reviewText.trim() || "Pelayanan memuaskan, pesanan cepat sampai dan akun berfungsi lancar!";
    const effectiveAuthor = authorName.trim() || "Pelanggan Terverifikasi";
    const reviewData = {
      orderCode: order.order_code,
      rating,
      reviewText: effectiveText,
      authorName: effectiveAuthor,
      submittedAt: new Date().toISOString(),
    };

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(`imzaqi_review_${order.order_code}`, JSON.stringify(reviewData));
      }
      trackFunnelEvent("order_reviewed", {
        orderCode: order.order_code,
        rating,
        text: effectiveText,
      });
      fireConfetti();

      // Safely attempt DB insertion into testimonials (structured first, legacy caption fallback)
      if (typeof supabase?.from === "function") {
        const firstItem = order?.items?.[0];
        const iconUrl = firstItem?.product_icon_url || "/icon.png";
        const basePayload = {
          image_url: iconUrl,
          caption: `[${rating}/5] "${effectiveText}", ${effectiveAuthor} (#${order.order_code})`,
          is_active: false,
          sort_order: 100,
        };
        const richPayload = {
          ...basePayload,
          product_name: String(firstItem?.product_name || "").trim() || null,
          customer_name: effectiveAuthor,
          rating,
          is_verified: true,
        };
        const res = await supabase.from("testimonials").insert([richPayload]);
        if (res?.error) {
          await supabase.from("testimonials").insert([basePayload]);
        }
      }

      setExistingReview(reviewData);
      toast?.success?.("Terima kasih atas ulasanmu!");
    } catch {
      setExistingReview(reviewData);
      toast?.success?.("Terima kasih atas ulasanmu!");
    } finally {
      setSubmitting(false);
    }
  };

  const activeStarCount = hoverRating || rating;

  const buildWaReviewUrl = (rev) => {
    if (!waUrl) return "";
    const msg = encodeURIComponent(
      `Halo Admin Imzaqi Store! Saya ingin memberikan ulasan untuk pesanan #${order.order_code}:\n\n` +
      `Rating: ${rev.rating}/5 (${RATING_LABELS[rev.rating] || "Puas"})\n` +
      `Ulasan: "${rev.reviewText}"\n` +
      `Oleh: ${rev.authorName}\n\n` +
      `Terima kasih banyak atas pelayanannya!`
    );
    const baseUrl = waUrl.split("?")[0];
    return `${baseUrl}?text=${msg}`;
  };

  if (existingReview) {
    const waShareUrl = buildWaReviewUrl(existingReview);
    return (
      <article className="st-card st-reviewCard st-reviewCard--completed">
        <div className="st-cardHead">
          <div>
            <div className="st-kicker" style={{ color: "var(--accent)" }}>Feedback Terkirim</div>
            <h2 className="st-cardTitle">Ulasan Pesanan Kamu</h2>
          </div>
          <div className="st-cardIcon" style={{ color: "#f5a623" }}>
            <Star size={18} fill="#f5a623" aria-hidden="true" />
          </div>
        </div>

        <div className="st-reviewSubmitted">
          <div className="st-reviewSubmittedStars" aria-label={`Rating ${existingReview.rating} dari 5 bintang`}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={20}
                fill={star <= existingReview.rating ? "#f5a623" : "transparent"}
                color={star <= existingReview.rating ? "#f5a623" : "var(--st-muted, #7c9eb0)"}
                aria-hidden="true"
              />
            ))}
            <span className="st-reviewRatingBadge">{existingReview.rating}.0 / 5.0</span>
          </div>

          <blockquote className="st-reviewSubmittedQuote">
            "{existingReview.reviewText}"
          </blockquote>

          <div className="st-reviewSubmittedAuthor">
            <span>{existingReview.authorName}</span>
            <span className="st-reviewVerifiedPill">Pembeli Terverifikasi</span>
          </div>

          {waShareUrl ? (
            <div className="st-reviewShareRow">
              <a
                className="btn btn-ghost btn-sm st-reviewWaBtn"
                href={waShareUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span>Bagikan Ulasan ke WhatsApp Admin</span>
                <ArrowUpRight size={14} />
              </a>
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="st-card st-reviewCard">
      <div className="st-cardHead">
        <div>
          <div className="st-kicker">Kepuasan Pelanggan</div>
          <h2 className="st-cardTitle">Beri Rating & Ulasan</h2>
        </div>
        <div className="st-cardIcon">
          <Star size={16} />
        </div>
      </div>

      <p className="st-reviewIntro">
        Pesanan selesai! Bagaimana pengalaman belanja kamu?
      </p>

      <form onSubmit={handleSubmit} className="st-reviewForm">
        <div className="st-reviewRatingGroup">
          <div className="st-reviewStarsPicker" role="radiogroup" aria-label="Rating bintang">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`st-reviewStarBtn${star <= activeStarCount ? " is-active" : ""}`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={`${star} bintang`}
              >
                <Star
                  size={24}
                  fill={star <= activeStarCount ? "#f5a623" : "transparent"}
                  color={star <= activeStarCount ? "#f5a623" : "var(--st-muted, #7c9eb0)"}
                />
              </button>
            ))}
          </div>
          <div className="st-reviewRatingFeedback">
            {RATING_LABELS[activeStarCount] || "Pilih rating bintang"}
          </div>
        </div>

        <div className="st-reviewChips">
          <span className="st-reviewChipsLabel">Saran cepat:</span>
          <div className="st-reviewChipsRow">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className="st-reviewChip"
                onClick={() => handleAddChip(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div className="st-reviewFields">
          <textarea
            className="input st-input st-reviewTextarea"
            rows={3}
            placeholder="Tulis ulasan pengalaman kamu (contoh: proses kilat, akun langsung aktif, recommended!)..."
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
          />
          <input
            type="text"
            className="input st-input st-reviewNameInput"
            placeholder="Nama kamu (opsional, contoh: Rizky)"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
          />
        </div>

        <div className="st-reviewSubmitRow">
          <button
            type="submit"
            className="btn btn-wide st-reviewSubmitBtn"
            disabled={submitting}
          >
            <Send size={15} />
            <span>{submitting ? "Mengirim..." : "Kirim Ulasan & Rating"}</span>
          </button>
        </div>
      </form>
    </article>
  );
}

// Tab: Cek Status

function TabCekStatus({ settings }) {
  const navigate = useNavigate();
  const cart = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialParam = searchParams.get("order") || searchParams.get("id") || searchParams.get("order_id") || "";
  const toast = useToast();

  const [input, setInput] = useState(initialParam);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [order, setOrder] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const prevStatusRef = useRef(null);
  const lastLookedUpCodeRef = useRef("");

  const isAcademicOrder = useMemo(() => {
    if (!order?.items || !Array.isArray(order.items)) return false;
    return order.items.some((item) => {
      const name = String(item.product_name || item.name || "").toLowerCase();
      return /turnitin|parafrase|paraphrase|plagiasi|zerogpt|mendeley|skripsi|tesis|jurnal|akademik/.test(name);
    });
  }, [order]);

  const waNumberRaw = isAcademicOrder
    ? STORE_WHATSAPP.academic
    : (settings?.whatsapp?.number || (typeof settings?.whatsapp === "string" ? settings.whatsapp : STORE_WHATSAPP.app_premium));
  const waNumber = toWhatsAppDigits(waNumberRaw) || STORE_WHATSAPP.app_premium;
  const pollTimerRef = useRef(null);

  const lookup = useCallback(async (rawValue) => {
    const code = normalizeOrderCode(rawValue);
    setInput(code);

    if (!code) {
      const text = "Masukkan ID order dulu.";
      setMessage(text);
      setOrder(null);
      toast.error(text);
      return;
    }
    lastLookedUpCodeRef.current = code;
    setLoading(true);
    setMessage("");
    setOrder(null);

    try {
      const row = await fetchOrderByCode(code);
      if (!row) {
        const text = "Order tidak ditemukan.";
        setMessage(text);
        toast.error(text);
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("order");
            return next;
          },
          { replace: true }
        );
        return;
      }

      setOrder(row);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("order", code);
          next.delete("tab");
          return next;
        },
        { replace: true }
      );
      toast.success("Order ditemukan", { title: row.order_code || code, duration: 2200 });
    } catch (error) {
      const text = toFriendlyStatusError();
      warn("Gagal mengambil status order:", error);
      setMessage(text);
      toast.error(text);
    } finally {
      setLoading(false);
    }
  }, [setSearchParams, toast]);

  // Silent refresh - update status di background tanpa reset UI
  const silentRefresh = useCallback(async (orderCode) => {
    if (!orderCode) return;
    setRefreshing(true);
    try {
      const row = await fetchOrderByCode(orderCode);
      if (!row) return;
      setOrder(row);
      setLastUpdated(new Date());
    } catch {
      // silent - tidak tampil error untuk background refresh
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!initialParam) return;
    const normalized = normalizeOrderCode(initialParam);
    setInput(normalized);
    if (lastLookedUpCodeRef.current !== normalized) {
      lookup(normalized);
    }
  }, [initialParam, lookup]);

  // Trigger celebration and record loyalty reward when status becomes "done"
  useEffect(() => {
    if (!order) return;
    const prev = prevStatusRef.current;
    const curr = order.status;
    if (curr === "done") {
      recordCompletedOrder(order.order_code);
      try {
        const eventKey = `imzaqi_completed_event:${order.order_code}`;
        if (!localStorage.getItem(eventKey)) {
          trackFunnelEvent("order_completed", { orderCode: order.order_code, metadata: { total: order.total_idr } });
          localStorage.setItem(eventKey, "1");
        }
      } catch {}
      if (prev && prev !== "done") {
        setShowCelebration(true);
      }
    }
    prevStatusRef.current = curr;
  }, [order]);

  const isLiveStatus = order ? !TERMINAL_STATUSES.has(order.status) : false;

  useEffect(() => {
    if (!order?.order_code || TERMINAL_STATUSES.has(order.status)) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return undefined;
    }

    const orderCode = order.order_code;
    const startPolling = () => {
      if (pollTimerRef.current) return;
      pollTimerRef.current = setInterval(() => {
        // Hemat kuota: jangan polling saat tab tidak terlihat
        if (document.visibilityState === "visible") silentRefresh(orderCode);
      }, POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Langsung segarkan saat user kembali ke tab
        silentRefresh(orderCode);
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopPolling();
    };
  }, [order?.order_code, order?.status, silentRefresh]);

  const [products, setProducts] = useState([]);

  useEffect(() => {
    let active = true;
    fetchProducts({ useCache: true })
      .then((list) => {
        if (active && Array.isArray(list)) setProducts(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const productLookup = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      if (p.id) map.set(p.id, p);
      if (p.name) map.set(String(p.name).toLowerCase().trim(), p);
    });
    return map;
  }, [products]);

  const recentOrders = useMemo(() => {
    const all = getOrderHistory();
    return all.slice(0, 4);
  }, []);

  const otherRecentOrders = useMemo(() => {
    return recentOrders.filter((r) => !order || r.order_code !== order.order_code);
  }, [recentOrders, order]);

  const statusMeta = useMemo(() => getStatusMeta(order?.status), [order?.status]);
  const StatusIcon = statusMeta.icon;
  const timeline = useMemo(() => getTimeline(order?.status), [order?.status]);

  const subtotalValue = Number(order?.subtotal_idr || 0);
  const totalValue = Number(order?.total_idr || 0);
  const discountValue = useMemo(() => Math.max(0, subtotalValue - totalValue), [subtotalValue, totalValue]);
  const itemCount = useMemo(
    () => (order?.items || []).reduce((sum, item) => sum + Number(item?.qty || 0), 0),
    [order?.items]
  );


  const createdDateLabel = useMemo(() => formatDate(order?.created_at), [order?.created_at]);

  const waUrl = useMemo(() => {
    const code = order?.order_code || input || "";
    const itemLines = (order?.items || [])
      .map((item) => `• ${item.product_name || "-"} / ${item.variant_name || "-"} x${item.qty || 1}`)
      .join("\n");
    const lines = [
      "Halo admin, saya ingin cek order.",
      "",
      `ID Order: ${code}`,
      order?.status ? `Status: ${prettyStatus(order.status)}` : null,
      order?.total_idr ? `Total: ${formatIDR(order.total_idr)}` : null,
      itemLines ? `\nItem:\n${itemLines}` : null,
    ].filter(Boolean);
    const text = encodeURIComponent(lines.join("\n"));
    return `https://wa.me/${waNumber}?text=${text}`;
  }, [input, order?.order_code, order?.items, order?.status, order?.total_idr, waNumber]);

  const proofWaUrl = useMemo(() => {
    const code = order?.order_code || input.trim();
    if (!code) return "";
    const itemLines = (order?.items || [])
      .map((item) => `• ${item.product_name || "-"} / ${item.variant_name || "-"} x${item.qty || 1}`)
      .join("\n");
    const lines = [
      "Halo Admin Imzaqi Store, saya ingin mengirimkan bukti pembayaran:",
      "",
      `• ID Order: ${code}`,
      order?.total_idr ? `• Total Tagihan: ${formatIDR(order.total_idr)}` : null,
      itemLines ? `• Paket:\n${itemLines}` : null,
      "",
      "Berikut saya lampirkan foto bukti transfernya ya kak. Mohon segera dicek dan diproses. Terima kasih!",
    ].filter(Boolean);
    const text = encodeURIComponent(lines.join("\n"));
    return `https://wa.me/${waNumber}?text=${text}`;
  }, [input, order?.items, order?.order_code, order?.total_idr, waNumber]);

  const claimWarrantyUrl = useMemo(() => {
    const code = order?.order_code || "";
    const itemLines = (order?.items || [])
      .map((item) => `• ${item.product_name || "-"} / ${item.variant_name || "-"}`)
      .join("\n");
    const lines = [
      "Halo Admin Imzaqi Store, saya ingin klaim garansi / kendala akun:",
      "",
      `• ID Order: ${code}`,
      itemLines ? `• Paket:\n${itemLines}` : null,
      "• Kendala Akun: [Tuliskan kendala di sini, misal: login kena limit / password berubah]",
      "",
      "Mohon dibantu ya admin. Terima kasih!",
    ].filter(Boolean);
    const text = encodeURIComponent(lines.join("\n"));
    return `https://wa.me/${waNumber}?text=${text}`;
  }, [order?.order_code, order?.items, waNumber]);

  async function copyOrderCode() {
    try {
      await copyToClipboard(order?.order_code || "");
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      toast.success("ID disalin");
    } catch {
      toast.error("Gagal menyalin ID.");
    }
  }

  async function pasteOrderCode() {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error();
      }
      const text = await navigator.clipboard.readText();
      const normalized = normalizeOrderCode(text);
      setInput(normalized);
      toast.success("ID ditempel");
    } catch {
      toast.error("Paste manual ya.");
    }
  }

  const isTerminal = order ? TERMINAL_STATUSES.has(order.status) : false;
  const lastUpdatedLabel = lastUpdated ? formatRelativeTime(lastUpdated) : null;

  useEffect(() => {
    if (order?.status !== "pending" || !order?.reservation_expires_at) return undefined;
    setNowTick(Date.now());
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [order?.status, order?.reservation_expires_at]);

  const reservationCountdown = useMemo(() => {
    if (order?.status !== "pending" || !order?.reservation_expires_at) return null;
    const expiresMs = new Date(order.reservation_expires_at).getTime();
    if (Number.isNaN(expiresMs)) return null;
    const remainingSec = Math.max(0, Math.floor((expiresMs - nowTick) / 1000));
    if (remainingSec <= 0) return "Batas pembayaran berakhir";
    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    return `Batas bayar ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [order?.status, order?.reservation_expires_at, nowTick]);

  async function handleProofUpload(event) {
    const file = event?.target?.files?.[0];
    if (!file || !order?.order_code) return;
    if (!String(file.type || "").startsWith("image/")) {
      toast.error("Pilih file gambar screenshot pembayaran (JPG/PNG/WebP).");
      event.target.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Ukuran file terlalu besar (maks 8 MB).");
      event.target.value = "";
      return;
    }
    if (typeof supabase?.storage?.from !== "function") {
      toast.info("Gunakan tombol Kirim Bukti Bayar via WA di bawah.");
      event.target.value = "";
      return;
    }

    setUploadingProof(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.78 });
      const ext = compressed.type === "image/png" ? "png" : compressed.type === "image/webp" ? "webp" : "jpg";
      const filePath = `orders/${order.order_code}/${Date.now()}.${ext}`;
      const uploadRes = await supabase.storage
        .from("payment-proofs")
        .upload(filePath, compressed, { upsert: true, contentType: compressed.type || "image/jpeg" });
      if (uploadRes.error) throw uploadRes.error;

      const { data: pub } = supabase.storage.from("payment-proofs").getPublicUrl(filePath);
      const proofUrl = pub?.publicUrl || "";
      if (!proofUrl) throw new Error("URL bukti gagal dibuat.");

      const rpcRes = await supabase.rpc("report_order_payment", {
        p_order_code: order.order_code,
        p_payment_proof_url: proofUrl,
      });
      if (rpcRes.error) throw rpcRes.error;
      const updated = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data;
      const nextStatus = updated?.status || (order.status === "pending" ? "paid_reported" : order.status);
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
              payment_proof_url: updated?.payment_proof_url || proofUrl,
              payment_reported_at: updated?.payment_reported_at || new Date().toISOString(),
            }
          : prev
      );
      updateOrderHistoryStatus?.(order.order_code, nextStatus);
      toast.success("Bukti pembayaran terunggah! Pesanan diteruskan ke admin.");
    } catch (err) {
      warn("Gagal upload bukti pembayaran:", err);
      toast.error("Upload otomatis belum aktif. Kirim bukti lewat tombol WA di bawah ya.");
    } finally {
      setUploadingProof(false);
      if (event?.target) event.target.value = "";
    }
  }

  function handleReorder() {
    if (!order?.items?.length || typeof cart?.add !== "function") return;
    let addedCount = 0;
    for (const item of order.items) {
      const product =
        (item?.product_id ? productLookup.get(item.product_id) : null) ||
        (item?.product_name ? productLookup.get(String(item.product_name).toLowerCase().trim()) : null);
      const activeVariants = Array.isArray(product?.variants) ? product.variants : [];
      const matchedVariant =
        activeVariants.find((v) => item?.variant_id && v.id === item.variant_id) ||
        activeVariants.find(
          (v) =>
            String(v.name || "").trim().toLowerCase() === String(item?.variant_name || "").trim().toLowerCase()
        );
      const variantPayload = {
        variant_id: matchedVariant?.id || item?.variant_id || `${item?.product_name || "item"}-${addedCount}`,
        product_id: matchedVariant?.product_id || product?.id || item?.product_id || null,
        product_name: product?.name || item?.product_name || "Produk",
        variant_name: matchedVariant?.name || item?.variant_name || "",
        duration_label: matchedVariant?.duration_label || item?.duration_label || "",
        price_idr: Number(matchedVariant?.price_idr ?? item?.price_idr ?? 0),
        product_icon_url: product?.icon_url || item?.product_icon_url || "",
        description: matchedVariant?.description || item?.description || product?.description || "",
        guarantee_text: matchedVariant?.guarantee_text || item?.guarantee_text || "",
        category: product?.category || item?.category || "other",
        requires_buyer_email:
          typeof matchedVariant?.requires_buyer_email === "boolean"
            ? matchedVariant.requires_buyer_email
            : !!item?.requires_buyer_email,
        stock: matchedVariant?.stock ?? null,
      };
      const qty = Math.max(1, Number(item?.qty || 1));
      const res = cart.add(variantPayload, qty);
      if (res?.success !== false) addedCount += 1;
    }
    if (addedCount > 0) {
      toast.success("Paket ditambahkan ke keranjang");
      navigate("/checkout");
    } else {
      toast.error("Stok paket sedang kosong, cek produk lain ya.");
    }
  }

  return (
    <>
      <DoneCelebration
        show={showCelebration}
        onDismiss={() => setShowCelebration(false)}
      />

      {!order ? (
        <>
          <section className="st-search">
            <div className="st-searchHead">
              <div>
                <div className="st-kicker">ID order</div>
                <h2 className="st-searchTitle">Masukkan ID pesanan</h2>
              </div>
            </div>

            <div className="st-searchRow">
              <div className="st-inputWrap">
                <Search size={16} />
                <button className="btn btn-ghost st-pasteBtn st-pasteBtn--inline" type="button" onClick={pasteOrderCode}>
                  Tempel
                </button>
                <input
                  className="input st-input"
                  inputMode="search"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                   placeholder="IMZ-ABCD1234"
                   aria-label="ID pesanan"
                   aria-describedby="status-search-hint"
                   aria-invalid={Boolean(message) || undefined}
                  value={input}
                  onChange={(e) => setInput(sanitizeOrderInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") lookup(input);
                  }}
                />
              </div>

              <button className="btn st-checkBtn" type="button" onClick={() => lookup(input)} disabled={loading}>
                {loading ? (
                  <>
                    <span className="st-checkSpinner" aria-hidden="true" />
                    Mencari...
                  </>
                ) : "Cek status"}
              </button>
            </div>

            <div id="status-search-hint" className={`st-searchHint${message ? " is-error" : ""}`} role="status">
              {message || "Contoh: IMZ-ABCD1234 dari bukti konfirmasi pembayaran."}
            </div>
          </section>

          {recentOrders.length > 0 ? (
            <section className="st-recent">
              <div className="st-recentHead">
                <History size={14} />
                <span>Order terakhir</span>
              </div>
              <div className="st-recentList">
                {recentOrders.map((r) => (
                  <button
                    key={r.order_code}
                    className="st-recentChip"
                    type="button"
                    onClick={() => {
                      const code = r.order_code;
                      setInput(code);
                      lookup(code);
                    }}
                  >
                    <span className="st-recentCode">{r.order_code}</span>
                    {r.total_idr ? <span className="st-recentPrice">{formatIDR(r.total_idr)}</span> : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="st-searchSupport">
            <p>Kesulitan menemukan ID pesanan?</p>
              <a className="btn btn-ghost" href={waUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <MessageCircle size={15} strokeWidth={2.2} style={{ flexShrink: 0 }} aria-hidden="true" />
                <span>Hubungi admin</span>
              </a>
          </section>
        </>
      ) : (
        <div className="st-layout">
          {order.admin_note ? (() => {
            const creds = extractCredentials(order.admin_note);
            return (
              <article className="st-card st-noteCard st-noteTopAccent is-accent">
                <div className="st-cardHead">
                  <div>
                    <div className="st-kicker">Admin</div>
                    <h2 className="st-cardTitle">Catatan & Akun</h2>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                    {creds?.email ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm st-copyNoteBtn"
                        onClick={async () => {
                          try {
                            await copyToClipboard(creds.email);
                            toast.success("Email disalin");
                          } catch {
                            toast.error("Gagal menyalin email");
                          }
                        }}
                        title="Salin email akun"
                      >
                        <Copy size={12} />
                        <span>Email</span>
                      </button>
                    ) : null}
                    {creds?.password ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm st-copyNoteBtn"
                        onClick={async () => {
                          try {
                            await copyToClipboard(creds.password);
                            toast.success("Password disalin");
                          } catch {
                            toast.error("Gagal menyalin password");
                          }
                        }}
                        title="Salin password akun"
                      >
                        <Copy size={12} />
                        <span>Password</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm st-copyNoteBtn"
                      onClick={async () => {
                        try {
                          await copyToClipboard(order.admin_note);
                          toast.success("Catatan disalin");
                        } catch {
                          toast.error("Gagal menyalin catatan");
                        }
                      }}
                      title="Salin semua catatan admin"
                    >
                      <Copy size={12} />
                      <span>Salin Semua</span>
                    </button>
                  </div>
                </div>
                <div className="st-noteBody">{order.admin_note}</div>
              </article>
            );
          })() : null}

          <div className="st-main">
            {/* Header Ringkasan Pesanan Terpadu */}
            <article className="st-card st-orderHeader">
              <div className="st-orderHeader-top">
                <div className="st-orderCodeWrap">
                  <span className="st-kicker">ID Pesanan</span>
                  <div className="st-orderCodeBadge">
                    <strong className="st-orderCodeText">{order.order_code}</strong>
                    <button
                      type="button"
                      className={`st-copyCodeBtn ${copiedCode ? "is-copied" : ""}`}
                      onClick={copyOrderCode}
                      title="Salin ID Pesanan"
                      aria-label="Salin ID Pesanan"
                    >
                      {copiedCode ? <Check size={13} className="st-copySuccessIcon" /> : <Copy size={13} />}
                      <span>{copiedCode ? "Tersalin!" : "Salin"}</span>
                    </button>
                  </div>
                </div>

                <div className="st-orderStatusWrap">
                  <div className={`st-statePill is-${statusMeta.tone}`}>
                    <StatusIcon size={15} />
                    <span>{prettyStatus(order.status)}</span>
                  </div>
          <div className="st-lastUpdated" aria-live="polite">
            {lastUpdatedLabel ? <span>Diperbarui {lastUpdatedLabel}</span> : null}
                    {!isTerminal ? (
                      <button
                        type="button"
                        className="st-refreshBtn"
                        onClick={() => silentRefresh(order.order_code)}
                        disabled={refreshing}
                        aria-label="Perbarui status"
                        title="Perbarui status"
                      >
                        <RefreshCw size={13} className={refreshing ? "st-spin" : ""} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="st-orderSummaryRow">
                <div className="st-orderSummaryItem st-infoCard">
                  <div className="st-summaryLabel">
                    <Calendar size={13} />
                    <span>Waktu Order</span>
                  </div>
                  <strong>{createdDateLabel}</strong>
                </div>

                <div className="st-orderSummaryItem st-infoCard">
                  <div className="st-summaryLabel">
                    <WalletCards size={13} />
                    <span>Metode Bayar</span>
                  </div>
                  <strong>QRIS</strong>
                </div>

                <div className="st-orderSummaryItem st-infoCard is-total">
                  <div className="st-summaryLabel">
                    <ShieldCheck size={13} />
                    <span>Total Tagihan</span>
                  </div>
                  <strong>{formatIDR(totalValue)}</strong>
                </div>
              </div>

              {isLiveStatus ? (
                <div className="st-liveHint" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Clock3 size={13} style={{ opacity: 0.7 }} />
                      <span>Status diperbarui otomatis setiap 30 detik</span>
                    </span>
                    {reservationCountdown ? (
                      <span className="st-expiryChip" role="status">
                        <Clock3 size={12} aria-hidden="true" />
                        <span>{reservationCountdown}</span>
                      </span>
                    ) : null}
                  </div>
                  {proofWaUrl ? (
                    <a
                      className="btn btn-sm btn-primary st-sendProofBtn"
                      href={proofWaUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <MessageCircle size={14} strokeWidth={2.4} aria-hidden="true" />
                      <span>Kirim Bukti Bayar via WA</span>
                      <ArrowUpRight size={13} />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </article>

            {/* Stepper Progress */}
            <article className="st-card st-flow">
              <div className="st-cardHead">
                <div>
                  <div className="st-kicker">Progres Pesanan</div>
                  <h2 className="st-cardTitle">Tahap Pemrosesan</h2>
                </div>
                <div className="st-cardIcon">
                  <Activity size={16} />
                </div>
              </div>

              <div className="st-flowRail">
                {timeline.map((step, index) => (
                  <React.Fragment key={step.key}>
                    <FlowStep step={step} index={index + 1} />
                    {index < timeline.length - 1 ? <div className={`st-flowLine${step.done ? " is-done" : ""}`} /> : null}
                  </React.Fragment>
                ))}
              </div>
            </article>

            {/* Rincian Produk */}
            <article className="st-card st-items">
              <div className="st-cardHead">
                <div>
                  <div className="st-kicker">Rincian Paket ({itemCount} item)</div>
                  <h2 className="st-cardTitle">Produk yang Dibeli</h2>
                </div>
                <div className="st-cardIcon">
                  <Package size={16} />
                </div>
              </div>

              <div className="st-itemList">
                {(order.items || []).map((item, index) => {
                  const iconUrl = String(item?.product_icon_url || "").trim();
                  const guarantee = String(item?.guarantee_text || "").trim();
                  const variantName = String(item?.variant_name || "").trim();
                  const durationLabel = String(item?.duration_label || "").trim();
                  const matchedProduct =
                    (item?.product_id ? productLookup.get(item.product_id) : null) ||
                    (item?.product_name ? productLookup.get(String(item.product_name).toLowerCase().trim()) : null);
                  const description = String(item?.description || matchedProduct?.description || "").trim();
                  const requiresEmail = !!item?.requires_buyer_email;
                  const itemTotal = Number(item.price_idr || 0) * Number(item.qty || 0);
                  const itemKey = item?.variant_id ? `${item.variant_id}-${index}` : `item-${index}`;

                  return (
                    <div key={itemKey} className="st-itemRow st-itemRowDetailed">
                      <div className="st-itemHead">
                        <div className="st-itemIcon" data-brand-icon={getProductIconTone(item) || undefined} aria-hidden="true">
                          {iconUrl ? (
                            <img src={iconUrl} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <span>{String(item.product_name || "P").slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="st-itemMain">
                          <div className="st-itemName">{item.product_name}</div>
                          {variantName ? <div className="st-itemVariant">{variantName}</div> : null}
                        </div>
                        <div className="st-itemPrice">
                          <span className="st-itemPriceQty">×{item.qty}</span>
                          <b>{formatIDR(itemTotal)}</b>
                          <small>{formatIDR(Number(item.price_idr || 0))} / pcs</small>
                        </div>
                      </div>

                      <div className="st-itemFacts">
                        {durationLabel ? (
                          <span className="st-itemFact">
                            <Clock3 size={12} />
                            <span>{durationLabel}</span>
                          </span>
                        ) : null}
                        {guarantee ? (
                          <span className="st-itemFact st-itemFact--guarantee">
                            <ShieldCheck size={12} />
                            <span>{guarantee}</span>
                          </span>
                        ) : null}
                        {requiresEmail ? (
                          <span className="st-itemFact st-itemFact--email">
                            <Mail size={12} />
                            <span>Butuh email aktivasi</span>
                          </span>
                        ) : null}
                      </div>

                      {description ? (
                        <div className="st-itemDesc">
                          <div className="st-itemDescHeader">
                            <Info size={13} />
                            <span className="st-itemDescKicker">Deskripsi Produk</span>
                          </div>
                          <p className="st-itemDescText">{description}</p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </article>

            {order && order.status === "done" ? (
              <PostTransactionReview order={order} waUrl={waUrl} toast={toast} />
            ) : null}
          </div>

          <aside className="st-aside">
            <article className="st-card st-payCard">
              <div className="st-cardHead">
                <div>
                  <div className="st-kicker">Ringkasan</div>
                  <h2 className="st-cardTitle">Pembayaran</h2>
                </div>
                <div className="st-cardIcon">
                  <WalletCards size={16} />
                </div>
              </div>

              <div className="st-payRows">
                <div className="st-payRow">
                  <span>Subtotal</span>
                  <b>{formatIDR(subtotalValue)}</b>
                </div>
                {discountValue > 0 ? (
                  <div className="st-payRow is-discount">
                    <span>Potongan Promo</span>
                    <b className="st-discountVal">-{formatIDR(discountValue)}</b>
                  </div>
                ) : null}
                <div className="st-payRow is-total">
                  <span>Total Tagihan</span>
                  <b>{formatIDR(totalValue)}</b>
                </div>
              </div>
            </article>

            {order.notes && order.notes.trim() ? (
              <article className="st-card st-noteCard">
                <div className="st-cardHead">
                  <div>
                    <div className="st-kicker">Catatan Pembeli</div>
                    <h2 className="st-cardTitle">Pesan</h2>
                  </div>
                  <div className="st-cardIcon">
                    <MessageSquareText size={16} />
                  </div>
                </div>
                <div className="st-noteBody">{order.notes}</div>
              </article>
            ) : null}

            {order.promo_code ? (
              <article className="st-card st-promoCard">
                <div className="st-cardHead">
                  <div>
                    <div className="st-kicker">Promo</div>
                    <h2 className="st-cardTitle">Kode Promo</h2>
                  </div>
                  <div className="st-cardIcon">
                    <BadgePercent size={16} />
                  </div>
                </div>
                <div className="st-promoRow">
                  <b>{order.promo_code}</b>
                  <span>{order.discount_percent || 0}%</span>
                </div>
              </article>
            ) : null}

            <article className="st-card st-helpCard">
              <div className="st-cardHead">
                <div>
                  <div className="st-kicker">Bantuan</div>
                  <h2 className="st-cardTitle">Admin Store</h2>
                </div>
                <div className="st-cardIcon">
                  <MessageCircle size={16} aria-hidden="true" />
                </div>
              </div>

              <p className="st-helpText">Ada kendala atau butuh aktivasi lebih cepat? Hubungi admin resmi via WhatsApp.</p>

              {order && (order.status === "pending" || order.status === "paid_reported") ? (
                <div className="st-proofUploadBox" style={{ marginBottom: 12 }}>
                  <div className="st-proofUploadRow">
                    <div>
                      <strong style={{ fontSize: "13px", display: "block" }}>
                        {order.payment_proof_url ? "Bukti bayar terunggah" : "Upload bukti transfer"}
                      </strong>
                      <small className="muted" style={{ fontSize: "12px" }}>
                        {order.payment_proof_url
                          ? "Bisa unggah ulang jika ingin mengganti screenshot."
                          : "Screenshot QRIS dikompresi otomatis sebelum dikirim."}
                      </small>
                    </div>
                    {order.payment_proof_url ? (
                      <a href={order.payment_proof_url} target="_blank" rel="noreferrer" aria-label="Lihat bukti bayar">
                        <img
                          className="st-proofPreviewThumb"
                          src={order.payment_proof_url}
                          alt="Bukti pembayaran pesanan"
                        />
                      </a>
                    ) : null}
                  </div>
                  <label className="btn btn-ghost btn-sm btn-wide" style={{ cursor: uploadingProof ? "wait" : "pointer" }}>
                    <Upload size={14} aria-hidden="true" />
                    <span>{uploadingProof ? "Mengunggah..." : order.payment_proof_url ? "Ganti Bukti Transfer" : "Pilih Screenshot Bukti"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingProof}
                      onChange={handleProofUpload}
                      style={{ position: "absolute", opacity: 0, width: 1, height: 1, overflow: "hidden" }}
                    />
                  </label>
                </div>
              ) : null}

              <div className="st-helpActions">
                {order && (order.status === "pending" || order.status === "paid_reported") && proofWaUrl ? (
                  <a
                    className="btn btn-wide btn-primary st-sendProofBtn"
                    href={proofWaUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}
                  >
                    <MessageCircle size={16} strokeWidth={2.2} style={{ flexShrink: 0 }} aria-hidden="true" />
                    <span>Kirim Bukti Bayar via WA</span>
                    <ArrowUpRight size={15} style={{ flexShrink: 0, marginLeft: 2 }} />
                  </a>
                ) : null}
                <a className="btn btn-wide" href={waUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <MessageCircle size={16} strokeWidth={2.2} style={{ flexShrink: 0 }} aria-hidden="true" />
                  <span>Hubungi Admin WA</span>
                  <ArrowUpRight size={15} style={{ flexShrink: 0, marginLeft: 2 }} />
                </a>
                {order?.items?.length > 0 ? (
                  <button
                    className="btn btn-ghost btn-wide"
                    type="button"
                    onClick={handleReorder}
                    style={{ marginTop: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                    <span>Pesan Lagi</span>
                  </button>
                ) : null}
                {order && order.status === "done" ? (
                  <a
                    className="btn btn-ghost btn-wide st-warrantyBtn"
                    href={claimWarrantyUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ marginTop: 8, borderColor: "rgba(0, 214, 180, 0.35)", color: "var(--brand-icon, #00d6b4)" }}
                  >
                    <ShieldCheck size={15} />
                    <span>Klaim Garansi / Kendala Akun</span>
                  </a>
                ) : null}
              </div>
            </article>
          </aside>

          {/* Pencarian Order Lain di Bagian Paling Bawah */}
          <section className="st-search st-search--bottom">
            <div className="st-searchHead">
              <div>
                <div className="st-kicker">Pencarian</div>
                <h2 className="st-searchTitle">Cari Order Lain</h2>
              </div>
            </div>

            <div className="st-searchRow">
              <div className="st-inputWrap">
                <Search size={16} />
                <button className="btn btn-ghost st-pasteBtn st-pasteBtn--inline" type="button" onClick={pasteOrderCode}>
                  Tempel
                </button>
                <input
                  className="input st-input"
                  inputMode="search"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="IMZ-ABCD1234"
                  aria-label="ID pesanan"
                  value={input}
                  onChange={(e) => setInput(sanitizeOrderInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") lookup(input);
                  }}
                />
              </div>

              <button className="btn st-checkBtn" type="button" onClick={() => lookup(input)} disabled={loading}>
                {loading ? (
                  <>
                    <span className="st-checkSpinner" aria-hidden="true" />
                    Mencari...
                  </>
                ) : "Cek status"}
              </button>
            </div>

            {otherRecentOrders.length > 0 ? (
              <div className="st-recentOther">
                <div className="st-recentHead">
                  <History size={13} />
                  <span>Pesanan lain yang tersimpan di perangkat ini:</span>
                </div>
                <div className="st-recentList">
                  {otherRecentOrders.map((r) => (
                    <button
                      key={r.order_code}
                      className="st-recentChip"
                      type="button"
                      onClick={() => {
                        const code = r.order_code;
                        setInput(code);
                        lookup(code);
                      }}
                    >
                      <span className="st-recentCode">{r.order_code}</span>
                      {r.total_idr ? <span className="st-recentPrice">{formatIDR(r.total_idr)}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}

// Tab: Riwayat

function calcStreak(entries) {
  if (!entries || entries.length === 0) return 0;
  const months = [...new Set(
    entries
      .filter((e) => e.status === "done")
      .map((e) => {
        const d = new Date(e.created_at || 0);
        return d.getFullYear() * 12 + d.getMonth();
      })
  )].sort((a, b) => b - a);
  if (months.length === 0) return 0;
  const now = new Date();
  const currentMonthIdx = now.getFullYear() * 12 + now.getMonth();
  if (currentMonthIdx - months[0] > 1) return 0;
  let streak = 1;
  for (let i = 0; i < months.length - 1; i++) {
    if (months[i] - months[i + 1] === 1) streak++;
    else break;
  }
  return streak;
}

function StreakBadge({ streak }) {
  if (streak < 2) return null;
  const StreakIcon = streak >= 6 ? Flame : streak >= 3 ? Zap : ThumbsUp;
  const label = streak >= 6
    ? `${streak} bulan berturut-turut! Pelanggan setia!`
    : streak >= 3
    ? `${streak} bulan berturut-turut! Keep it up!`
    : `${streak} bulan berturut-turut!`;
  return (
    <div className="st-streakBadge">
      <span className="st-streakEmoji" aria-hidden="true"><StreakIcon size={24} /></span>
      <div className="st-streakText">
        <strong>Streak {streak} Bulan</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function TabRiwayat() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [fetchErrors, setFetchErrors] = useState({});
  const [confirmClear, setConfirmClear] = useState(false);
  const toast = useToast();

  const doSync = useCallback(async (silent = false) => {
    const history = getOrderHistory();
    setEntries(history);
    if (history.length === 0) {
      setLoading(false);
      setSyncing(false);
      return;
    }
    if (!silent) setSyncing(true);

    const errors = {};
    try {
      const results = await Promise.all(history.map(async (entry) => {
        try {
          const row = await fetchOrderByCode(entry.order_code);
          return { entry, row };
        } catch {
          return { entry, row: null };
        }
      }));

      results.forEach(({ entry, row }) => {
        if (row?.status) {
          const updates = { status: row.status };
          if (!entry.items_summary && Array.isArray(row.items) && row.items.length > 0) {
            const first = row.items[0];
            const extra = row.items.length - 1;
            updates.items_summary = `${first.product_name || first.name || "Produk"} · ${first.variant_name || first.duration_label || ""}${extra > 0 ? ` (+${extra} lainnya)` : ""}`;
            updates.icon_url = first.product_icon_url || first.icon_url || "";
          }
          updateOrderHistoryEntry(entry.order_code, updates);
        } else {
          errors[entry.order_code] = true;
        }
      });
    } catch (err) {
      console.error("Gagal sinkronisasi riwayat:", err);
      history.forEach((entry) => {
        errors[entry.order_code] = true;
      });
    }

    setFetchErrors(errors);
    setEntries(getOrderHistory());
    setLoading(false);
    setSyncing(false);
  }, []);

  useEffect(() => {
    let active = true;
    doSync(true).then(() => { if (!active) return; });
    return () => { active = false; };
  }, [doSync]);

  function handleRemove(order_code) {
    removeOrderFromHistory(order_code);
    setEntries(getOrderHistory());
    toast.success("Entri dihapus");
  }

  function handleClearAll() {
    clearOrderHistory();
    setEntries([]);
    setConfirmClear(false);
    toast.success("Riwayat dibersihkan");
  }

  if (loading) {
    return (
      <div className="oh-loading" role="status" aria-label="Memuat riwayat order">
        <div className="oh-loadingDot" />
        <div className="oh-loadingDot" />
        <div className="oh-loadingDot" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="oh-empty">
        <div className="oh-emptyIcon">
          <Package size={32} />
        </div>
        <h2 className="oh-emptyTitle">Belum ada riwayat</h2>
        <p className="oh-emptyText">
          Order dari browser ini muncul di sini.
        </p>
        <Link className="btn" to="/produk">
          Lihat katalog
        </Link>
      </div>
    );
  }

  const streak = calcStreak(entries);

  return (
    <div className="oh-list">
      <StreakBadge streak={streak} />
      {/* Toolbar: refresh + clear all */}
      <div className="oh-listToolbar">
        <button
          type="button"
          className="btn btn-sm btn-ghost oh-refreshAllBtn"
          onClick={() => doSync()}
          disabled={syncing}
          aria-label="Perbarui semua status"
        >
          <RefreshCw size={13} className={syncing ? "oh-spinIcon" : ""} />
          {syncing ? "Ngupdate..." : "Perbarui"}
        </button>

        {confirmClear ? (
          <div className="oh-confirmClear">
              <span>Hapus semua?</span>
              <button type="button" className="btn btn-sm" onClick={handleClearAll}>Yoi, hapus</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmClear(false)}>Batal</button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-ghost oh-clearAllBtn"
            onClick={() => setConfirmClear(true)}
            aria-label="Hapus semua riwayat"
          >
            <Trash2 size={13} />
            Hapus semua
          </button>
        )}
      </div>

      {entries.map((entry) => {
        const hasFetchError = fetchErrors[entry.order_code];
        const tone = statusTone(entry.status);

        return (
          <article key={entry.order_code} className="oh-card">
            <div className="oh-cardTop">
              <div className="oh-cardLeft">
                <div className="oh-orderHeader">
                  {entry.icon_url ? (
                    <img
                      src={entry.icon_url}
                      alt=""
                      className="oh-productIcon"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  ) : null}
                  <div className="oh-orderHeaderCopy">
                    <div className="oh-orderCode">{entry.order_code}</div>
                    {entry.items_summary ? (
                      <div className="oh-itemSummary">{entry.items_summary}</div>
                    ) : null}
                  </div>
                </div>
                <div className="oh-orderMeta">
                  <span className="oh-orderDate">
                    <Clock3 size={12} />
                    {formatDate(entry.created_at)}
                  </span>
                  <span className="oh-orderTotal">{formatIDR(entry.total_idr)}</span>
                </div>
              </div>

              <div className="oh-cardRight">
                <span className={`oh-statusPill is-${tone}`}>
                  {prettyStatus(entry.status)}
                </span>
                <button
                  type="button"
                  className="oh-removeBtn"
                  onClick={() => handleRemove(entry.order_code)}
                  aria-label={`Hapus ${entry.order_code} dari riwayat`}
                  title="Hapus dari riwayat"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {hasFetchError ? (
              <div className="oh-fetchError">
                <AlertCircle size={13} />
                <span>Gagal memperbarui - menampilkan status tersimpan</span>
              </div>
            ) : null}

            <div className="oh-cardActions">
              <Link
                className="btn btn-sm oh-cekBtn"
                to={`/status?tab=cek&order=${encodeURIComponent(entry.order_code)}`}
              >
                Cek Status
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// Main Page

export default function Status() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "riwayat" ? "riwayat" : "cek";

  const [settings, setSettings] = useState({ whatsapp: { number: STORE_WHATSAPP.app_premium } });

  usePageMeta({
    title: activeTab === "riwayat" ? "Riwayat Pesanan" : "Status Pesanan",
    description:
      activeTab === "riwayat"
        ? "Semua order dari browser ini kesimpen di sini."
        : "Masukin ID order, langsung keliatan progress-nya.",
  });

  useEffect(() => {
    let active = true;
    fetchSettings()
      .then((result) => {
        if (!active) return;
        const wa = typeof result?.whatsapp === "string" ? { number: result.whatsapp } : (result?.whatsapp || { number: STORE_WHATSAPP.app_premium });
        setSettings({ whatsapp: wa });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  function switchTab(tab) {
    const next = new URLSearchParams(searchParams);
    if (tab === "cek") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="page status-page">
      <section className="section status-shell">
        <div className="container st-wrap">
          <StatusHero
            history={activeTab === "riwayat"}
            hasOrder={activeTab === "cek" && Boolean(searchParams.get("order") || searchParams.get("id") || searchParams.get("order_id"))}
          />

          {activeTab === "cek" ? (
            <div className="st-checkoutSteps">
              <CheckoutSteps current="status" />
            </div>
          ) : null}

          {/* Tab switcher */}
          <div className="st-tabs" role="tablist" aria-label="Pilih tampilan">
            <button
              id="tab-cek"
              role="tab"
              type="button"
              aria-selected={activeTab === "cek"}
              aria-controls="panel-cek"
              className={`st-tab${activeTab === "cek" ? " is-active" : ""}`}
              onClick={() => switchTab("cek")}
            >
              <Activity size={15} />
                Cek status
            </button>
            <button
              id="tab-riwayat"
              role="tab"
              type="button"
              aria-selected={activeTab === "riwayat"}
              aria-controls="panel-riwayat"
              className={`st-tab${activeTab === "riwayat" ? " is-active" : ""}`}
              onClick={() => switchTab("riwayat")}
            >
              <History size={15} />
              Riwayat
            </button>
          </div>

          <div
            id="panel-cek"
            role="tabpanel"
            aria-labelledby="tab-cek"
            tabIndex={0}
            hidden={activeTab !== "cek"}
          >
            {activeTab === "cek" ? <TabCekStatus settings={settings} /> : null}
          </div>
          <div
            id="panel-riwayat"
            role="tabpanel"
            aria-labelledby="tab-riwayat"
            tabIndex={0}
            hidden={activeTab !== "riwayat"}
          >
            {activeTab === "riwayat" ? <TabRiwayat /> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
