import { useState, useEffect } from "react";

// Returns a debounced value. On mobile/coarse-pointer devices, uses a longer
// delay to reduce re-renders and save battery.
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // On mobile/coarse-pointer, use at least 500ms to reduce re-renders
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia &&
      (window.matchMedia("(pointer: coarse)").matches ||
        window.matchMedia("(max-width: 720px)").matches);

    const effectiveDelay = isMobile ? Math.max(delay, 500) : delay;

    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, effectiveDelay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
