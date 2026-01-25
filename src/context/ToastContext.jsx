import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/**
 * Lightweight toast system (no deps) for global UX feedback.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success("Ditambahkan ke keranjang");
 */

const ToastContext = createContext(null);

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function ToastIcon({ type }) {
  const t = type || "info";
  const icon =
    t === "success" ? "✅" : t === "error" ? "⚠️" : t === "loading" ? "⏳" : "💬";
  return (
    <span className="toast-icon" aria-hidden="true">
      {icon}
    </span>
  );
}

function ToastItem({ toast, onClose }) {
  const { id, type, title, message, actionLabel, onAction } = toast;
  return (
    <div className={`toast toast-${type || "info"}`} role="status" aria-live="polite">
      <ToastIcon type={type} />
      <div className="toast-body">
        {title ? <div className="toast-title">{title}</div> : null}
        <div className="toast-msg">{message}</div>
        {actionLabel && typeof onAction === "function" ? (
          <button
            className="toast-action"
            onClick={() => {
              try {
                onAction();
              } finally {
                onClose(id);
              }
            }}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>

      <button className="toast-close" onClick={() => onClose(id)} aria-label="Tutup">
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback((toast) => {
    const id = toast.id || uid();
    const duration = typeof toast.duration === "number" ? toast.duration : 3200;
    const next = { id, type: "info", ...toast };

    setToasts((prev) => {
      // keep it tidy: max 3 toasts
      const trimmed = prev.slice(-2);
      return [...trimmed, next];
    });

    if (duration > 0 && next.type !== "loading") {
      const t = setTimeout(() => remove(id), duration);
      timers.current.set(id, t);
    }
    return id;
  }, [remove]);

  const api = useMemo(
    () => ({
      push,
      remove,
      info(message, opts = {}) {
        return push({ type: "info", message, ...opts });
      },
      success(message, opts = {}) {
        return push({ type: "success", message, ...opts });
      },
      error(message, opts = {}) {
        return push({ type: "error", message, ...opts, duration: opts.duration ?? 4800 });
      },
      loading(message, opts = {}) {
        return push({ type: "loading", message, duration: 0, ...opts });
      },
    }),
    [push, remove]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== "undefined"
        ? createPortal(
            <div className="toast-viewport" aria-label="Notifikasi">
              {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} onClose={remove} />
              ))}
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
