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
import AssistantMark from "./AssistantMark";

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
    return `Hai 👋 Aku **Imzaqi AI**. Kamu lagi di halaman **${route.label}** — ${route.tip} Pilih topik atau ketik langsung.`;
  }
  return "Hai 👋 Aku **Imzaqi AI**, asisten pintar toko ini. Pilih topik di bawah atau ketik pertanyaanmu — aku pahami konteks halaman & obrolan sebelumnya.";
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

export default function AssistantBubble() {
  const location = useLocation();
  const hidden = shouldHide(location.pathname);

  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const greeting = useMemo(
    () => getGreeting(location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    if (hidden) return;
    try {
      const closedBefore = localStorage.getItem("imzaqi_assistant_opened") === "true";
      if (!closedBefore) {
        const timer = setTimeout(() => {
          setShowTooltip(true);
        }, 4000);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      // LocalStorage fallback for private browsers
    }
  }, [hidden]);

  function handleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) {
        setShowTooltip(false);
        try {
          localStorage.setItem("imzaqi_assistant_opened", "true");
        } catch (e) {
          // Ignore write restriction
        }
      }
      return next;
    });
  }

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
    window.setTimeout(() => setTyping(false), 600 + Math.random() * 400);
  }

  async function askCustom(rawText) {
    const text = String(rawText || draft).trim();
    if (!text) return;
    const userTurn = { id: `u-${Date.now()}`, q: text, a: [], tags: [], _pending: true };
    setHistory((prev) => [...prev, userTurn]);
    setDraft("");
    setTyping(true);

    try {
      const reply = await answerQuery(text, history, { pathname: location.pathname });
      setHistory((prev) => {
        const next = [...prev];
        const idx = next.findIndex((h) => h.id === userTurn.id);
        if (idx >= 0) next[idx] = { ...reply, q: text };
        return next;
      });
    } catch (e) {
      console.warn("Assistant error:", e);
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
      window.setTimeout(() => setTyping(false), 200);
    }
  }

  function reset() {
    setHistory([]);
    setTyping(false);
    setDraft("");
  }

  if (hidden || typeof document === "undefined") return null;

  return createPortal(
    <>
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
            aria-label="Tanya Imzaqi AI"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpen();
              }
            }}
          >
            <div className="ai-tooltipContent">
              <AssistantMark size={16} className="ai-tooltipMark" />
              <span>Butuh bantuan? Tanya Imzaqi AI</span>
            </div>
            <div className="ai-tooltipArrow" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        className={`ai-bubble ${open ? "is-open" : ""} ${showTooltip && !open ? "ai-bubble--pulse" : ""}`}
        onClick={handleOpen}
        aria-label={open ? "Tutup Imzaqi AI" : "Buka Imzaqi AI"}
        initial={{ opacity: 0, y: 16, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.6, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
      >
        <span className="ai-bubbleHalo" aria-hidden="true" />
        <span className="ai-bubbleIcon">
          {open ? (
            <X size={20} strokeWidth={2.4} />
          ) : (
            <AssistantMark size={24} className="ai-markFab" variant="fab" />
          )}
        </span>
        {!open ? <span className="ai-bubbleDot" aria-hidden="true" /> : null}
      </motion.button>

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
              className="ai-panel ai-panel--glass"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-label="Imzaqi AI"
            >
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
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>,
    document.body
  );
}