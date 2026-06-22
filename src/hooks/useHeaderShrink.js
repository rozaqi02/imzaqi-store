import { useEffect, useState } from "react";

const SHRINK_THRESHOLD = 80;

export function useHeaderShrink() {
  const [isShrunk, setIsShrunk] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let ticking = false;

    const sync = () => {
      ticking = false;
      const shrunk = window.scrollY > SHRINK_THRESHOLD;
      setIsShrunk(shrunk);
      document.body.classList.toggle("header-is-shrunk", shrunk);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(sync);
    };

    sync();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.body.classList.remove("header-is-shrunk");
      setIsShrunk(false);
    };
  }, []);

  return isShrunk;
}