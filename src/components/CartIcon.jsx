import React from "react";

/** Ikon keranjang tunggal untuk navbar dan seluruh langkah checkout. */
export default function CartIcon({ size = 18, className, strokeWidth = 2, ...props }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M6.5 6H21l-1.6 8.2a2 2 0 0 1-2 1.6H9.1a2 2 0 0 1-2-1.6L5.2 3.5H2.5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
    </svg>
  );
}
