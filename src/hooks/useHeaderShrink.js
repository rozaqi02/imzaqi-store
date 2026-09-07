import { useEffect } from "react";

export function useHeaderShrink() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.classList.add("header-is-shrunk");
    return () => {
      document.body.classList.remove("header-is-shrunk");
    };
  }, []);

  return true;
}