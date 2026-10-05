// src/components/WhatsAppInput.jsx
import React, { useRef, useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';

const STORAGE_KEY = 'imzaqi_last_whatsapp';

import { formatWhatsAppNumber, normalizeWhatsApp, validateWhatsApp } from '../lib/format';


export default function WhatsAppInput({
  value = '',
  onChange,
  onValidChange,
  required = true,
  autoFocus = false,
  disabled = false,
  label = 'Nomor WhatsApp',
  placeholder = 'Contoh: 0812-3456-7890',
  helperText = 'Format: 08xxx atau +62xxx',
  className = '',
  compact = false,
  rememberLast = true,
}) {
  const [internalValue, setInternalValue] = useState(() => formatWhatsAppNumber(value));
  const [validation, setValidation] = useState({ valid: false, message: '' });
  const [touched, setTouched] = useState(false);
  const autoFilledRef = useRef(false);
  const [lastSavedNumber, setLastSavedNumber] = useState('');

  useEffect(() => {
    if (rememberLast && !autoFilledRef.current) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const formatted = formatWhatsAppNumber(saved);
          setLastSavedNumber(formatted);
          if (!value) {
            autoFilledRef.current = true;
            setInternalValue(formatted);
            if (onChange) onChange(formatted);
          }
        }
      } catch (e) {}
    }
  }, [rememberLast]);

  useEffect(() => {
    const result = validateWhatsApp(internalValue);
    setValidation(result);
    if (onValidChange) onValidChange(result.valid);
  }, [internalValue, onValidChange]);

  useEffect(() => {
    setInternalValue((prev) => {
      const nextFormatted = formatWhatsAppNumber(value);
      return nextFormatted !== prev ? nextFormatted : prev;
    });
  }, [value]);

  const handleChange = (e) => {
    const rawValue = e.target.value;
    const formatted = formatWhatsAppNumber(rawValue);
    setInternalValue(formatted);
    setTouched(true);
    if (onChange) onChange(formatted);
  };

  const handleBlur = () => {
    setTouched(true);
    if (validation.valid) {
      const normalized = normalizeWhatsApp(internalValue);
      const formattedNormalized = formatWhatsAppNumber(normalized);
      setInternalValue(formattedNormalized);
      if (onChange) onChange(formattedNormalized);
      if (rememberLast) {
        try {
          localStorage.setItem(STORAGE_KEY, normalized);
        } catch (e) {}
      }
    }
  };

  const handleUseLast = () => {
    if (lastSavedNumber) {
      const formatted = formatWhatsAppNumber(lastSavedNumber);
      setInternalValue(formatted);
      setTouched(true);
      if (onChange) onChange(formatted);
    }
  };

  const showError = touched && !validation.valid && internalValue !== '';
  const showSuccess = touched && validation.valid;
  const wrapperClassName = ['whatsapp-input-wrapper', compact ? 'is-compact' : '', className].filter(Boolean).join(' ');

  return (
    <div className={wrapperClassName}>
      <label className="label" htmlFor="whatsapp-input">
        {label} {required && <span className="required">*</span>}
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
          aria-invalid={showError || undefined}
          aria-describedby="whatsapp-hint"
        />
        {showSuccess && <span className="input-icon"><Check size={16} strokeWidth={2.5} /></span>}
        {showError && <span className="input-icon"><X size={16} strokeWidth={2.5} /></span>}
      </div>

      {showError && (
        <div id="whatsapp-hint" className="hint error-hint">{validation.message}</div>
      )}

      {!showError && (
        <div id="whatsapp-hint" className="hint subtle">
          {helperText}
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

