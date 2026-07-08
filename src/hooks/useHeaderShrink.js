import { useEffect, useState } from "react";

const SHRINK_THRESHOLD = 80;
const DESKTOP_SHRINK_MEDIA = "(min-width: 721px)";

export function useHeaderShrink() {
  const [isShrunk, setIsShrunk] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const desktopMq = window.matchMedia(DESKTOP_SHRINK_MEDIA);
    let ticking = false;

    const sync = () => {
      ticking = false;

      if (!desktopMq.matches) {
        setIsShrunk(false);
        document.body.classList.remove("header-is-shrunk");
        return;
      }

      const shrunk = window.scrollY > SHRINK_THRESHOLD;
      setIsShrunk(shrunk);
      document.body.classList.toggle("header-is-shrunk", shrunk);
    };

    const onScroll = () => {
      if (!desktopMq.matches) return;
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(sync);
    };

    const onDesktopChange = () => sync();

    sync();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (typeof desktopMq.addEventListener === "function") {
      desktopMq.addEventListener("change", onDesktopChange);
    } else {
      desktopMq.addListener(onDesktopChange);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);

      if (typeof desktopMq.removeEventListener === "function") {
        desktopMq.removeEventListener("change", onDesktopChange);
      } else {
        desktopMq.removeListener(onDesktopChange);
      }

      document.body.classList.remove("header-is-shrunk");
      setIsShrunk(false);
    };
  }, []);

  return isShrunk;
}