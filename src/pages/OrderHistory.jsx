import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowUpRight, Clock3, History, Package } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { formatIDR } from "../lib/format";
import { getOrderHistory, updateOrderHistoryStatus } from "../lib/orderHistory";
import { usePageMeta } from "../hooks/usePageMeta";
import "../css/pages/OrderHistory.css";

function prettyStatus(status) {
  const map = {
    pending: "Pending",
    processing: "Diproses",
    done: "Selesai",
    cancelled: "Dibatalkan",
    paid_reported: "Pending",
  };
  return map[String(status || "pending")] || String(status || "pending");
}

function statusTone(status) {
  const map = {
    pending: "pending",
    paid_reported: "pending",
    processing: "processing",
    done: "done",
    cancelled: "cancelled",
  };
  return map[String(status || "pending")] || "pending";
}

function formatDate(isoString) {
  if (!isoString) return "-";
  try {
    return new Date(isoString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

export default function OrderHistory() {
  usePageMeta({
    title: "Riwayat Order",
    description: "Lihat semua riwayat order yang pernah dibuat dari browser ini.",
  });

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchErrors, setFetchErrors] = useState({});

  useEffect(() => {
    const history = getOrderHistory();
    setEntries(history);

    if (history.length === 0) {
      setLoading(false);
      return;
    }

    let active = true;

    async function syncStatuses() {
      const results = await Promise.allSettled(
        history.map(async (entry) => {
          const { data, error } = await supabase.rpc("get_order_public", {
            p_order_code: entry.order_code,
          });
          if (error) throw error;
          const row = Array.isArray(data) ? data[0] : data;
          if (!row) throw new Error("not found");
          return { order_code: entry.order_code, status: row.status };
        })
      );

      if (!active) return;

      const errors = {};
      results.forEach((result, index) => {
        const entry = history[index];
        if (result.status === "fulfilled") {
          updateOrderHistoryStatus(entry.order_code, result.value.status);
        } else {
          errors[entry.order_code] = true;
        }
      });

      setFetchErrors(errors);
      // Re-read from localStorage to get updated statuses
      setEntries(getOrderHistory());
      setLoading(false);
    }

    syncStatuses();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="page oh-page">
      <section className="section reveal oh-shell">
        <div className="container oh-wrap">
          <header className="oh-hero">
            <div className="oh-heroIcon">
              <History size={22} />
            </div>
            <div className="oh-heroCopy">
              <div className="oh-kicker">Browser ini</div>
              <h1 className="h1 oh-title">Riwayat Order</h1>
              <p className="oh-sub">Semua order yang pernah dibuat dari browser ini.</p>
            </div>
          </header>

          {loading ? (
            <div className="oh-loading" role="status" aria-label="Memuat riwayat order">
              <div className="oh-loadingDot" />
              <div className="oh-loadingDot" />
              <div className="oh-loadingDot" />
            </div>
          ) : entries.length === 0 ? (
            <div className="oh-empty">
              <div className="oh-emptyIcon">
                <Package size={32} />
              </div>
              <h2 className="oh-emptyTitle">Belum ada riwayat order dari browser ini</h2>
              <p className="oh-emptyText">
                Order yang kamu buat akan otomatis tersimpan di sini untuk kemudahan pengecekan status.
              </p>
              <Link className="btn" to="/produk">
                Lihat Produk
              </Link>
            </div>
          ) : (
            <div className="oh-list">
              {entries.map((entry) => {
                const hasFetchError = fetchErrors[entry.order_code];
                const tone = statusTone(entry.status);

                return (
                  <article key={entry.order_code} className="oh-card">
                    <div className="oh-cardTop">
                      <div className="oh-cardLeft">
                        <div className="oh-orderCode">{entry.order_code}</div>
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
                      </div>
                    </div>

                    {hasFetchError ? (
                      <div className="oh-fetchError">
                        <AlertCircle size={13} />
                        <span>Gagal memperbarui — menampilkan status tersimpan</span>
                      </div>
                    ) : null}

                    <div className="oh-cardActions">
                      <Link
                        className="btn btn-sm oh-cekBtn"
                        to={`/status?order=${encodeURIComponent(entry.order_code)}`}
                      >
                        Cek Status
                        <ArrowUpRight size={14} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
