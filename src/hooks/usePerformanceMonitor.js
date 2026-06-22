import { useEffect, useRef } from "react";

export function usePerformanceMonitor(options = {}) {
  const {
    enabled = typeof process !== "undefined" && process.env.NODE_ENV === "development",
    warnThreshold = 50,
  } = options;

  const frameCountRef = useRef(0);
  const lastFpsCheckRef = useRef(performance.now());
  const fpsRef = useRef(60);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const id = setInterval(() => {
      const now = performance.now();
      const elapsed = (now - lastFpsCheckRef.current) / 1000;
      const fps = Math.round(frameCountRef.current / elapsed);
      fpsRef.current = fps;

      if (fps < 30 && elapsed > 0.5) {
        console.warn(`[Perf] Low FPS: ${fps} — consider reducing animations`);
      }

      frameCountRef.current = 0;
      lastFpsCheckRef.current = now;
    }, 2000);

    const frame = () => {
      frameCountRef.current++;
      rafId = requestAnimationFrame(frame);
    };

    let rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(id);
    };
  }, [enabled]);

  const measure = (label, fn) => {
    if (!enabled) return fn();

    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    if (duration > warnThreshold) {
      console.warn(`[Perf] ${label} took ${duration.toFixed(1)}ms`);
    } else if (duration > warnThreshold * 0.6) {
      console.info(`[Perf] ${label} took ${duration.toFixed(1)}ms`);
    }

    return result;
  };

  return { fps: fpsRef.current, measure, frameCount: frameCountRef.current };
}

export function useLongTaskMonitor() {
  useEffect(() => {
    if (typeof window === "undefined" || !PerformanceObserver) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            console.warn(`[Perf] Long task: ${entry.duration.toFixed(1)}ms`, entry.name || "");
          }
        }
      });

      observer.observe({ entryTypes: ["longtask"] });
      return () => observer.disconnect();
    } catch {
      // PerformanceObserver not supported or blocked
    }
  }, []);
}
