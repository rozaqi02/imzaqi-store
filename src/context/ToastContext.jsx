import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleCheckBig, LoaderCircle, MessageCircleMore, X } from "lucide-react";

const ToastContext = createContext(null);

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function ToastIcon({ type }) {
  if (type === "success") {
    return (
      <span className="toast-icon toast-icon-success" aria-hidden="true">
        <CircleCheckBig size={18} strokeWidth={2.1} />
      </span>
    );
  }

  if (type === "error") {
    return (
      <span className="toast-icon toast-icon-error" aria-hidden="true">
        <CircleAlert size={18} strokeWidth={2.1} />
      </span>
    );
  }

  if (type === "loading") {
    return (
      <span className="toast-icon toast-icon-loading" aria-hidden="true">
        <LoaderCircle size={18} strokeWidth={2.1} />
      </span>
    );
  }

  return (
    <span className="toast-icon toast-icon-info" aria-hidden="true">
      <MessageCircleMore size={18} strokeWidth={2.1} />
    </span>
  );
}

function ToastItem({ toast, onClose }) {
  const { id, type, title, message, actionLabel, onAction, duration } = toast;
  const showProgress = duration > 0 && type !== "loading";

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
        <X size={15} strokeWidth={2.4} />
      </button>

      {showProgress ? (
        <div className="toast-progress" aria-hidden="true">
          <span style={{ animationDuration: `${duration}ms` }} />
        </div>
      ) : null}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);

    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast) => {
      const id = toast.id || uid();
      const duration = typeof toast.duration === "number" ? toast.duration : 3200;
      const next = { id, type: "info", ...toast, duration };

      setToasts((prev) => {
        const trimmed = prev.slice(-2);
        return [...trimmed, next];
      });

      if (duration > 0 && next.type !== "loading") {
        const timer = setTimeout(() => remove(id), duration);
        timers.current.set(id, timer);
      }

      return id;
    },
    [remove]
  );

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
              {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onClose={remove} />
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
