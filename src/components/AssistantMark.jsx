import React from "react";

/**
 * Imzaqi AI mark v5 — clean, solid, and modern AI Spark (4-pointed star) icon.
 */
export default function AssistantMark({ size = 24, className = "", variant = "default" }) {
  const gradId = React.useId().replace(/:/g, "");
  const glowId = `aiGlow-${gradId}`;

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
        <linearGradient id={glowId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7efff0" />
          <stop offset="50%" stopColor="#00d6b4" />
          <stop offset="100%" stopColor="#008a94" />
        </linearGradient>
      </defs>

      {/* Modern Glowing Background circle */}
      <circle cx="12" cy="12" r="11" fill={`url(#${glowId})`} />

      {/* Elegant, clean 4-pointed AI Spark */}
      <path
        d="M12 5C12 8.87 8.87 12 5 12C8.87 12 12 15.13 12 19C12 15.13 15.13 12 19 12C15.13 12 12 8.87 12 5Z"
        fill="#ffffff"
      />
    </svg>
  );
}