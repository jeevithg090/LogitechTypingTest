import { describe, expect, it } from 'vitest';
import {
  MAX_WPM,
  validateEmail,
  validateField,
  validateName,
  validatePhone,
  validateRegistration,
  validateWpm,
} from '../src/lib/validation.js';

const valid = {
  name: 'Asha Rao',
  email: 'asha@example.com',
  contact_number: '+91 98765 43210',
  wpm_count: '72',
};

describe('field validators', () => {
  it('requires a name of sensible length', () => {
    expect(validateName('Asha')).toBe('');
    expect(validateName(' ')).not.toBe('');
    expect(validateName('A')).not.toBe('');
    expect(validateName('x'.repeat(101))).not.toBe('');
  });

  it('validates email format', () => {
    expect(validateEmail('a@b.co')).toBe('');
    expect(validateEmail('')).toMatch(/enter/);
    expect(validateEmail('not-an-email')).toMatch(/valid/);
    expect(validateEmail('a b@c.com')).toMatch(/valid/);
  });

  it('treats a bare country-code prefix as an invalid phone number', () => {
    expect(validatePhone('+91 ')).not.toBe('');
    expect(validatePhone('+91 98765 43210')).toBe('');
    expect(validatePhone('+91 123')).not.toBe('');
    expect(validatePhone('1'.repeat(16))).not.toBe('');
  });

  it('accepts only whole WPM numbers within range', () => {
    expect(validateWpm('0')).toBe('');
    expect(validateWpm(String(MAX_WPM))).toBe('');
    expect(validateWpm('')).toMatch(/volunteer/i);
    expect(validateWpm('-5')).not.toBe('');
    expect(validateWpm('12.5')).not.toBe('');
    expect(validateWpm('1e3')).not.toBe('');
    expect(validateWpm(String(MAX_WPM + 1))).not.toBe('');
  });
});

describe('validateRegistration', () => {
  it('returns no errors for a valid registration', () => {
    expect(validateRegistration(valid)).toEqual({});
  });

  it('reports every invalid field', () => {
    const errors = validateRegistration({
      name: '',
      email: 'x',
      contact_number: '+91 ',
      wpm_count: '',
    });
    expect(Object.keys(errors).sort()).toEqual(['contact_number', 'email', 'name', 'wpm_count']);
  });

  it('validateField ignores unknown fields', () => {
    expect(validateField('unknown', 'anything')).toBe('');
    expect(validateField('email', 'bad')).not.toBe('');
  });
});
