import React from "react";

/** Custom "Hari ini" icon — sun pulse over horizon, matches hero cyan palette */
export function TodayPulseIcon({ size = 14, className = "" }) {
  const gradId = React.useId().replace(/:/g, "");

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
        <linearGradient id={`todayGrad-${gradId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path
        d="M3 17.5h18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M12 6.2a5.3 5.3 0 0 1 0 10.6"
        fill="none"
        stroke={`url(#todayGrad-${gradId})`}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="11.5" r="2.35" fill="currentColor" opacity="0.92" />
      <path
        d="M12 3.2v1.6M12 18.2v1.6M5.4 8.1l1.1 1.1M17.5 8.1l-1.1 1.1M4.2 11.5h1.6M18.2 11.5h1.6"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M7.2 19.8c1.4.9 3 1.4 4.8 1.4s3.4-.5 4.8-1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.38"
      />
    </svg>
  );
}