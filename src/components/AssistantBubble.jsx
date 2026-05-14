import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { ASSISTANT_QA, ASSISTANT_STARTERS, getFollowUps } from "../data/assistantQA";
import { answerQuery } from "../lib/assistantMatcher";

const ROUTES_HIDDEN = ["/checkout", "/bayar", "/admin"];

function shouldHide(pathname) {
  return ROUTES_HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function findItem(id) {
  return ASSISTANT_QA.find((q) => q.id === id);
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
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const lastItem = history.length ? history[history.length - 1] : null;
  const suggestions = useMemo(() => {
    if (!history.length) return ASSISTANT_STARTERS;
    return getFollowUps(lastItem, history);
  }, [history, lastItem]);

  // Auto-scroll to bottom on new messages
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
    // Push placeholder so user message appears immediately
    const userTurn = { id: `u-${Date.now()}`, q: text, a: [], tags: [], _pending: true };
    setHistory((prev) => [...prev, userTurn]);
    setDraft("");
    setTyping(true);

    try {
      const reply = await answerQuery(text, history);
      // Replace placeholder with full Q&A
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
      // Small extra typing delay for natural feel
      window.setTimeout(() => setTyping(false), 200);
    }
  }

  function reset() {
    setHistory([]);
    setTyping(false);
    setDraft("");
  }

  // Focus the input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 280);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open]);

  if (hidden || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Bubble button */}
      <motion.button
        type="button"
        className={`ai-bubble ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Tutup asisten" : "Buka asisten"}
        initial={{ opacity: 0, y: 16, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.6, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
      >
        <span className="ai-bubbleHalo" aria-hidden="true" />
        <span className="ai-bubbleIcon">
          {open ? <X size={20} strokeWidth={2.4} /> : <MessageCircle size={22} strokeWidth={2.2} />}
        </span>
        {!open ? <span className="ai-bubbleDot" aria-hidden="true" /> : null}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open ? (
          <motion.aside
            className="ai-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label="Asisten Imzaqi"
          >
            {/* Header */}
            <header className="ai-head">
              <div className="ai-headIcon" aria-hidden="true">
                <Sparkles size={16} />
              </div>
              <div className="ai-headCopy">
                <strong>Imzaqi Assistant</strong>
                <span>Selalu siap bantu — gratis 24/7</span>
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

            {/* Conversation */}
            <div className="ai-scroll" ref={scrollRef}>
              {/* Greeting */}
              <div className="ai-msg ai-msg--assistant">
                <div className="ai-avatar" aria-hidden="true">
                  <Sparkles size={13} />
                </div>
                <div className="ai-bubbleMsg">
                  <p className="ai-bubbleText">
                    Hai 👋 Aku asisten Imzaqi. Kamu bisa pilih topik di bawah, atau ketik pertanyaan langsung — aku coba bantu.
                  </p>
                </div>
              </div>

              {/* History */}
              {history.map((item, idx) => (
                <React.Fragment key={`h-${idx}-${item.id}`}>
                  <div className="ai-msg ai-msg--user">
                    <div className="ai-bubbleMsg">
                      <p className="ai-bubbleText">{item.q}</p>
                    </div>
                  </div>
                  <div className="ai-msg ai-msg--assistant">
                    <div className="ai-avatar" aria-hidden="true">
                      <Sparkles size={13} />
                    </div>
                    <div className="ai-bubbleMsg">
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

            {/* Suggestions chips */}
            <div className="ai-suggest" role="list" aria-label="Pertanyaan yang sering ditanya">
              {history.length > 0 ? (
                <div className="ai-suggestHead">
                  <span>Lanjutkan dengan:</span>
                  <button type="button" className="ai-resetBtn" onClick={reset}>
                    Mulai ulang
                  </button>
                </div>
              ) : (
                <div className="ai-suggestHead">
                  <span>Pilih topik atau ketik:</span>
                </div>
              )}
              <div className="ai-suggestList">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="listitem"
                    className="ai-chip"
                    onClick={() => ask(s.id)}
                  >
                    {s.q}
                  </button>
                ))}
              </div>

              {/* Manual input */}
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
                  placeholder="Ketik pertanyaanmu…"
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
        ) : null}
      </AnimatePresence>
    </>,
    document.body
  );
}
