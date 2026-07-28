import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Lightweight fixed-estimate virtual list (no extra deps).
 * Good enough for admin order rows (~80–100px).
 */
export default function VirtualList({
  items,
  estimateHeight = 92,
  overscan = 8,
  className = "",
  style,
  getKey,
  renderItem,
  empty = null,
}) {
  const scrollerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(480);

  const count = items?.length || 0;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;

    const measure = () => {
      setViewportH(el.clientHeight || 480);
    };
    measure();

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    } else {
      window.addEventListener("resize", measure);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", measure);
    };
  }, []);

  const onScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const { start, end, offsetY, totalH } = useMemo(() => {
    if (count === 0) {
      return { start: 0, end: 0, offsetY: 0, totalH: 0 };
    }
    const startIdx = Math.max(0, Math.floor(scrollTop / estimateHeight) - overscan);
    const visible = Math.ceil(viewportH / estimateHeight) + overscan * 2;
    const endIdx = Math.min(count, startIdx + visible);
    return {
      start: startIdx,
      end: endIdx,
      offsetY: startIdx * estimateHeight,
      totalH: count * estimateHeight,
    };
  }, [count, estimateHeight, overscan, scrollTop, viewportH]);

  if (!count) return empty;

  const slice = items.slice(start, end);

  return (
    <div
      ref={scrollerRef}
      className={className}
      style={{
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        ...style,
      }}
      onScroll={onScroll}
    >
      <div style={{ height: totalH, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${offsetY}px)` }}>
          {slice.map((item, i) => {
            const index = start + i;
            const key = getKey ? getKey(item, index) : item?.id ?? index;
            return (
              <div key={key} style={{ minHeight: estimateHeight }}>
                {renderItem(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
