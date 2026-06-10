import React from "react";

/**
 * Imzaqi AI mark v3 — glass neural orb, tuned for pale cyan hero background.
 */
export default function AssistantMark({ size = 24, className = "", variant = "default" }) {
  const gradId = React.useId().replace(/:/g, "");
  const glowId = `aiGlow-${gradId}`;
  const coreId = `aiCore-${gradId}`;

  const coreOpacity = variant === "fab" ? 0.98 : 0.9;
  const ringOpacity = variant === "avatar" ? 0.42 : 0.55;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#e8fffb" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#7bfff0" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#008a94" stopOpacity="0.18" />
        </radialGradient>
        <linearGradient id={coreId} x1="20%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
          <stop offset="42%" stopColor="#b8fff2" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#00d6b4" stopOpacity="0.82" />
        </linearGradient>
      </defs>

      <circle cx="12" cy="12" r="10" fill={`url(#${glowId})`} opacity="0.88" />
      <circle
        cx="12"
        cy="12"
        r="8.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity={ringOpacity * 0.65}
      />
      <ellipse
        cx="12"
        cy="12"
        rx="8.4"
        ry="3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.95"
        opacity={ringOpacity}
        transform="rotate(-24 12 12)"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="8.4"
        ry="3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.85"
        opacity={ringOpacity * 0.75}
        transform="rotate(52 12 12)"
      />
      <circle cx="12" cy="12" r="3.15" fill={`url(#${coreId})`} opacity={coreOpacity} />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" opacity="0.28" />
      <circle cx="18.1" cy="7.4" r="1.05" fill="currentColor" opacity="0.72" />
      <circle cx="5.6" cy="15.8" r="0.9" fill="currentColor" opacity="0.58" />
      <circle cx="16.4" cy="17.1" r="0.72" fill="currentColor" opacity="0.46" />
      <path
        d="M12 8.1v2.2M10.2 10.9h3.6"
        stroke="#ffffff"
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.82"
      />
    </svg>
  );
}