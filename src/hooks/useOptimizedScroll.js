import { useEffect, useRef } from "react";
import { rafThrottle } from "../utils/throttle";

export function useOptimizedScroll(callback, deps = []) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = rafThrottle((...args) => {
      savedCallback.current(...args);
    });

    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      handler.cancel();
      window.removeEventListener("scroll", handler);
    };
  }, deps);
}
