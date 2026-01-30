// src/utils/validators.js
/**
 * Validation Utilities
 * Reusable validation functions untuk form inputs (UX #2)
 */

// ================================================================
// PHONE NUMBER VALIDATION
// ================================================================

/**
 * Validate Indonesian phone number
 * Accepts: 08xxx, +62xxx, 62xxx
 */
export function validatePhoneNumber(phone) {
  if (!phone) {
    return { valid: false, message: 'Nomor telepon wajib diisi' };
  }

  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Check length
  if (cleaned.length < 10) {
    return { valid: false, message: 'Nomor terlalu pendek (min 10 digit)' };
  }

  if (cleaned.length > 16) {
    return { valid: false, message: 'Nomor terlalu panjang (max 13 digit)' };
  }

  // Check format
  const patterns = [
    /^08\d{8,13}$/, // 08xxx
    /^(\+?62)8\d{8,13}$/, // +62xxx or 62xxx
  ];

  const isValid = patterns.some(pattern => pattern.test(cleaned));

  if (!isValid) {
    return { 
      valid: false, 
      message: 'Format tidak valid. Gunakan 08xxx atau +62xxx' 
    };
  }

  return { valid: true, message: '' };
}

/**
 * Normalize phone number to +62 format
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return '';

  let cleaned = phone.replace(/[^\d+]/g, '');

  // 08xxx → +628xxx
  if (cleaned.startsWith('0')) {
    cleaned = '+62' + cleaned.slice(1);
  }

  // 62xxx → +62xxx
  if (cleaned.startsWith('62') && !cleaned.startsWith('+62')) {
    cleaned = '+' + cleaned;
  }

  // xxx → +62xxx (assume Indonesian)
  if (!cleaned.startsWith('+62') && !cleaned.startsWith('08')) {
    cleaned = '+62' + cleaned;
  }

  return cleaned;
}

// ================================================================
// EMAIL VALIDATION
// ================================================================

/**
 * Validate email address
 */
export function validateEmail(email) {
  if (!email) {
    return { valid: false, message: 'Email wajib diisi' };
  }

  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!pattern.test(email)) {
    return { valid: false, message: 'Format email tidak valid' };
  }

  return { valid: true, message: '' };
}

// ================================================================
// TEXT VALIDATION
// ================================================================

/**
 * Validate required text field
 */
export function validateRequired(value, fieldName = 'Field') {
  if (!value || value.trim() === '') {
    return { valid: false, message: `${fieldName} wajib diisi` };
  }

  return { valid: true, message: '' };
}

/**
 * Validate text length
 */
export function validateLength(value, min, max, fieldName = 'Field') {
  if (!value) {
    return { valid: false, message: `${fieldName} wajib diisi` };
  }

  if (value.length < min) {
    return { 
      valid: false, 
      message: `${fieldName} minimal ${min} karakter` 
    };
  }

  if (max && value.length > max) {
    return { 
      valid: false, 
      message: `${fieldName} maksimal ${max} karakter` 
    };
  }

  return { valid: true, message: '' };
}

// ================================================================
// NUMBER VALIDATION
// ================================================================

/**
 * Validate number range
 */
export function validateNumber(value, min, max, fieldName = 'Number') {
  const num = Number(value);

  if (isNaN(num)) {
    return { valid: false, message: `${fieldName} harus berupa angka` };
  }

  if (min !== undefined && num < min) {
    return { 
      valid: false, 
      message: `${fieldName} minimal ${min}` 
    };
  }

  if (max !== undefined && num > max) {
    return { 
      valid: false, 
      message: `${fieldName} maksimal ${max}` 
    };
  }

  return { valid: true, message: '' };
}

// ================================================================
// FILE VALIDATION
// ================================================================

/**
 * Validate file upload
 */
export function validateFile(file, options = {}) {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'],
  } = options;

  if (!file) {
    return { valid: false, message: 'File wajib dipilih' };
  }

  // Check file size
  if (file.size > maxSize) {
    const sizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    return { 
      valid: false, 
      message: `File terlalu besar. Maksimal ${sizeMB}MB` 
    };
  }

  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    const types = allowedExtensions.join(', ').toUpperCase();
    return { 
      valid: false, 
      message: `Format file tidak didukung. Gunakan ${types}` 
    };
  }

  // Check file extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
    const types = allowedExtensions.join(', ').toUpperCase();
    return { 
      valid: false, 
      message: `Format file tidak didukung. Gunakan ${types}` 
    };
  }

  return { valid: true, message: '' };
}

// ================================================================
// PROMO CODE VALIDATION
// ================================================================

/**
 * Validate promo code format
 */
export function validatePromoCode(code) {
  if (!code) {
    return { valid: false, message: 'Kode promo wajib diisi' };
  }

  const cleaned = code.trim().toUpperCase();

  if (cleaned.length < 3) {
    return { valid: false, message: 'Kode promo terlalu pendek' };
  }

  if (cleaned.length > 20) {
    return { valid: false, message: 'Kode promo terlalu panjang' };
  }

  // Only alphanumeric and dash
  if (!/^[A-Z0-9-]+$/.test(cleaned)) {
    return { 
      valid: false, 
      message: 'Kode promo hanya boleh berisi huruf, angka, dan dash (-)' 
    };
  }

  return { valid: true, message: '', normalized: cleaned };
}

// ================================================================
// COMPOSITE VALIDATION
// ================================================================

/**
 * Validate multiple fields at once
 * Returns object with field names as keys and validation results as values
 */
export function validateForm(fields) {
  const results = {};
  let isValid = true;

  Object.entries(fields).forEach(([key, config]) => {
    const { value, validator, ...options } = config;
    const result = validator(value, options);
    results[key] = result;

    if (!result.valid) {
      isValid = false;
    }
  });

  return { isValid, results };
}

// ================================================================
// EXPORT ALL VALIDATORS
// ================================================================

export default {
  phoneNumber: validatePhoneNumber,
  normalizePhone: normalizePhoneNumber,
  email: validateEmail,
  required: validateRequired,
  length: validateLength,
  number: validateNumber,
  file: validateFile,
  promoCode: validatePromoCode,
  form: validateForm,
};