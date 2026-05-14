import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const COLORS = ["#4effda", "#25ebc8", "#00d6b4", "#008a94", "#9cddff"];
const COUNT = 14;

let listenerAttached = false;
let trigger = null;

export function fireConfetti(x, y) {
  if (trigger) trigger({ x, y });
}

export default function Confetti() {
  const [bursts, setBursts] = useState([]);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(m.matches);
    sync();
    if (m.addEventListener) {
      m.addEventListener("change", sync);
      return () => m.removeEventListener("change", sync);
    }
    m.addListener(sync);
    return () => m.removeListener(sync);
  }, []);

  useEffect(() => {
    trigger = ({ x, y }) => {
      if (reduceMotion) return;
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setBursts((prev) => [...prev, { id, x, y }]);
      window.setTimeout(() => {
        setBursts((prev) => prev.filter((b) => b.id !== id));
      }, 900);
    };
    return () => {
      if (!listenerAttached) trigger = null;
    };
  }, [reduceMotion]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="confetti-layer" aria-hidden="true">
      {bursts.map((b) => (
        <div key={b.id} className="confetti-burst" style={{ left: `${b.x}px`, top: `${b.y}px` }}>
          {Array.from({ length: COUNT }).map((_, i) => {
            const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.4;
            const dist = 60 + Math.random() * 40;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist - 20;
            const color = COLORS[i % COLORS.length];
            const rot = Math.random() * 360;
            const dur = 600 + Math.random() * 300;
            return (
              <span
                key={i}
                className="confetti-piece"
                style={{
                  background: color,
                  "--cdx": `${dx}px`,
                  "--cdy": `${dy}px`,
                  "--crot": `${rot}deg`,
                  "--cdur": `${dur}ms`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>,
    document.body
  );
}
