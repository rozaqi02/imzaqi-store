import { useMemo, useState } from "react";
import { UserRound, Users } from "lucide-react";

const TYPE_META = {
  sharing: {
    label: "Sharing",
    icon: Users,
    color: "var(--text)",
    tip: "Akun Sharing: Dipakai bersama pembeli lain (1 profil khusus untukmu). Sangat hemat, dilarang ubah password atau email akun.",
  },
  private: {
    label: "Private",
    icon: UserRound,
    color: "var(--accent)",
    tip: "Akun Private: 1 akun utuh milikmu sendiri. Bebas atur profil, PIN, dan bebas dipakai tanpa khawatir tertabrak user lain.",
  },
  family: {
    label: "Family",
    icon: Users,
    color: "var(--text)",
    tip: "Slot Family: Akun di-invite ke grup family plan resmi. Menggunakan email pribadimu sendiri.",
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
  const [activeType, setActiveType] = useState(null);

  if (!types.length) return null;

  const tip = activeType
    ? TYPE_META[activeType]?.tip
    : types.length === 1
      ? TYPE_META[types[0]].tip
      : "Sharing lebih hemat budget, Private lebih aman & bebas. Ketuk tipe akun untuk baca detail aturan.";

  return (
    <div className="pdx-accountStrip" role="note" aria-label="Jenis akun tersedia">
      <div className="pdx-accountStrip-chips">
        {types.map((key) => {
          const meta = TYPE_META[key];
          const Icon = meta.icon;
          const isSelected = activeType === key;
          return (
            <button
              key={key}
              type="button"
              className={`pdx-accountStrip-chip${isSelected ? " is-active" : ""}`}
              style={{ "--chip-color": meta.color, cursor: "pointer" }}
              onClick={() => setActiveType((prev) => (prev === key ? null : key))}
              aria-pressed={isSelected}
              title={`Pelajari tipe ${meta.label}`}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>
      <p className="pdx-accountStrip-tip">{tip}</p>
    </div>
  );
}