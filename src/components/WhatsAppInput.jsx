// src/components/WhatsAppInput.jsx
import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'imzaqi_last_whatsapp';

function normalizeWhatsApp(value) {
  let clean = value.replace(/[^\d+]/g, '');
  if (clean.startsWith('0')) clean = '+62' + clean.slice(1);
  if (clean.startsWith('62') && !clean.startsWith('+62')) clean = '+' + clean;
  return clean;
}

function validateWhatsApp(value) {
  if (!value) return { valid: false, message: 'Nomor WhatsApp wajib diisi' };
  const normalized = normalizeWhatsApp(value);
  if (normalized.length < 12) return { valid: false, message: 'Nomor terlalu pendek' };
  if (normalized.length > 16) return { valid: false, message: 'Nomor terlalu panjang' };
  const isValid = /^08\d{8,13}$/.test(value) || /^(\+?62)8\d{8,13}$/.test(normalized);
  if (!isValid) return { valid: false, message: 'Format: 08xxx atau +62xxx' };
  return { valid: true, message: '' };
}

export default function WhatsAppInput({
  value = '',
  onChange,
  onValidChange,
  required = true,
  autoFocus = false,
  disabled = false,
  placeholder = 'Contoh: 081234567890',
  rememberLast = true,
}) {
  const [internalValue, setInternalValue] = useState(value);
  const [validation, setValidation] = useState({ valid: false, message: '' });
  const [touched, setTouched] = useState(false);
  const [lastSavedNumber, setLastSavedNumber] = useState('');

  useEffect(() => {
    if (rememberLast) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setLastSavedNumber(saved);
      } catch (e) {}
    }
  }, [rememberLast]);

  useEffect(() => {
    const result = validateWhatsApp(internalValue);
    setValidation(result);
    if (onValidChange) onValidChange(result.valid);
  }, [internalValue, onValidChange]);

  useEffect(() => {
    // Sync internal state only when the controlled `value` prop changes
    setInternalValue((prev) => (value !== prev ? value : prev));
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    setTouched(true);
    if (onChange) onChange(newValue);
  };

  const handleBlur = () => {
    setTouched(true);
    if (validation.valid) {
      const normalized = normalizeWhatsApp(internalValue);
      setInternalValue(normalized);
      if (onChange) onChange(normalized);
      if (rememberLast) {
        try {
          localStorage.setItem(STORAGE_KEY, normalized);
        } catch (e) {}
      }
    }
  };

  const handleUseLast = () => {
    if (lastSavedNumber) {
      setInternalValue(lastSavedNumber);
      setTouched(true);
      if (onChange) onChange(lastSavedNumber);
    }
  };

  const showError = touched && !validation.valid && internalValue !== '';
  const showSuccess = touched && validation.valid;

  return (
    <div className="whatsapp-input-wrapper">
      <label className="label" htmlFor="whatsapp-input">
        📱 Nomor WhatsApp {required && <span className="required">*</span>}
      </label>
      
      <div className={`input-wrapper ${showError ? 'error' : ''} ${showSuccess ? 'success' : ''}`}>
        <input
          id="whatsapp-input"
          className="input"
          type="tel"
          value={internalValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          required={required}
        />
        {showSuccess && <span className="input-icon">✓</span>}
        {showError && <span className="input-icon">✗</span>}
      </div>

      {showError && (
        <div className="hint error-hint">{validation.message}</div>
      )}

      {!showError && (
        <div className="hint subtle">
          Format: <b>08xxx</b> atau <b>+62xxx</b>
        </div>
      )}

      {lastSavedNumber && !internalValue && rememberLast && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleUseLast}
          style={{ marginTop: 8 }}
        >
          Gunakan nomor terakhir: {lastSavedNumber}
        </button>
      )}
    </div>
  );
}