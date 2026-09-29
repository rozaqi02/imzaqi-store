import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { rafThrottle } from "../utils/throttle";

export default function MobileProductBar({ name, onBack }) {
  const barRef = useRef(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const sync = rafThrottle(() => {
      const bar = barRef.current;
      if (!bar || !bar.offsetHeight) {
        setStuck(false);
        return;
      }
      const stickyTop = parseFloat(getComputedStyle(bar).top);
      setStuck(window.scrollY > 0 && bar.getBoundingClientRect().top <= stickyTop + 0.5);
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

  return (
    <nav ref={barRef} className={`pdx-mobileProductBar${stuck ? " is-stuck" : ""}`} aria-label="Navigasi produk">
      <button type="button" className="pdx-mobileBack" onClick={onBack} aria-label="Kembali ke katalog">
        <ArrowLeft size={17} aria-hidden="true" />
      </button>
      <span className="pdx-mobileProductName" title={name}>{name}</span>
    </nav>
  );
}
