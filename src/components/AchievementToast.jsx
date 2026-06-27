import { useCallback, useEffect, useRef, useState } from "react";
import { getOrderHistory } from "../lib/orderHistory";
import { getNewAchievements } from "../lib/achievements";

const ACHIEVEMENT_CHECK_KEY = "imzaqi_achievement_last_check";

export default function AchievementToast() {
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

  useEffect(() => {
    if (current || queue.length === 0) return;
    const next = queue[0];
    setCurrent(next);
    setQueue((prev) => prev.slice(1));
    timerRef.current = setTimeout(() => {
      setCurrent(null);
    }, 4000);
    return () => clearTimeout(timerRef.current);
  }, [current, queue]);

  if (!current) return null;

  return (
    <div className="achievement-toast" role="status" aria-live="polite">
      <div className="achievement-toast-inner">
        <span className="achievement-toast-icon">{current.icon}</span>
        <div className="achievement-toast-body">
          <div className="achievement-toast-title">Achievement Unlocked!</div>
          <div className="achievement-toast-name">{current.title}</div>
          <div className="achievement-toast-desc">{current.desc}</div>
        </div>
      </div>
    </div>
  );
}
