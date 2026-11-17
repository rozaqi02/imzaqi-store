import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  Clock3,
  Flame,
  Package,
  RefreshCw,
  ThumbsUp,
  Trash2,
  Zap,
} from "lucide-react";
import { formatIDR } from "../../lib/format";
import { getOrderStatusTone } from "../../lib/orderStatus";
import {
  clearOrderHistory,
  getOrderHistory,
  removeOrderFromHistory,
  updateOrderHistoryEntry,
} from "../../lib/orderHistory";
import { useToast } from "../../context/ToastContext";
import { fetchOrderByCode, formatDateShort, getSafeOrderItems, prettyStatus } from "./statusHelpers";

function calcStreak(entries) {
  if (!entries || entries.length === 0) return 0;
  const months = [
    ...new Set(
      entries
        .filter((e) => e.status === "done")
        .map((e) => {
          const d = new Date(e.created_at || 0);
          return d.getFullYear() * 12 + d.getMonth();
        })
    ),
  ].sort((a, b) => b - a);
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
  const label =
    streak >= 6
      ? `${streak} bulan berturut-turut · Pelanggan setia`
      : `${streak} bulan berturut-turut`;
  return (
    <div className="st-streakBadge">
      <span className="st-streakEmoji" aria-hidden="true">
        <StreakIcon size={20} />
      </span>
      <div className="st-streakText">
        <strong>Streak {streak} Bulan</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export default function StatusHistoryTab() {
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
      const results = await Promise.all(
        history.map(async (entry) => {
          try {
            const row = await fetchOrderByCode(entry.order_code);
            return { entry, row };
          } catch {
            return { entry, row: null };
          }
        })
      );

      results.forEach(({ entry, row }) => {
        if (row?.status) {
          const updates = { status: row.status };
          const rowItems = getSafeOrderItems(row.items);
          if (!entry.items_summary && rowItems.length > 0) {
            const first = rowItems[0];
            const extra = rowItems.length - 1;
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
    doSync(true);
  }, [doSync]);

  function handleRemove(orderCode) {
    removeOrderFromHistory(orderCode);
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
          <Package size={32} aria-hidden="true" />
        </div>
        <h2 className="oh-emptyTitle">Belum ada riwayat</h2>
        <p className="oh-emptyText">Order dari browser ini muncul di sini.</p>
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

      <div className="oh-listToolbar">
        <button
          type="button"
          className="btn btn-sm btn-ghost oh-refreshAllBtn"
          onClick={() => doSync()}
          disabled={syncing}
          aria-label="Perbarui semua status"
        >
          <RefreshCw size={13} className={syncing ? "oh-spinIcon" : ""} aria-hidden="true" />
          <span>{syncing ? "Memperbarui..." : "Perbarui Semua"}</span>
        </button>

        {confirmClear ? (
          <div className="oh-confirmClear">
            <span>Hapus semua?</span>
            <button type="button" className="btn btn-sm btn-danger" onClick={handleClearAll}>
              Ya, hapus
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmClear(false)}>
              Batal
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-ghost oh-clearAllBtn"
            onClick={() => setConfirmClear(true)}
            aria-label="Hapus semua riwayat"
          >
            <Trash2 size={13} aria-hidden="true" />
            <span>Hapus semua</span>
          </button>
        )}
      </div>

      {entries.map((entry) => {
        const hasFetchError = fetchErrors[entry.order_code];
        const tone = getOrderStatusTone(entry.status);

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
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
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
                    <Clock3 size={12} aria-hidden="true" />
                    {formatDateShort(entry.created_at)}
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
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            </div>

            {hasFetchError ? (
              <div className="oh-fetchError">
                <AlertCircle size={13} aria-hidden="true" />
                <span>Gagal memperbarui · menampilkan status tersimpan</span>
              </div>
            ) : null}

            <div className="oh-cardActions">
              <Link
                className="btn btn-sm oh-cekBtn"
                to={`/status?tab=cek&order=${encodeURIComponent(entry.order_code)}`}
              >
                <span>Lihat Detail</span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
