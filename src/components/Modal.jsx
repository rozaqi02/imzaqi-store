import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Modal({ open, title, children, footer, onClose }) {
  useEffect(() => {
    if (!open) return;

    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onMouseDown={() => onClose?.()} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label={title || "Dialog"} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="modal-close" type="button" onClick={() => onClose?.()} aria-label="Tutup">
            ×
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
