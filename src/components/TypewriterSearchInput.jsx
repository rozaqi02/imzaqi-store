import React, { useEffect, useState } from "react";

export const DEFAULT_SEARCH_PREFIX = "Ketik ";
export const DEFAULT_SEARCH_WORDS = ["Netflix", "Canva", "YouTube", "Spotify", "CapCut"];

const INITIAL_DELAY_MS = 320;
const TYPE_SPEED_MS = 72;
const ERASE_SPEED_MS = 38;
const HOLD_WORD_MS = 1450;
const PAUSE_BETWEEN_MS = 300;

function isMotionDisabled() {
  if (typeof window === "undefined") return false;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const motionAttr = typeof document !== "undefined" ? document.documentElement?.getAttribute("data-motion") : null;
  return Boolean(reduced || motionAttr === "off");
}

function useTypewriterPlaceholder({ prefix, words, paused }) {
  const firstWord = words?.[0] || "";
  const [motionOff, setMotionOff] = useState(isMotionDisabled);
  const [text, setText] = useState(() => (isMotionDisabled() ? `${prefix}${firstWord}` : prefix));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      const next = isMotionDisabled();
      setMotionOff((prev) => (prev === next ? prev : next));
    };
    syncMotion();

    mq?.addEventListener?.("change", syncMotion);

    let observer;
    if (typeof MutationObserver !== "undefined" && typeof document !== "undefined" && document.documentElement) {
      observer = new MutationObserver(syncMotion);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-motion"],
      });
    }

    return () => {
      mq?.removeEventListener?.("change", syncMotion);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!words || words.length === 0) {
      setText(prefix);
      return undefined;
    }

    if (motionOff || paused) {
      setText(`${prefix}${firstWord}`);
      return undefined;
    }

    let wordIdx = 0;
    let charIdx = 0;
    let deleting = false;
    let timer = null;
    let cancelled = false;

    setText(prefix);

    const scheduleNext = (delay) => {
      if (cancelled) return;
      timer = window.setTimeout(tick, delay);
    };

    const tick = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }

      const word = words[wordIdx] || "";
      if (deleting) {
        charIdx = Math.max(0, charIdx - 1);
        setText(`${prefix}${word.slice(0, charIdx)}`);
        if (charIdx === 0) {
          deleting = false;
          wordIdx = (wordIdx + 1) % words.length;
          scheduleNext(PAUSE_BETWEEN_MS);
        } else {
          scheduleNext(ERASE_SPEED_MS);
        }
      } else {
        charIdx = Math.min(word.length, charIdx + 1);
        setText(`${prefix}${word.slice(0, charIdx)}`);
        if (charIdx >= word.length) {
          deleting = true;
          scheduleNext(HOLD_WORD_MS);
        } else {
          scheduleNext(TYPE_SPEED_MS);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (cancelled || typeof document === "undefined") return;
      if (document.hidden) {
        if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
      } else if (timer === null) {
        scheduleNext(PAUSE_BETWEEN_MS);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleNext(INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [prefix, words, firstWord, motionOff, paused]);

  return text;
}

/**
 * Leaf search input with an isolated animated placeholder so typing ticks
 * never re-render parent catalog grids.
 */
const TypewriterSearchInput = React.forwardRef(function TypewriterSearchInput(
  {
    prefix = DEFAULT_SEARCH_PREFIX,
    words = DEFAULT_SEARCH_WORDS,
    pauseTyping = false,
    ...props
  },
  ref
) {
  const hasQuery = Boolean(String(props.value ?? "").trim());
  const placeholderText = useTypewriterPlaceholder({
    prefix,
    words,
    paused: Boolean(pauseTyping || hasQuery),
  });

  return <input ref={ref} placeholder={placeholderText} {...props} />;
});

export default TypewriterSearchInput;
