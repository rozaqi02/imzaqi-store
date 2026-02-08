import React from "react";

/**
 * Floating 3D icon cloud for Hero background.
 *
 * - Taruh icon di /public/icons
 * - Sesuaikan nama file pada `src`.
 */

const ICONS = [
  { src: "/bnetflix.png", x: "14%", y: "24%", size: "clamp(50px, 5.2vw, 74px)", z: "78px", r: "-10deg", dur: "9.8s", delay: "-1.2s", opacity: ".92" },
  { src: "/cbanva.png", x: "82%", y: "20%", size: "clamp(46px, 4.8vw, 70px)", z: "62px", r: "8deg", dur: "10.6s", delay: "-5.4s", opacity: ".86" },
  { src: "/chbatgpt.png", x: "90%", y: "60%", size: "clamp(44px, 4.6vw, 68px)", z: "72px", r: "14deg", dur: "9.3s", delay: "-2.4s", opacity: ".82" },
  { src: "/capbcut.png", x: "10%", y: "72%", size: "clamp(42px, 4.4vw, 66px)", z: "70px", r: "-14deg", dur: "10.1s", delay: "-7.2s", opacity: ".84" },
  { src: "/duolbingo.png", x: "24%", y: "54%", size: "clamp(40px, 4.2vw, 64px)", z: "54px", r: "6deg", dur: "8.8s", delay: "-3.8s", opacity: ".78" },
  { src: "/vviu.png", x: "74%", y: "74%", size: "clamp(40px, 4.2vw, 64px)", z: "56px", r: "-6deg", dur: "11.2s", delay: "-4.2s", opacity: ".78" },
];

export default function LogoCloud() {
  return (
    <div className="hero-3d-stage" aria-hidden="true">
      {ICONS.map((it, i) => (
        <div
          key={i}
          className="hero-3d-icon"
          style={{
            "--x": it.x,
            "--y": it.y,
            "--size": it.size,
            "--z": it.z,
            "--r": it.r,
            "--dur": it.dur,
            "--delay": it.delay,
            "--opacity": it.opacity,
          }}
        >
          <div className="hero-3d-icon-inner">
            <img src={it.src} alt="" loading="lazy" draggable="false" />
            <span className="hero-3d-glare" />
          </div>
        </div>
      ))}
    </div>
  );
}
