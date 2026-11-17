import React from "react";
import {
  ArrowUpRight,
  Calendar,
  Check,
  Clock3,
  Copy,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { copyToClipboard } from "../../utils/clipboard";
import {
  extractCredentials,
  formatDateShort,
  formatRelativeTime,
  prettyStatus,
} from "./statusHelpers";

export default function StatusHeroCard({
  order,
  statusMeta,
  timeline,
  itemCount,
  isTerminal,
  lastUpdated,
  refreshing,
  onRefresh,
  copiedCode,
  onCopyCode,
  reservationCountdown,
  uploadingProof,
  onProofUpload,
  proofWaUrl,
  waUrl,
  claimWarrantyUrl,
  onReorder,
  hasItems,
  toast,
}) {
  const StatusIcon = statusMeta.icon;
  const statusKey = String(order?.status || "pending");
  const isAwaitingPayment = statusKey === "pending" || statusKey === "pending_payment";
  const isReported = statusKey === "paid_reported";
  const isCancelledOrExpired = statusKey === "cancelled" || statusKey === "expired";
  const isDone = statusKey === "done";

  const createdDateLabel = formatDateShort(order?.created_at);
  const reportedDateLabel = order?.payment_reported_at ? formatDateShort(order.payment_reported_at) : "";
  const lastUpdatedLabel = lastUpdated ? formatRelativeTime(lastUpdated) : "";

  const creds = !isCancelledOrExpired ? extractCredentials(order?.admin_note) : null;

  async function handleCopyValue(value, label) {
    try {
      await copyToClipboard(value);
      toast?.success?.(`${label} disalin`);
    } catch {
      toast?.error?.(`Gagal menyalin ${label.toLowerCase()}`);
    }
  }

  return (
    <article className="st-card st-heroCard">
      <div className="st-heroTop">
        <div className="st-heroIdentity">
          <span className="st-kicker">ID Pesanan</span>
          <div className="st-orderCodeRow">
            <strong className="st-orderCodeText">{order.order_code}</strong>
            <button
              type="button"
              className={`st-copyCodeBtn${copiedCode ? " is-copied" : ""}`}
              onClick={onCopyCode}
              aria-label="Salin ID Pesanan"
              title="Salin ID Pesanan"
            >
              {copiedCode ? <Check size={13} className="st-copySuccessIcon" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              <span>{copiedCode ? "Tersalin" : "Salin"}</span>
            </button>
          </div>
          <div className="st-heroMetaLine">
            <span className="st-heroMetaItem">
              <Calendar size={12} aria-hidden="true" />
              <span>{createdDateLabel}</span>
            </span>
            <span className="st-metaDot" aria-hidden="true">·</span>
            <span>{itemCount} item</span>
            {!isTerminal ? (
              <span className="st-liveMetaGroup">
                <span className="st-liveMeta">
                  <span className="st-liveDot" aria-hidden="true" />
                  <span>{lastUpdatedLabel ? `Diperbarui ${lastUpdatedLabel}` : "Auto-cek 30 dtk"}</span>
                </span>
                <button
                  type="button"
                  className="st-refreshBtn"
                  onClick={onRefresh}
                  disabled={refreshing}
                  aria-label="Perbarui status"
                  title="Perbarui status sekarang"
                >
                  <RefreshCw size={13} className={refreshing ? "st-spin" : ""} aria-hidden="true" />
                </button>
              </span>
            ) : null}
          </div>
        </div>

        <div className="st-heroState">
          <div className={`st-statePill is-${statusMeta.tone}`}>
            <StatusIcon size={15} aria-hidden="true" />
            <span>{prettyStatus(order.status)}</span>
          </div>
          {reservationCountdown ? (
            <span
              className={`st-expiryChip${reservationCountdown.isExpired ? " is-expired" : ""}`}
              role="status"
            >
              <Clock3 size={12} aria-hidden="true" />
              <span>{reservationCountdown.label}</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Compact Horizontal Progress Rail */}
      <ol className="st-rail" aria-label="Tahap pesanan">
        {timeline.map((step, index) => {
          const isStepCancelled = step.key === "cancelled" || step.key === "expired";
          return (
            <li
              key={step.key}
              className={`st-railStep${step.active ? " is-active" : ""}${step.done ? " is-done" : ""}${isStepCancelled ? " is-cancelled" : ""}`}
            >
              <div className="st-railHead">
                <span className="st-railNode" aria-hidden="true">
                  {step.done ? (
                    <Check size={12} strokeWidth={3} />
                  ) : isStepCancelled ? (
                    <X size={12} strokeWidth={3} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </span>
                {index < timeline.length - 1 ? (
                  <span className={`st-railTrack${step.done ? " is-done" : ""}`} aria-hidden="true" />
                ) : null}
              </div>
              <span className="st-railLabel">{step.label}</span>
            </li>
          );
        })}
      </ol>

      {/* Stage Focus Box: Single primary message & contextual next action */}
      <div className={`st-stageFocus is-${statusMeta.tone}`}>
        <div className="st-stageLead">
          <p className="st-stageSubtitle">{statusMeta.subtitle}</p>
          {isReported && (reportedDateLabel || order.late_payment_report) ? (
            <div className="st-stageBadges">
              {reportedDateLabel ? (
                <span className="st-stageBadge">
                  <Clock3 size={11} aria-hidden="true" />
                  Dilaporkan {reportedDateLabel}
                </span>
              ) : null}
              {order.late_payment_report ? (
                <span className="st-stageBadge is-warn">
                  <ShieldAlert size={11} aria-hidden="true" />
                  Lewat batas waktu
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {order.admin_note ? (
          <div className={`st-deliverable${isCancelledOrExpired ? " is-system" : ""}`}>
            <div className="st-deliverableHead">
              <div>
                <div className="st-kicker">{isCancelledOrExpired ? "Catatan Sistem" : "Catatan & Akun Admin"}</div>
              </div>
              <div className="st-deliverableCopyActions">
                {creds?.email ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm st-copyNoteBtn"
                    onClick={() => handleCopyValue(creds.email, "Email")}
                    title="Salin email akun"
                  >
                    <Copy size={12} aria-hidden="true" />
                    <span>Email</span>
                  </button>
                ) : null}
                {creds?.password ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm st-copyNoteBtn"
                    onClick={() => handleCopyValue(creds.password, "Password")}
                    title="Salin password akun"
                  >
                    <Copy size={12} aria-hidden="true" />
                    <span>Password</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm st-copyNoteBtn"
                  onClick={() => handleCopyValue(order.admin_note, "Catatan")}
                  title="Salin semua catatan admin"
                >
                  <Copy size={12} aria-hidden="true" />
                  <span>Salin</span>
                </button>
              </div>
            </div>
            <div className="st-noteBody">{order.admin_note}</div>
          </div>
        ) : null}

        {isAwaitingPayment || isReported ? (
          <div className="st-paymentBar">
            <div className="st-proofMeta">
              {order.payment_proof_url ? (
                <a
                  href={order.payment_proof_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Lihat bukti pembayaran"
                  className="st-proofThumbLink"
                >
                  <img
                    className="st-proofPreviewThumb"
                    src={order.payment_proof_url}
                    alt="Bukti pembayaran pesanan"
                  />
                </a>
              ) : null}
              <div className="st-proofText">
                <strong>
                  {order.payment_proof_url
                    ? "Bukti bayar terunggah"
                    : isReported
                      ? "Belum ada screenshot tersimpan"
                      : "Unggah bukti transfer QRIS"}
                </strong>
                <small>
                  {order.payment_proof_url
                    ? "Klik foto untuk memperbesar, atau ganti bila keliru."
                    : "Screenshot JPG/PNG/WebP dikompresi otomatis."}
                </small>
              </div>
            </div>

            <div className="st-stageActions">
              <label
                className="btn btn-ghost btn-sm"
                style={{ cursor: uploadingProof ? "wait" : "pointer" }}
              >
                <Upload size={14} aria-hidden="true" />
                <span>
                  {uploadingProof
                    ? "Mengunggah..."
                    : order.payment_proof_url
                      ? "Ganti Bukti"
                      : "Upload Bukti"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingProof}
                  onChange={onProofUpload}
                  style={{ position: "absolute", opacity: 0, width: 1, height: 1, overflow: "hidden" }}
                />
              </label>

              {proofWaUrl ? (
                <a
                  className={`btn btn-sm${isAwaitingPayment ? " btn-primary" : " btn-ghost"}`}
                  href={proofWaUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={14} strokeWidth={2.2} aria-hidden="true" />
                  <span>{isReported ? "Follow-up Admin WA" : "Kirim Bukti via WA"}</span>
                  <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {isDone ? (
          <div className="st-stageActions st-stageActions--done">
            {hasItems ? (
              <button type="button" className="btn btn-sm" onClick={onReorder}>
                <RotateCcw size={14} aria-hidden="true" />
                <span>Pesan Lagi</span>
              </button>
            ) : null}
            <a
              className="btn btn-ghost btn-sm st-warrantyBtn"
              href={claimWarrantyUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ShieldCheck size={14} aria-hidden="true" />
              <span>Klaim Garansi / Kendala Akun</span>
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </div>
        ) : null}

        {isCancelledOrExpired ? (
          <div className="st-stageActions">
            {hasItems ? (
              <button type="button" className="btn btn-sm" onClick={onReorder}>
                <RotateCcw size={14} aria-hidden="true" />
                <span>Pesan Lagi</span>
              </button>
            ) : null}
            <a className="btn btn-ghost btn-sm" href={waUrl} target="_blank" rel="noreferrer">
              <MessageCircle size={14} aria-hidden="true" />
              <span>Tanya Admin WA</span>
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </div>
        ) : null}
      </div>
    </article>
  );
}
