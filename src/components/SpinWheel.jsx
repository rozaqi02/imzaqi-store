import React, { useCallback, useEffect, useRef, useState } from "react";
import { fireConfetti } from "./Confetti";
import { useToast } from "../context/ToastContext";

const STORAGE_KEY = "imzaqi_spin_last";
const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

const PRIZES = [
  { label: "Diskon 5%",  code: "SPIN5",   color: "#00d6b4", chance: 30 },
  { label: "Diskon 8%",  code: "SPIN8",   color: "#00c2d0", chance: 25 },
  { label: "Coba lagi",  code: null,      color: "#334155", chance: 20 },
  { label: "Diskon 10%", code: "SPIN10",  color: "#7c3aed", chance: 15 },
  { label: "Coba lagi",  code: null,      color: "#334155", chance: 7  },
  { label: "Diskon 15%", code: "SPIN15",  color: "#ff6b6b", chance: 3  },
];

const TOTAL_CHANCE = PRIZES.reduce((s, p) => s + p.chance, 0);

function pickPrize() {
  const r = Math.random() * TOTAL_CHANCE;
  let acc = 0;
  for (const p of PRIZES) {
    acc += p.chance;
    if (r <= acc) return p;
  }
  return PRIZES[0];
}

function canSpin() {
  try {
    const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
    return Date.now() - last > SPIN_COOLDOWN_MS;
  } catch { return true; }
}

function markSpun() {
  try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
}

function getNextSpinTime() {
  try {
    const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
    if (!last) return null;
    const next = new Date(last + SPIN_COOLDOWN_MS);
    return next.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch { return null; }
}

export default function SpinWheel({ onClose }) {
  const toast = useToast();
  const canvasRef = useRef(null);
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState(null);
  const [ready, setReady] = useState(canSpin());
  const angleRef = useRef(0);
  const rafRef = useRef(null);

  const drawWheel = useCallback((angle = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = cx - 8;
    const segAngle = (2 * Math.PI) / PRIZES.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.32)";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    PRIZES.forEach((p, i) => {
      const start = angle + i * segAngle;
      const end = start + segAngle;

      // Segment
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + segAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 4;
      ctx.fillText(p.label, r - 14, 5);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, 2 * Math.PI);
    ctx.fillStyle = "#0a0a0f";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,214,180,0.6)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }, []);

  useEffect(() => {
    drawWheel(0);
  }, [drawWheel]);

  const handleSpin = useCallback(() => {
    if (spinning || !ready) return;

    const winner = pickPrize();
    const winnerIdx = PRIZES.indexOf(winner);
    const segAngle = (2 * Math.PI) / PRIZES.length;

    // Target: point needle (top = -PI/2) at winner segment center
    const targetAngle = -(winnerIdx * segAngle + segAngle / 2) - Math.PI / 2;
    const fullSpins = (6 + Math.floor(Math.random() * 4)) * 2 * Math.PI;
    const finalAngle = fullSpins + targetAngle;

    setSpinning(true);
    setPrize(null);

    const duration = 3800;
    const start = performance.now();
    const startAngle = angleRef.current;

    function ease(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function animate(now) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const current = startAngle + (finalAngle - startAngle) * ease(t);
      angleRef.current = current;
      drawWheel(current);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        setPrize(winner);
        markSpun();
        setReady(false);
        if (winner.code) {
          fireConfetti(window.innerWidth / 2, window.innerHeight / 3);
        }
      }
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [spinning, ready, drawWheel]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const copyCode = useCallback(() => {
    if (!prize?.code) return;
    try {
      navigator.clipboard.writeText(prize.code);
      toast.success(`Kode ${prize.code} disalin!`, { title: "Siap dipakai" });
    } catch {}
  }, [prize, toast]);

  const nextTime = getNextSpinTime();

  return (
    <div className="spin-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Lucky Spin">
      <div className="spin-modal" onClick={(e) => e.stopPropagation()}>
        <button className="spin-close" type="button" onClick={onClose} aria-label="Tutup">×</button>

        <div className="spin-header">
          <div className="spin-title">🎯 Lucky Spin</div>
          <div className="spin-subtitle">Putar sekali sehari, dapet diskon!</div>
        </div>

        <div className="spin-wheel-wrap">
          {/* Needle */}
          <div className="spin-needle" aria-hidden="true">▼</div>
          <canvas
            ref={canvasRef}
            width={280}
            height={280}
            className="spin-canvas"
            aria-label="Roda keberuntungan"
          />
        </div>

        {prize ? (
          <div className={`spin-result ${prize.code ? "is-win" : "is-try"}`}>
            {prize.code ? (
              <>
                <div className="spin-result-emoji">🎉</div>
                <div className="spin-result-label">Selamat! Kamu dapat</div>
                <div className="spin-result-prize">{prize.label}</div>
                <button className="spin-copy-btn" type="button" onClick={copyCode}>
                  Salin kode: <strong>{prize.code}</strong>
                </button>
                <div className="spin-result-hint">Masukkan kode saat checkout</div>
              </>
            ) : (
              <>
                <div className="spin-result-emoji">😅</div>
                <div className="spin-result-label">Belum beruntung kali ini</div>
                <div className="spin-result-hint">Coba lagi besok ya!</div>
              </>
            )}
          </div>
        ) : (
          <button
            className={`btn spin-btn${spinning ? " is-spinning" : ""}${!ready ? " btn-disabled" : ""}`}
            type="button"
            onClick={handleSpin}
            disabled={spinning || !ready}
          >
            {spinning ? "Memutar..." : ready ? "Putar Sekarang! 🎰" : `Spin lagi jam ${nextTime}`}
          </button>
        )}
      </div>
    </div>
  );
}
