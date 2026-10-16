import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";
import { rafThrottle } from "../utils/throttle";

export default function MobileProductBar({ name, icon, onBack }) {
  const [active, setActive] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [icon]);

  useEffect(() => {
    const sync = rafThrottle(() => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const billboard = document.querySelector(".pdx-billboard");
      let shouldShow = false;
      if (billboard) {
        const rect = billboard.getBoundingClientRect();
        // Reveal when the billboard is scrolled mostly out of view
        shouldShow = rect.bottom < 120 || scrollY > 160;
      } else {
        shouldShow = scrollY > 80;
      }
      setActive((prev) => (prev === shouldShow ? prev : shouldShow));
    });

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    const header = document.querySelector(".header");
    if (header) observer?.observe(header);

    return () => {
      sync.cancel();
      observer?.disconnect();
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  const barContent = (
    <nav
      className={`pdx-mobileProductBar${active ? " is-scrolled is-stuck" : ""}`}
      aria-label="Navigasi produk"
      aria-hidden={!active}
    >
      <button
        type="button"
        className="pdx-mobileBack"
        onClick={onBack}
        aria-label="Kembali ke katalog"
      >
        <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <div className="pdx-mobileProductInfo">
        {icon && !imgFailed ? (
          <img
            className="pdx-mobileProductIcon"
            src={icon}
            alt=""
            aria-hidden="true"
            onError={() => setImgFailed(true)}
          />
        ) : null}
        <span className="pdx-mobileProductName" title={name}>
          {name}
        </span>
      </div>
      <div className="pdx-mobileBarSpacer" aria-hidden="true" />
    </nav>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(barContent, document.body);
  }

  return barContent;
}

