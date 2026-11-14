import { describe, expect, it } from 'vitest';
import { applyPaste, withPrefix, wouldDeletePrefix } from '../src/lib/phone.js';

describe('withPrefix', () => {
  it('keeps the prefix and strips non-digits', () => {
    expect(withPrefix('+91 98a76-5')).toBe('+91 98765');
    expect(withPrefix('98765')).toBe('+91 98765');
    expect(withPrefix('+9198765')).toBe('+91 98765');
    expect(withPrefix('')).toBe('+91 ');
  });

  it('collapses repeated whitespace and caps the length', () => {
    expect(withPrefix('+91   98   76')).toBe('+91 98 76');
    expect(withPrefix('+91 ' + '1'.repeat(40))).toHaveLength(24);
  });

  it('supports other prefixes', () => {
    expect(withPrefix('555 0100', '+1 ')).toBe('+1 555 0100');
  });
});

describe('wouldDeletePrefix', () => {
  it('blocks backspace at or inside the prefix', () => {
    expect(wouldDeletePrefix('Backspace', 4, 4)).toBe(true);
    expect(wouldDeletePrefix('Backspace', 5, 5)).toBe(false);
  });

  it('allows deleting a selection that starts after the prefix', () => {
    expect(wouldDeletePrefix('Backspace', 4, 8)).toBe(false);
    expect(wouldDeletePrefix('Backspace', 2, 8)).toBe(true);
  });

  it('blocks Delete only inside the prefix', () => {
    expect(wouldDeletePrefix('Delete', 3, 3)).toBe(true);
    expect(wouldDeletePrefix('Delete', 4, 4)).toBe(false);
    expect(wouldDeletePrefix('a', 0, 0)).toBe(false);
  });
});

describe('applyPaste', () => {
  it('inserts pasted digits at the caret', () => {
    expect(applyPaste('+91 9810', '77', 6, 6)).toBe('+91 987710');
  });

  it('replaces the selected range', () => {
    expect(applyPaste('+91 12345', '9', 5, 8, '+91 ')).toBe('+91 195');
  });

  it('does not duplicate a pasted country code', () => {
    expect(applyPaste('+91 ', '+91 98765 43210', 4, 4)).toBe('+91 98765 43210');
  });

  it('never pastes into the prefix', () => {
    expect(applyPaste('+91 ', '123', 0, 0)).toBe('+91 123');
  });
});
