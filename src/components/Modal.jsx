import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogA11y } from "../hooks/useDialogA11y";

export default function Modal({ open, title, children, footer, onClose, size = "md" }) {
  const dialogRef = useRef(null);

  useDialogA11y({
    open,
    containerRef: dialogRef,
    onClose,
    initialFocusSelector: ".modal-close",
  });

  useEffect(() => {
    if (!open) return undefined;

    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPad;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Dialog"}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="modal-close" type="button" onClick={() => onClose?.()} aria-label="Tutup">
            <X size={18} strokeWidth={2.25} />
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
