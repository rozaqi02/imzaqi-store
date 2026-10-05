import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Check, CheckCircle2, Phone, ShieldCheck, X } from "lucide-react";
import { useDialogA11y } from "../../../hooks/useDialogA11y";
import { copyToClipboard } from "../../../utils/clipboard";
import { formatIDR } from "../../../lib/format";

const COPY_TIMEOUT_MS = 1800;
const QRIS_EXPIRY_MS = 30 * 60 * 1000; // 30 menit

export function QRISSkeleton() {
  return (
    <div className="qris-skeleton" role="status" aria-label="Memuat QRIS">
      <div className="qris-skeletonBox" />
    </div>
  );
}

export function QRISZoomModal({ open, qrisUrl, onClose }) {
  const [phase, setPhase] = useState("entering");
  const zoomContentRef = useRef(null);

  useDialogA11y({
    open,
    containerRef: zoomContentRef,
    onClose,
    initialFocusSelector: ".pay-zoomClose",
  });

  useEffect(() => {
    if (!open) return;
    const f1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPhase("open");
      });
    });
    return () => cancelAnimationFrame(f1);
  }, [open]);

  if (!open || !qrisUrl) return null;

  const handleClose = () => {
    setPhase("closing");
    setTimeout(onClose, 200);
  };

  return createPortal(
    <div 
      className={`pay-zoomOverlay pay-zoom-${phase}`} 
      onClick={handleClose}
      role="presentation"
    >
      <div 
        ref={zoomContentRef}
        className="pay-zoomContent" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="QRIS perbesar"
      >
        <button 
          className="pay-zoomClose" 
          type="button" 
          onClick={handleClose} 
          aria-label="Tutup perbesar"
        >
          <X size={22} />
        </button>
        <img src={qrisUrl} alt="QRIS Perbesar" className="pay-zoomImg" />
        <div className="pay-zoomTip">Ketuk di luar gambar untuk kembali</div>
      </div>
    </div>,
    document.body
  );
}

export function OrderSuccessModal({ open, orderCode, statusUrl, adminWaUrl, onClose, onCopied, isAcademicOrder = false }) {
  const [copied, setCopied] = useState(false);
  const modalRef = useRef(null);

  useDialogA11y({
    open,
    containerRef: modalRef,
    onClose,
    initialFocusSelector: ".icon-btn",
  });

  useEffect(() => {
    if (open && typeof window !== "undefined" && window.confetti) {
      window.confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 },
        colors: ["#4effda", "#25ebc8", "#00d6b4", "#ffd700", "#ff6b9d", "#a78bfa"],
      });
      setTimeout(() => {
        if (window.confetti) {
          window.confetti({
            particleCount: 60,
            spread: 100,
            origin: { y: 0.4, x: 0.3 },
            colors: ["#4effda", "#ffd700", "#ff6b9d"],
          });
          window.confetti({
            particleCount: 60,
            spread: 100,
            origin: { y: 0.4, x: 0.7 },
            colors: ["#25ebc8", "#a78bfa", "#00d6b4"],
          });
        }
      }, 400);
    }
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  async function copyCode() {
    try {
      await copyToClipboard(orderCode);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_TIMEOUT_MS);
      onCopied?.();
    } catch {
      // Ignore clipboard failure.
    }
  }

  const academicWaUrl = `https://wa.me/6281232742374?text=${encodeURIComponent(
    `Halo Admin Jasa Akademik, saya telah menyelesaikan pembayaran dengan ID Order: ${orderCode}`
  )}`;

  return createPortal(
    <div className="modal-backdrop pay-overlay" onMouseDown={onClose} role="presentation">
      <div
        ref={modalRef}
        className="modal pay-successModal pay-successModal--animate"
        role="dialog"
        aria-modal="true"
        aria-label="Order berhasil"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pay-celebrationParticles" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className={`pay-celebrationDot pay-celebrationDot--${i % 6}`} />
          ))}
        </div>

        <div className="modal-head pay-successHead">
          <div>
            <p className="pay-successLabel">Order</p>
            <div className="modal-title">Pembayaran dilaporkan</div>
            <div className="modal-sub">Admin sedang memverifikasi pembayaranmu. Biasanya selesai dalam 5–30 menit.</div>
          </div>
          <button className="pay-successClose" type="button" onClick={onClose} aria-label="Tutup">
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>

        <div className="modal-body">
          <div className="pay-successSteps" aria-label="Langkah selanjutnya">
            <div className="pay-successStep is-done">
              <span>1</span>
              Order tersimpan
            </div>
            <div className="pay-successStep is-active">
              <span>2</span>
              Lapor bayar
            </div>
            <div className="pay-successStep">
              <span>3</span>
              Tunggu verifikasi
            </div>
          </div>

          <div className="pay-successHero">
            <div className="pay-successIconWrap">
              <div className="pay-successGlow" aria-hidden="true" />
              <div className="pay-successIcon pay-successIcon--animate">
                <CheckCircle2 size={34} />
              </div>
            </div>
            <div className="pay-successKicker">ID ORDER</div>
            <div className="pay-successCode pay-successCode--animate" style={{ whiteSpace: "nowrap" }}>{orderCode}</div>
            <p className="pay-successLead">Simpan ID ini untuk mengecek status pesanan dari perangkat mana pun.</p>
          </div>

          {isAcademicOrder ? (
            <div className="pay-successActions">
              <a
                className="btn btn-wide btn-primary"
                href={academicWaUrl}
                target="_blank"
                rel="noreferrer"
              >
                Hubungi Admin WA
              </a>
              <Link className="btn btn-ghost" to={statusUrl}>
                Cek Status Order
              </Link>
              <button className="btn btn-ghost" type="button" onClick={copyCode}>
                {copied ? "✓ ID tersalin" : "Salin ID"}
              </button>
            </div>
          ) : (
            <div className="pay-successActions">
              <Link className="btn btn-wide btn-primary" to={statusUrl}>
                Cek Status Order
              </Link>
              <button className="btn btn-ghost" type="button" onClick={copyCode}>
                {copied ? "✓ ID tersalin" : "Salin ID"}
              </button>
              <a className="btn btn-ghost" href={adminWaUrl} target="_blank" rel="noreferrer">
                Chat Admin
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function useModalCountUp(active, target, duration = 520) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return undefined;
    }

    const end = Number(target) || 0;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (reduce || !end) {
      setValue(end);
      return undefined;
    }

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(end * eased));
      if (t < 1) requestAnimationFrame(tick);
    };

    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target, duration]);

  return value;
}

export function ConfirmPaymentModal({ open, onConfirm, onCancel, total, items, isFree }) {
  const modalRef = useRef(null);
  const animatedTotal = useModalCountUp(open && !isFree, total);

  useDialogA11y({
    open,
    containerRef: modalRef,
    onClose: onCancel,
    initialFocusSelector: ".pay-confirmPrimaryBtn",
  });

  if (!open || typeof document === "undefined") return null;

  const itemCount = (items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);

  const declarationTitle = isFree
    ? "Konfirmasi order promo 100%"
    : "Saya telah scan QRIS dan transfer sukses";
  const declarationDesc = isFree
    ? "Order gratis tanpa transfer. Admin akan langsung menyiapkan akun Anda."
    : `Pembayaran ${formatIDR(total)} sudah berhasil dari m-banking / e-wallet saya.`;

  return createPortal(
    <div className="modal-backdrop pay-overlay pay-confirmOverlay" onMouseDown={onCancel} role="presentation">
      <div
        ref={modalRef}
        className="pay-confirmModal pay-confirmModal--animate"
        role="dialog"
        aria-modal="true"
        aria-label="Konfirmasi Pembayaran"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pay-confirmModalHeader">
          <div className="pay-confirmModalHeaderIcon">
            <ShieldCheck size={20} />
          </div>
          <div className="pay-confirmModalHeaderCopy">
            <div className="pay-confirmModalTitle">{isFree ? "Konfirm Order Gratis" : "Konfirmasi Pembayaran"}</div>
            <div className="pay-confirmModalSub">
              Siap dikonfirmasi - ID order akan dibuat
            </div>
          </div>
          <button className="pay-confirmCloseBtn" type="button" onClick={onCancel} aria-label="Tutup">
            <X size={16} />
          </button>
        </div>

        <div className="pay-confirmModalBody">
          <aside className="pay-confirmAside" aria-label="Ringkasan pembayaran">
            <div className="pay-confirmTotalCard pay-confirmTotalCard--pulse">
              <div className="pay-confirmTotalLabel">{isFree ? "Total setelah promo" : "Total tagihan"}</div>
              <div className="pay-confirmTotalAmount">
                {isFree ? "Gratis" : formatIDR(animatedTotal)}
              </div>
              <div className="pay-confirmTotalMeta">
                <span>{itemCount} item</span>
                {isFree ? (
                  <span className="pay-confirmTotalBadge is-promo">Promo 100%</span>
                ) : (
                  <span className="pay-confirmTotalBadge is-qris">
                    <Phone size={11} />
                    QRIS
                  </span>
                )}
              </div>
            </div>
          </aside>

          <div className="pay-confirmMain">
            <div className="pay-confirmDeclarationTextOnly" aria-label="Pernyataan Konfirmasi">
              <strong className="pay-confirmDeclarationTitle">{declarationTitle}</strong>
              <span className="pay-confirmDeclarationDesc">{declarationDesc}</span>
            </div>

            <div className="pay-confirmActionsNew">
              <button
                className="pay-confirmPrimaryBtn is-ready"
                type="button"
                onClick={onConfirm}
              >
                <Check size={16} strokeWidth={2.5} />
                {isFree ? "Konfirmasi Order Sekarang" : "Konfirmasi Pembayaran Sekarang"}
              </button>
              <button className="pay-confirmSecondaryBtn" type="button" onClick={onCancel}>
                Belum, cek lagi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function useQrisTimer(active) {
  const TOTAL_MS = QRIS_EXPIRY_MS;
  const [remaining, setRemaining] = useState(TOTAL_MS);
  const startRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setRemaining(TOTAL_MS);
      startRef.current = null;
      return;
    }
    startRef.current = Date.now();
    setRemaining(TOTAL_MS);

    const id = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const left = Math.max(0, TOTAL_MS - elapsed);
      setRemaining(left);
      if (left === 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [active, TOTAL_MS]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const expired = remaining === 0;
  const urgent = remaining <= 5 * 60 * 1000 && remaining > 0;
  const label = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return { label, expired, urgent, remaining };
}
