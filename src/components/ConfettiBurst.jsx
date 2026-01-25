import React, { useMemo } from "react";

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

export default function ConfettiBurst({ show }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        id: i,
        x: rand(-30, 30),
        r: rand(0, 360),
        s: rand(0.75, 1.3),
        d: rand(0, 0.35),
      })),
    []
  );

  if (!show) return null;

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            "--x": `${p.x}vw`,
            "--r": `${p.r}deg`,
            "--s": p.s,
            "--d": `${p.d}s`,
          }}
        />
      ))}
    </div>
  );
}
