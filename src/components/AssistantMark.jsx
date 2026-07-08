import React from "react";

/**
 * Imzaqi AI mark — orbit spark symbol (not store logo, not letter "i").
 */
export default function AssistantMark({ size = 24, className = "", variant = "default" }) {
  const isFab = variant === "fab";
  const fillsFrame = variant === "header" || variant === "avatar" || variant === "fab";

  return (
    <svg
      viewBox="0 0 24 24"
      width={isFab || fillsFrame ? undefined : size}
      height={isFab || fillsFrame ? undefined : size}
      className={[
        "ai-mark",
        isFab ? "ai-mark--fab" : "",
        fillsFrame && !isFab ? "ai-mark--fill" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
      focusable="false"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="2.75" fill="currentColor" />
      <path
        d="M12 4.1V7.35M12 16.65v3.25M4.1 12H7.35M16.65 12h3.25"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7.05 7.05l2.15 2.15M14.8 14.8l2.15 2.15M16.95 7.05l-2.15 2.15M9.2 14.8l-2.15 2.15"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle
        cx="12"
        cy="12"
        r="7.15"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeOpacity="0.34"
      />
    </svg>
  );
}