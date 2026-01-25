import React from "react";

const ITEMS = [
  { name: "Netflix", src: "https://logo.clearbit.com/netflix.com" },
  { name: "Disney+ Hotstar", src: "https://logo.clearbit.com/hotstar.com" },
  { name: "YouTube", src: "https://logo.clearbit.com/youtube.com" },
  { name: "Canva", src: "https://logo.clearbit.com/canva.com" },
  { name: "Spotify", src: "https://logo.clearbit.com/spotify.com" },
  { name: "Prime Video", src: "https://logo.clearbit.com/primevideo.com" },
];

export default function LogoCloud() {
  return (
    <div className="logo-cloud" aria-hidden="true">
      {ITEMS.map((x, i) => (
        <div
          key={x.name}
          className="logo-float"
          style={{
            animationDelay: `${i * 0.18}s`,
            transform: `translate(${(i % 3) * 44}px, ${Math.floor(i / 3) * 34}px)`,
          }}
        >
          <img
            src={x.src}
            alt=""
            loading="lazy"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </div>
      ))}
    </div>
  );
}
