/** Client-side validation rules. Mirrors apps-script/Code.gs validateRegistration. */

export const MAX_WPM = 300;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @typedef {{ name?: string, email?: string, contact_number?: string, wpm_count?: string }} Registration
 * @typedef {Partial<Record<keyof Registration, string>>} ValidationErrors
 */

/** @param {string | undefined} value */
const clean = (value) => (value ?? '').trim();

/** @param {string | undefined} value */
export function validateName(value) {
  const name = clean(value);
  if (name.length < 2) return 'Please enter your full name.';
  if (name.length > 100) return 'Name must be 100 characters or fewer.';
  return '';
}

/** @param {string | undefined} value */
export function validateEmail(value) {
  const email = clean(value);
  if (!email) return 'Please enter your email address.';
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return 'Please enter a valid email address.';
  }
  return '';
}

/** @param {string | undefined} value */
export function validatePhone(value) {
  const digits = clean(value).replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return 'Please enter a valid contact number.';
  }
  return '';
}

/** @param {string | undefined} value */
export function validateWpm(value) {
  const wpm = clean(value);
  if (!wpm) return 'A volunteer must enter the WPM count.';
  if (!/^\d+$/.test(wpm) || Number(wpm) > MAX_WPM) {
    return `WPM must be a whole number between 0 and ${MAX_WPM}.`;
  }
  return '';
}

const VALIDATORS = {
  name: validateName,
  email: validateEmail,
  contact_number: validatePhone,
  wpm_count: validateWpm,
};

/**
 * Validates a full registration.
 * @param {Registration} data
 * @returns {ValidationErrors}
 */
export function validateRegistration(data) {
  /** @type {ValidationErrors} */
  const errors = {};
  for (const [field, validate] of Object.entries(VALIDATORS)) {
    const message = validate(data[field]);
    if (message) errors[field] = message;
  }
  return errors;
}

/** @param {string} field @param {string | undefined} value */
export function validateField(field, value) {
  const validate = VALIDATORS[field];
  return validate ? validate(value) : '';
}
