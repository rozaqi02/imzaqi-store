import { MessageCircle, QrCode, ShieldCheck, Timer } from "lucide-react";

const DEFAULT_ITEMS = [
  { icon: QrCode, label: "QRIS" },
  { icon: ShieldCheck, label: "Garansi replace" },
  { icon: Timer, label: "~5 menit" },
  { icon: MessageCircle, label: "Chat admin" },
];

export default function TrustStrip({ compact = false, className = "" }) {
  return (
    <div className={`trust-strip${compact ? " trust-strip--compact" : ""} ${className}`.trim()} role="note" aria-label="Jaminan layanan">
      {DEFAULT_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <span key={item.label} className="trust-strip-item">
            <Icon size={13} strokeWidth={2.2} aria-hidden="true" />
            <span>{item.label}</span>
          </span>
        );
      })}
    </div>
  );
}
