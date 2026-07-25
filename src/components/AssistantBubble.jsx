import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X } from "lucide-react";
import {
  ASSISTANT_QA,
  getContextualStarters,
  getFollowUps,
} from "../data/assistantQA";
import { getRouteContext } from "../lib/assistantContext";
import { answerQuery } from "../lib/assistantMatcher";
import { warn } from "../lib/log";
import AssistantMark from "./AssistantMark";
import { OVERLAY_TIMING } from "../lib/overlayScheduler";
import { useAdaptiveMotion } from "../hooks/useAdaptiveMotion";

const TOOLTIP_AUTO_HIDE_MS = 10_000;
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ROUTES_HIDDEN = ["/checkout", "/bayar", "/admin"];

function shouldHide(pathname) {
  return ROUTES_HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function findItem(id) {
  return ASSISTANT_QA.find((q) => q.id === id);
}

function getGreeting(pathname) {
  const route = getRouteContext(pathname);
  if (route) {
    return `Hai 👋 Aku **Imzaqi AI**. Kamu lagi di halaman **${route.label}** - ${route.tip} Pilih topik atau ketik langsung.`;
  }
  return "Hai 👋 Aku **Imzaqi AI**, asisten pintar toko ini. Pilih topik di bawah atau ketik pertanyaanmu - aku pahami konteks halaman & obrolan sebelumnya.";
}

function getTooltipText(pathname) {
  const route = getRouteContext(pathname);
  if (route) {
    return `Butuh bantuan di halaman ${route.label}? Tanya Imzaqi AI`;
  }
  return "Butuh bantuan? Tanya Imzaqi AI";
}

function hasAssistantOpened() {
  try {
    return localStorage.getItem("imzaqi_assistant_opened") === "true";
  } catch {
    return false;
  }
}

function isTooltipDismissed() {
  try {
    return localStorage.getItem("imzaqi_assistant_tooltip_dismissed") === "true";
  } catch {
    return false;
  }
}

/** Renders a paragraph with simple bold (**text**), code (`text`), and (url) links */
function FormattedLine({ text }) {
  if (typeof text !== "string") return null;
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\(https?:\/\/[^)]+\))/g);
  return (
    <p className="ai-bubbleText">
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i}>{part.slice(1, -1)}</code>;
        }
        if (part.startsWith("(http") && part.endsWith(")")) {
          const url = part.slice(1, -1);
          return (
            <a key={i} className="ai-bubbleLink" href={url} target="_blank" rel="noreferrer">
              chat sekarang
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function tooltipKeyHandlers(handleOpen) {
  return {
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleOpen();
      }
    },
  };
}

function AssistantPanelBody({
  panelRef,
  inputRef,
  scrollRef,
  greeting,
  history,
  typing,
  draft,
  setDraft,
  setOpen,
  suggestions,
  reset,
  ask,
  askCustom,
}) {
  return (
    <>
      <div className="ai-panelAmbient" aria-hidden="true">
        <div className="ai-panelOrb ai-panelOrb--1" />
        <div className="ai-panelOrb ai-panelOrb--2" />
        <div className="ai-panelGrid" />
      </div>
      <header className="ai-head ai-head--premium">
        <div className="ai-headIcon" aria-hidden="true">
          <AssistantMark size={18} className="ai-markHead" variant="header" />
        </div>
        <div className="ai-headCopy">
          <div className="ai-headTitleRow">
            <strong>Imzaqi AI</strong>
            <span className="ai-statusBadge">
              <span className="ai-statusDot" />
              Online
            </span>
          </div>
          <span>Paham konteks halaman & obrolan</span>
        </div>
        <button
          type="button"
          className="ai-headClose"
          onClick={() => setOpen(false)}
          aria-label="Tutup"
        >
          <X size={16} />
        </button>
      </header>

      <div className="ai-scroll" ref={scrollRef}>
        <div className="ai-msg ai-msg--assistant">
          <div className="ai-avatar" aria-hidden="true">
            <AssistantMark size={14} className="ai-markAvatar" variant="avatar" />
          </div>
          <div className="ai-bubbleMsg ai-bubbleMsg--glass">
            <FormattedLine text={greeting} />
          </div>
        </div>

        {history.map((item, idx) => (
          <React.Fragment key={`h-${idx}-${item.id}`}>
            <div className="ai-msg ai-msg--user">
              <div className="ai-bubbleMsg">
                <p className="ai-bubbleText">{item.q}</p>
              </div>
            </div>
            <div className="ai-msg ai-msg--assistant">
              <div className="ai-avatar" aria-hidden="true">
                <AssistantMark size={14} className="ai-markAvatar" variant="avatar" />
              </div>
              <div className="ai-bubbleMsg ai-bubbleMsg--glass">
                {(idx === history.length - 1 && (typing || item._pending)) || (item._pending && !item.a.length) ? (
                  <div className="ai-typing">
                    <span /><span /><span />
                  </div>
                ) : (
                  item.a.map((line, li) => <FormattedLine key={li} text={line} />)
                )}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="ai-suggest">
        {history.length > 0 && (
          <div className="ai-suggestHead" style={{ justifyContent: "flex-end", paddingBottom: "4px" }}>
            <button type="button" className="ai-resetBtn" onClick={reset}>
              Mulai ulang
            </button>
          </div>
        )}

        {!typing && suggestions.length > 0 ? (
          <div className="ai-suggestList">
            {suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                className="ai-chip"
                onClick={() => ask(item.id)}
                disabled={typing}
              >
                {item.q}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="ai-inputBar"
          onSubmit={(e) => {
            e.preventDefault();
            askCustom();
          }}
        >
          <input
            ref={inputRef}
            className="ai-input"
            type="text"
            placeholder="Tanya apa saja…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={300}
            disabled={typing}
            aria-label="Pertanyaan kamu"
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="ai-sendBtn"
            disabled={!draft.trim() || typing}
            aria-label="Kirim"
          >
            <Send size={15} strokeWidth={2.4} />
          </button>
        </form>
      </div>
    </>
  );
}

export default function AssistantBubble() {
  const location = useLocation();
  const motionMode = useAdaptiveMotion();
  const motionFull = motionMode === "full";
  const hidden = shouldHide(location.pathname);

  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);
  const [fabOpened, setFabOpened] = useState(hasAssistantOpened);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const greeting = useMemo(
    () => getGreeting(location.pathname),
    [location.pathname]
  );

  const tooltipText = useMemo(
    () => getTooltipText(location.pathname),
    [location.pathname]
  );

  function dismissTooltip(persist = true) {
    setShowTooltip(false);
    if (persist) {
      try {
        localStorage.setItem("imzaqi_assistant_tooltip_dismissed", "true");
      } catch {
        // Ignore write restriction
      }
    }
  }

  useEffect(() => {
    if (hidden) return undefined;
    if (hasAssistantOpened() || isTooltipDismissed()) return undefined;

    let shown = false;
    let scrolledEnough = typeof window !== "undefined" && window.scrollY >= OVERLAY_TIMING.assistantMinScrollY;
    let elapsed = false;

    function maybeShow() {
      if (!shown && scrolledEnough && elapsed) {
        shown = true;
        setShowTooltip(true);
      }
    }

    const elapsedTimer = window.setTimeout(() => {
      elapsed = true;
      maybeShow();
    }, OVERLAY_TIMING.assistantMs);

    const onScroll = () => {
      if (window.scrollY >= OVERLAY_TIMING.assistantMinScrollY) {
        scrolledEnough = true;
        maybeShow();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    maybeShow();

    return () => {
      window.clearTimeout(elapsedTimer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [hidden]);

  useEffect(() => {
    if (!showTooltip || open) return undefined;
    const autoHideTimer = window.setTimeout(() => dismissTooltip(false), TOOLTIP_AUTO_HIDE_MS);
    return () => window.clearTimeout(autoHideTimer);
  }, [showTooltip, open, location.pathname]);

  function handleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) {
        dismissTooltip(false);
        setFabOpened(true);
        try {
          localStorage.setItem("imzaqi_assistant_opened", "true");
        } catch {
          // Ignore write restriction
        }
      }
      return next;
    });
  }

  useEffect(() => {
    if (!open) return undefined;
    // BUG-05: 80ms terlalu singkat di iOS saat panel masih animasi.
    // Naikkan ke 320ms agar panel selesai render sebelum focus dipanggil.
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 320);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  // BUG-08: Lock body scroll saat panel terbuka di iOS
  // iOS Safari tidak menghormati overflow:hidden pada body untuk momentum scroll,
  // tapi position:fixed + inset:0 pada overlay sudah cukup di sebagian besar kasus.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }

      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const lastItem = history.length ? history[history.length - 1] : null;
  const suggestions = useMemo(() => {
    if (!history.length) return getContextualStarters(location.pathname, history);
    return getFollowUps(lastItem, history);
  }, [history, lastItem, location.pathname]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [history, typing]);

  function ask(id) {
    const item = findItem(id);
    if (!item) return;
    setHistory((prev) => [...prev, item]);
    setTyping(true);
    const t = window.setTimeout(() => setTyping(false), 600 + Math.random() * 400);
    // cleanup handled via component unmount - acceptable for short-lived timers
    return () => window.clearTimeout(t);
  }

  async function askCustom(rawText) {
    const text = String(rawText || draft).trim();
    if (!text) return;
    let mounted = true;
    const userTurn = { id: `u-${Date.now()}`, q: text, a: [], tags: [], _pending: true };
    setHistory((prev) => [...prev, userTurn]);
    setDraft("");
    setTyping(true);

    try {
      const reply = await answerQuery(text, history, { pathname: location.pathname });
      if (!mounted) return;
      setHistory((prev) => {
        const next = [...prev];
        const idx = next.findIndex((h) => h.id === userTurn.id);
        if (idx >= 0) next[idx] = { ...reply, q: text };
        return next;
      });
    } catch (e) {
      warn("Assistant error:", e);
      if (!mounted) return;
      setHistory((prev) => {
        const next = [...prev];
        const idx = next.findIndex((h) => h.id === userTurn.id);
        if (idx >= 0) {
          next[idx] = {
            id: `ai-error-${Date.now()}`,
            q: text,
            a: [
              "Maaf, ada gangguan saat memproses 🙏",
              "Coba ulang atau langsung chat admin di **WA: 0831-3604-9987** (https://wa.me/6283136049987).",
            ],
            tags: [],
          };
        }
        return next;
      });
    } finally {
      if (mounted) {
        window.setTimeout(() => setTyping(false), 200);
      }
    }

    return () => { mounted = false; };
  }

  function reset() {
    setHistory([]);
    setTyping(false);
    setDraft("");
  }

  if (hidden || typeof document === "undefined") return null;

  const bubbleClassName = `ai-bubble ${open ? "is-open" : ""} ${showTooltip && !open ? "ai-bubble--pulse" : ""}${
    !motionFull && motionMode === "lite" ? " ai-bubble--cssEnter" : ""
  }`;

  const tooltipInner = (
    <>
      <div className="ai-tooltipContent">
        <AssistantMark size={16} className="ai-tooltipMark" />
        <span className="ai-tooltipText">{tooltipText}</span>
        <button
          type="button"
          className="ai-tooltipDismiss"
          aria-label="Tutup tips"
          onClick={(e) => {
            e.stopPropagation();
            dismissTooltip(true);
          }}
        >
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>
      <div className="ai-tooltipArrow" />
    </>
  );

  const bubbleIcon = (
    <>
      <span className="ai-bubbleHalo" aria-hidden="true" />
      <span className="ai-bubbleIcon">
        {open ? (
          <X size={20} strokeWidth={2.4} />
        ) : (
          <AssistantMark size={24} className="ai-markFab" variant="fab" />
        )}
      </span>
      {!open && !fabOpened ? <span className="ai-bubbleDot" aria-hidden="true" /> : null}
    </>
  );

  const panelProps = {
    panelRef,
    inputRef,
    scrollRef,
    greeting,
    history,
    typing,
    draft,
    setDraft,
    setOpen,
    suggestions,
    reset,
    ask,
    askCustom,
  };

  return createPortal(
    <>
      {motionFull ? (
        <AnimatePresence>
          {showTooltip && !open ? (
            <motion.div
              className="ai-tooltip"
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.94 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={handleOpen}
              role="button"
              tabIndex={0}
              aria-label={tooltipText}
              {...tooltipKeyHandlers(handleOpen)}
            >
              {tooltipInner}
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : showTooltip && !open ? (
        <div
          className={`ai-tooltip${motionMode === "lite" ? " ai-tooltip--cssEnter" : ""}`}
          onClick={handleOpen}
          role="button"
          tabIndex={0}
          aria-label={tooltipText}
          {...tooltipKeyHandlers(handleOpen)}
        >
          {tooltipInner}
        </div>
      ) : null}

      {motionFull ? (
        <motion.button
          type="button"
          className={bubbleClassName}
          onClick={handleOpen}
          aria-label={open ? "Tutup Imzaqi AI" : "Buka Imzaqi AI"}
          initial={{ opacity: 0, y: 16, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
        >
          {bubbleIcon}
        </motion.button>
      ) : (
        <button
          type="button"
          className={bubbleClassName}
          onClick={handleOpen}
          aria-label={open ? "Tutup Imzaqi AI" : "Buka Imzaqi AI"}
        >
          {bubbleIcon}
        </button>
      )}

      {motionFull ? (
        <AnimatePresence>
          {open ? (
            <>
              <motion.div
                className="ai-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24 }}
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
              <motion.aside
                ref={panelRef}
                className="ai-panel ai-panel--glass"
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.97 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                role="dialog"
                aria-modal="true"
                aria-label="Imzaqi AI"
              >
                <AssistantPanelBody {...panelProps} />
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>
      ) : open ? (
        <>
          <div
            className={`ai-backdrop${motionMode === "lite" ? " ai-backdrop--cssEnter" : ""}`}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside
            ref={panelRef}
            className={`ai-panel ai-panel--glass${motionMode === "lite" ? " ai-panel--cssEnter" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Imzaqi AI"
          >
            <AssistantPanelBody {...panelProps} />
          </aside>
        </>
      ) : null}
    </>,
    document.body
  );
}