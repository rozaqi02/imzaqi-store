// src/components/WhatsAppInput.jsx
import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';

const STORAGE_KEY = 'imzaqi_last_whatsapp';

function formatWhatsAppNumber(value) {
  let clean = value.replace(/[^\d+]/g, '');
  
  if (clean.startsWith('+62')) {
    let rest = clean.slice(3).replace(/\D/g, '');
    let formatted = '+62';
    if (rest.length > 0) {
      formatted += ' ' + rest.slice(0, 3);
    }
    if (rest.length > 3) {
      formatted += '-' + rest.slice(3, 7);
    }
    if (rest.length > 7) {
      formatted += '-' + rest.slice(7, 12);
    }
    return formatted;
  } else if (clean.startsWith('62')) {
    let rest = clean.slice(2).replace(/\D/g, '');
    let formatted = '+62';
    if (rest.length > 0) {
      formatted += ' ' + rest.slice(0, 3);
    }
    if (rest.length > 3) {
      formatted += '-' + rest.slice(3, 7);
    }
    if (rest.length > 7) {
      formatted += '-' + rest.slice(7, 12);
    }
    return formatted;
  } else {
    let rest = clean.replace(/\D/g, '');
    let formatted = '';
    if (rest.length > 0) {
      formatted += rest.slice(0, 4);
    }
    if (rest.length > 4) {
      formatted += '-' + rest.slice(4, 8);
    }
    if (rest.length > 8) {
      formatted += '-' + rest.slice(8, 13);
    }
    return formatted;
  }
}

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
  const rawClean = value.replace(/[^\d]/g, '');
  const isValid = /^08\d{8,13}$/.test(rawClean) || /^(\+?62)8\d{8,13}$/.test(normalized);
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
  const [lastSavedNumber, setLastSavedNumber] = useState('');

  useEffect(() => {
    if (rememberLast) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setLastSavedNumber(formatWhatsAppNumber(saved));
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

  const cleanDigits = internalValue.replace(/[^\d+]/g, '');
  const isIndonesian = /^(08|628|\+628)/.test(cleanDigits);

  return (
    <div className={wrapperClassName}>
      <label className="label" htmlFor="whatsapp-input">
        {label} {required && <span className="required">*</span>}
      </label>
      
      <div className={`input-wrapper ${showError ? 'error' : ''} ${showSuccess ? 'success' : ''}`}>
        {isIndonesian && (
          <span className="wa-input-flag" aria-hidden="true" style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '18px',
            pointerEvents: 'none',
            zIndex: 3
          }}>
            🇮🇩
          </span>
        )}
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
          style={isIndonesian ? { paddingLeft: '44px' } : undefined}
        />
        {showSuccess && <span className="input-icon" style={{ right: isIndonesian ? '14px' : undefined }}><Check size={16} strokeWidth={2.5} /></span>}
        {showError && <span className="input-icon" style={{ right: isIndonesian ? '14px' : undefined }}><X size={16} strokeWidth={2.5} /></span>}
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

