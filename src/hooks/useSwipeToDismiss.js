import { useCallback, useRef } from "react";

/**
 * Adds downward touch-drag dismissal on sheet headers/handles without hijacking body scroll.
 */
export function useSwipeToDismiss({ containerRef, onClose, threshold = 72, velocityThreshold = 0.45, disabled = false }) {
  const dragStateRef = useRef({ active: false, startY: 0, lastY: 0, startTime: 0, deltaY: 0 });

  const resetStyles = useCallback(
    (animate = true) => {
      const el = containerRef?.current;
      if (!el) return;
      if (animate) {
        el.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
        window.setTimeout(() => {
          if (containerRef?.current) {
            containerRef.current.style.transition = "";
          }
        }, 230);
      } else {
        el.style.transition = "";
        el.style.transform = "";
      }
    },
    [containerRef]
  );

  const onTouchStart = useCallback(
    (event) => {
      if (disabled || !event.touches?.length) return;
      if (event.target?.closest?.("button, a, input, select, textarea")) return;
      const touch = event.touches[0];
      dragStateRef.current = {
        active: true,
        startY: touch.clientY,
        lastY: touch.clientY,
        startTime: Date.now(),
        deltaY: 0,
      };
      const el = containerRef?.current;
      if (el) el.style.transition = "none";
    },
    [containerRef, disabled]
  );

  const onTouchMove = useCallback(
    (event) => {
      const state = dragStateRef.current;
      if (!state.active || disabled || !event.touches?.length) return;
      const touch = event.touches[0];
      const deltaY = Math.max(0, touch.clientY - state.startY);
      state.lastY = touch.clientY;
      state.deltaY = deltaY;
      const el = containerRef?.current;
      if (el && deltaY > 0) {
        el.style.transform = `translate3d(0, ${deltaY}px, 0)`;
      }
    },
    [containerRef, disabled]
  );

  const endDrag = useCallback(() => {
    const state = dragStateRef.current;
    if (!state.active) return;
    state.active = false;
    const elapsed = Math.max(1, Date.now() - state.startTime);
    const velocity = state.deltaY / elapsed;

    if (state.deltaY >= threshold || (state.deltaY > 24 && velocity >= velocityThreshold)) {
      resetStyles(false);
      onClose?.();
    } else {
      resetStyles(true);
    }
  }, [onClose, resetStyles, threshold, velocityThreshold]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd: endDrag,
    onTouchCancel: endDrag,
  };
}
