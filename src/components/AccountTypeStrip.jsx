import { useMemo } from "react";
import { UserRound, Users } from "lucide-react";

const TYPE_META = {
  sharing: {
    label: "Sharing",
    icon: Users,
    color: "#5b8def",
    tip: "Akun dipakai bersama - jangan ubah password, email, atau profil.",
  },
  private: {
    label: "Private",
    icon: UserRound,
    color: "#00d6b4",
    tip: "Akun khusus kamu - lebih aman dengan garansi penuh.",
  },
  family: {
    label: "Family",
    icon: Users,
    color: "#a855f7",
    tip: "Slot family/invite - ikuti aturan paket saat checkout.",
  },
};

function detectTypes(variants) {
  const found = new Set();
  (variants || []).forEach((variant) => {
    const name = String(variant?.name || "").toLowerCase();
    if (/sharing|share/.test(name)) found.add("sharing");
    if (/private|privat/.test(name)) found.add("private");
    if (/fam|family/.test(name)) found.add("family");
  });
  return ["sharing", "private", "family"].filter((key) => found.has(key));
}

export default function AccountTypeStrip({ variants = [] }) {
  const types = useMemo(() => detectTypes(variants), [variants]);

  if (!types.length) return null;

  const tip =
    types.length === 1
      ? TYPE_META[types[0]].tip
      : "Sharing lebih hemat, Private lebih aman - pilih sesuai kebutuhanmu.";

  return (
    <div className="pdx-accountStrip" role="note" aria-label="Jenis akun tersedia">
      <div className="pdx-accountStrip-chips">
        {types.map((key) => {
          const meta = TYPE_META[key];
          const Icon = meta.icon;
          return (
            <span
              key={key}
              className="pdx-accountStrip-chip"
              style={{ "--chip-color": meta.color }}
            >
              <Icon size={14} aria-hidden="true" />
              {meta.label}
            </span>
          );
        })}
      </div>
      <p className="pdx-accountStrip-tip">{tip}</p>
    </div>
  );
}