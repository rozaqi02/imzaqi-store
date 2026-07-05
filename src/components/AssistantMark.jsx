import React from "react";

/**
 * Imzaqi AI mark — monogram "IM".
 * Gradient lebih gelap biar teks putih "IM" keliatan jelas.
 */
export default function AssistantMark({ size = 24, className = "", variant = "default" }) {
  const gradId = React.useId().replace(/:/g, "");
  const bgId = `aiBg-${gradId}`;
  const shineId = `aiShine-${gradId}`;

  const compact = variant === "avatar" || size <= 16;
  const fontSize = compact ? 7.5 : 9.5;
  const rx = compact ? 5 : 6.5;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Gradient lebih gelap & kontras tinggi supaya "IM" putih keliatan */}
        <linearGradient id={bgId} x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00d2b0" />
          <stop offset="42%" stopColor="#008f78" />
          <stop offset="100%" stopColor="#004f55" />
        </linearGradient>

        {/* Shine lebih halus, gak nutupin teks */}
        <linearGradient id={shineId} x1="5" y1="3" x2="13" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      {/* Background badge */}
      <rect x="2" y="2" width="20" height="20" rx={rx} fill={`url(#${bgId})`} />

      {/* Subtle gloss */}
      <rect x="2" y="2" width="20" height="20" rx={rx} fill={`url(#${shineId})`} />

      {/* Border lebih jelas */}
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx={rx - 0.5}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.8"
      />

      {/* "IM" — putih dengan outline tipis biar tetap keliatan di semua ukuran */}
      <text
        x="12"
        y="12.8"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#ffffff"
        stroke="#00363b"
        strokeWidth="0.5"
        strokeOpacity="0.65"
        fontSize={fontSize}
        fontWeight="900"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        letterSpacing="-0.05em"
      >
        IM
      </text>

      {/* Star accent (tetap seperti versi lama yang disukai) */}
      {!compact ? (
        <path
          d="M17.2 7.1l0.55 1.05 1.15 0.17-0.83 0.81 0.2 1.14-1.03-0.54-1.03 0.54 0.2-1.14-0.83-0.81 1.15-0.17z"
          fill="#e0fffa"
          opacity="0.9"
        />
      ) : null}
    </svg>
  );
}
