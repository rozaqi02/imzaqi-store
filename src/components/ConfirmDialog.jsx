import React, { useEffect, useState } from "react";
import Modal from "./Modal";

/**
 * Accessible confirm/cancel dialog — replaces window.confirm / window.prompt flows.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  danger = false,
  prompt = false,
  promptDefault = "",
  promptLabel = "Nilai",
  onConfirm,
  onCancel,
}) {
  const [promptValue, setPromptValue] = useState(promptDefault);

  useEffect(() => {
    if (open) setPromptValue(promptDefault);
  }, [open, promptDefault]);

  if (!open) return null;

  function handleConfirm() {
    if (prompt) onConfirm?.(promptValue);
    else onConfirm?.();
  }

  return (
    <Modal open title={title} onClose={onCancel}>
      {message ? <p className="confirm-dialog-message">{message}</p> : null}
      {prompt ? (
        <label className="admin-field" style={{ marginTop: 12 }}>
          <span>{promptLabel}</span>
          <input
            className="input"
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            autoFocus
          />
        </label>
      ) : null}
      <div className="confirm-dialog-actions">
        <button className="btn btn-ghost" type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          className={danger ? "btn btn-danger" : "btn"}
          type="button"
          onClick={handleConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}