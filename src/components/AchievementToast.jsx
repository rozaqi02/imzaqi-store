import { useCallback, useEffect, useRef, useState } from "react";
import { getOrderHistory } from "../lib/orderHistory";
import { getNewAchievements } from "../lib/achievements";
import { useStorefrontOverlayBlocked } from "../hooks/useFunnelRoute";
import { useOverlayBusy } from "../hooks/useOverlaySlot";

const ACHIEVEMENT_CHECK_KEY = "imzaqi_achievement_last_check";

export default function AchievementToast() {
  const overlayBlocked = useStorefrontOverlayBlocked();
  // Toast bukan modal: tidak berebut slot, hanya menunda selama popup eksklusif tampil.
  const overlayBusy = useOverlayBusy();
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const timerRef = useRef(null);

  const check = useCallback(() => {
    const history = getOrderHistory();
    if (history.length === 0) return;
    try {
      const lastCheck = Number(localStorage.getItem(ACHIEVEMENT_CHECK_KEY) || 0);
      if (Date.now() - lastCheck < 5000) return;
      localStorage.setItem(ACHIEVEMENT_CHECK_KEY, String(Date.now()));
    } catch {}

    const newOnes = getNewAchievements(history);
    if (newOnes.length > 0) {
      setQueue((prev) => [...prev, ...newOnes]);
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [check]);

  // Tunda promosi toast selama rute sensitif atau ada overlay eksklusif aktif.
  useEffect(() => {
    if (current || queue.length === 0 || overlayBlocked || overlayBusy) return undefined;
    const next = queue[0];
    setCurrent(next);
    setQueue((prev) => prev.slice(1));
    timerRef.current = setTimeout(() => {
      setCurrent(null);
    }, 4000);
    return () => clearTimeout(timerRef.current);
  }, [current, queue, overlayBlocked, overlayBusy]);

  // Bila popup eksklusif naik saat toast sedang tayang, kembalikan toast ke
  // antrean supaya tidak habis tanpa terlihat; ia tayang lagi setelah slot bebas.
  useEffect(() => {
    if (!overlayBusy || !current) return;
    setCurrent(null);
    setQueue((prev) => [current, ...prev]);
  }, [overlayBusy, current]);

  if (overlayBlocked || overlayBusy || !current) return null;

  return (
    <div className="achievement-toast" role="status" aria-live="polite">
      <div className="achievement-toast-inner">
        <span className="achievement-toast-icon">{current.icon}</span>
        <div className="achievement-toast-body">
          <div className="achievement-toast-title">Pencapaian baru!</div>
          <div className="achievement-toast-name">{current.title}</div>
          <div className="achievement-toast-desc">{current.desc}</div>
        </div>
      </div>
    </div>
  );
}
