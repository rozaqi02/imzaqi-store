import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Activity, History, MessageCircle, PartyPopper } from "lucide-react";
import { fireConfetti } from "../components/Confetti";
import CheckoutSteps from "../components/CheckoutSteps";
import { StatusHero } from "../components/StorefrontHero";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { fetchProducts, fetchSettings } from "../lib/api";
import { formatIDR, toWhatsAppDigits } from "../lib/format";
import { trackFunnelEvent } from "../lib/funnelAnalytics";
import { warn } from "../lib/log";
import { recordCompletedOrder } from "../lib/loyalty";
import { getOrderHistory, updateOrderHistoryStatus } from "../lib/orderHistory";
import { STORE_WHATSAPP } from "../lib/productCategories";
import { supabase } from "../lib/supabaseClient";
import { copyToClipboard } from "../utils/clipboard";
import { compressImage } from "../utils/imageCompress";
import StatusHeroCard from "./status/StatusHeroCard";
import StatusHistoryTab from "./status/StatusHistoryTab";
import StatusOrderDetails from "./status/StatusOrderDetails";
import StatusReviewStrip from "./status/StatusReviewStrip";
import StatusSearchBar from "./status/StatusSearchBar";
import {
  buildOrderWaUrls,
  fetchOrderByCode,
  formatReservationCountdown,
  getSafeOrderItems,
  getStatusMeta,
  getTimeline,
  normalizeOrderCode,
  POLL_INTERVAL_MS,
  TERMINAL_STATUSES,
} from "./status/statusHelpers";

function DoneCelebration({ show, onDismiss }) {
  useEffect(() => {
    if (!show) return undefined;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 3;
    fireConfetti(cx, cy);
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
        <span className="st-doneCelebration-icon" aria-hidden="true">
          <PartyPopper size={26} />
        </span>
        <div className="st-doneCelebration-text">
          <strong>Pesananmu sudah selesai!</strong>
          <span>Terima kasih sudah belanja di Imzaqi Store.</span>
        </div>
      </div>
    </div>
  );
}

function TabCekStatus({ settings, onOrderLoadedChange }) {
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
  const [products, setProducts] = useState([]);

  const prevStatusRef = useRef(null);
  const lastLookedUpCodeRef = useRef("");
  const pollTimerRef = useRef(null);

  useEffect(() => {
    onOrderLoadedChange?.(Boolean(order));
  }, [order, onOrderLoadedChange]);

  const orderItems = useMemo(() => getSafeOrderItems(order?.items), [order?.items]);

  const isAcademicOrder = useMemo(() => {
    return orderItems.some((item) => {
      const name = String(item?.product_name || item?.name || "").toLowerCase();
      return /turnitin|parafrase|paraphrase|plagiasi|zerogpt|mendeley|skripsi|tesis|jurnal|akademik/.test(name);
    });
  }, [orderItems]);

  const waNumberRaw = isAcademicOrder
    ? STORE_WHATSAPP.academic
    : settings?.whatsapp?.number || (typeof settings?.whatsapp === "string" ? settings.whatsapp : STORE_WHATSAPP.app_premium);
  const waNumber = toWhatsAppDigits(waNumberRaw) || STORE_WHATSAPP.app_premium;

  const lookup = useCallback(
    async (rawValue) => {
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
        setLastUpdated(new Date());
        if (row.order_code && row.status) {
          updateOrderHistoryStatus?.(row.order_code, row.status);
        }
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
        const text = "Status belum bisa diambil. Coba lagi nanti.";
        warn("Gagal mengambil status order:", error);
        setMessage(text);
        toast.error(text);
      } finally {
        setLoading(false);
      }
    },
    [setSearchParams, toast]
  );

  const silentRefresh = useCallback(async (orderCode) => {
    if (!orderCode) return;
    setRefreshing(true);
    try {
      const row = await fetchOrderByCode(orderCode);
      if (!row) return;
      setOrder(row);
      setLastUpdated(new Date());
      if (row.order_code && row.status) {
        updateOrderHistoryStatus?.(row.order_code, row.status);
      }
    } catch {
      // silent background refresh
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

  useEffect(() => {
    const statusKey = String(order?.status || "");
    if ((statusKey !== "pending" && statusKey !== "pending_payment") || !order?.reservation_expires_at) {
      return undefined;
    }
    setNowTick(Date.now());
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [order?.status, order?.reservation_expires_at]);

  const productLookup = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      if (p.id) map.set(p.id, p);
      if (p.name) map.set(String(p.name).toLowerCase().trim(), p);
    });
    return map;
  }, [products]);

  const recentOrders = useMemo(() => getOrderHistory().slice(0, 4), []);
  const otherRecentOrders = useMemo(
    () => recentOrders.filter((r) => !order || r.order_code !== order.order_code),
    [recentOrders, order]
  );

  const statusMeta = useMemo(() => getStatusMeta(order), [order]);
  const timeline = useMemo(() => getTimeline(order?.status), [order?.status]);
  const itemCount = useMemo(
    () => orderItems.reduce((sum, item) => sum + Number(item?.qty || 0), 0),
    [orderItems]
  );
  const reservationCountdown = useMemo(
    () => formatReservationCountdown(order, nowTick),
    [order, nowTick]
  );
  const { waUrl, proofWaUrl, claimWarrantyUrl } = useMemo(
    () => buildOrderWaUrls({ order, fallbackCode: input.trim(), waNumber }),
    [order, input, waNumber]
  );

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
      toast.info("Gunakan tombol Kirim Bukti via WA di bawah.");
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
              verification_status: updated?.verification_status || "reported",
            }
          : prev
      );
      updateOrderHistoryStatus?.(order.order_code, nextStatus);
      toast.success("Bukti pembayaran terunggah! Pesanan diteruskan ke admin.");
    } catch (err) {
      warn("Gagal upload bukti pembayaran:", err);
      toast.error("Upload otomatis belum aktif. Kirim bukti lewat tombol WA ya.");
    } finally {
      setUploadingProof(false);
      if (event?.target) event.target.value = "";
    }
  }

  function handleReorder() {
    if (!orderItems.length || typeof cart?.add !== "function") return;
    let addedCount = 0;
    for (const item of orderItems) {
      const product =
        (item?.product_id ? productLookup.get(item.product_id) : null) ||
        (item?.product_name ? productLookup.get(String(item.product_name).toLowerCase().trim()) : null);
      const activeVariants = Array.isArray(product?.variants) ? product.variants : [];
      const matchedVariant =
        activeVariants.find((v) => item?.variant_id && v.id === item.variant_id) ||
        activeVariants.find(
          (v) => String(v.name || "").trim().toLowerCase() === String(item?.variant_name || "").trim().toLowerCase()
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

  const isTerminal = order ? TERMINAL_STATUSES.has(order.status) : false;

  return (
    <>
      <DoneCelebration show={showCelebration} onDismiss={() => setShowCelebration(false)} />

      {!order ? (
        <div className="st-landingState">
          <StatusSearchBar
            input={input}
            onChange={setInput}
            onSubmit={lookup}
            onPaste={pasteOrderCode}
            loading={loading}
            message={message}
          />

          {recentOrders.length > 0 ? (
            <section className="st-recent">
              <div className="st-recentHead">
                <History size={14} aria-hidden="true" />
                <span>Order terakhir di perangkat ini</span>
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
            <a className="btn btn-ghost btn-sm" href={waUrl} target="_blank" rel="noreferrer">
              <MessageCircle size={15} strokeWidth={2.2} aria-hidden="true" />
              <span>Hubungi admin</span>
            </a>
          </section>
        </div>
      ) : (
        <div className="st-layout">
          <StatusSearchBar
            compact
            input={input}
            onChange={setInput}
            onSubmit={lookup}
            onPaste={pasteOrderCode}
            loading={loading}
            message={message}
            recentOrders={otherRecentOrders}
            onSelectOrder={(code) => {
              setInput(code);
              lookup(code);
            }}
          />

          <StatusHeroCard
            order={order}
            statusMeta={statusMeta}
            timeline={timeline}
            itemCount={itemCount}
            isTerminal={isTerminal}
            lastUpdated={lastUpdated}
            refreshing={refreshing}
            onRefresh={() => silentRefresh(order.order_code)}
            copiedCode={copiedCode}
            onCopyCode={copyOrderCode}
            reservationCountdown={reservationCountdown}
            uploadingProof={uploadingProof}
            onProofUpload={handleProofUpload}
            proofWaUrl={proofWaUrl}
            waUrl={waUrl}
            claimWarrantyUrl={claimWarrantyUrl}
            onReorder={handleReorder}
            hasItems={orderItems.length > 0}
            toast={toast}
          />

          <StatusOrderDetails
            order={order}
            itemCount={itemCount}
            productLookup={productLookup}
            waUrl={waUrl}
            onReorder={handleReorder}
          />

          {order.status === "done" ? (
            <StatusReviewStrip order={order} waUrl={waUrl} toast={toast} />
          ) : null}
        </div>
      )}
    </>
  );
}

export default function Status() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "riwayat" ? "riwayat" : "cek";
  const [hasLoadedOrder, setHasLoadedOrder] = useState(false);

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
        const wa =
          typeof result?.whatsapp === "string"
            ? { number: result.whatsapp }
            : result?.whatsapp || { number: STORE_WHATSAPP.app_premium };
        setSettings({ whatsapp: wa });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
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

  const isFocusedOrderView = activeTab === "cek" && hasLoadedOrder;

  return (
    <div className="page status-page">
      <section className="section status-shell">
        <div className="container st-wrap">
          {!isFocusedOrderView ? (
            <>
              <StatusHero
                history={activeTab === "riwayat"}
                hasOrder={false}
              />

              {activeTab === "cek" ? (
                <div className="st-checkoutSteps">
                  <CheckoutSteps current="status" />
                </div>
              ) : null}
            </>
          ) : null}

          <div className={`st-topBar${isFocusedOrderView ? " is-focused" : ""}`}>
            {isFocusedOrderView ? (
              <div className="st-focusedHeading">
                <span className="st-kicker">Pelacakan Pesanan</span>
              </div>
            ) : null}

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
                <Activity size={15} aria-hidden="true" />
                <span>Cek status</span>
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
                <History size={15} aria-hidden="true" />
                <span>Riwayat</span>
              </button>
            </div>
          </div>

          <div
            id="panel-cek"
            role="tabpanel"
            aria-labelledby="tab-cek"
            tabIndex={0}
            hidden={activeTab !== "cek"}
          >
            {activeTab === "cek" ? (
              <TabCekStatus settings={settings} onOrderLoadedChange={setHasLoadedOrder} />
            ) : null}
          </div>
          <div
            id="panel-riwayat"
            role="tabpanel"
            aria-labelledby="tab-riwayat"
            tabIndex={0}
            hidden={activeTab !== "riwayat"}
          >
            {activeTab === "riwayat" ? <StatusHistoryTab /> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
