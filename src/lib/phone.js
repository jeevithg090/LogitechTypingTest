/** Helpers for keeping a fixed country-code prefix on the contact number field. */

export const DEFAULT_PREFIX = '+91 ';

/**
 * Normalises raw input so it always starts with the prefix and contains only
 * digits and single spaces after it.
 * @param {string} value
 * @param {string} [prefix]
 */
export function withPrefix(value, prefix = DEFAULT_PREFIX) {
  let rest = value ?? '';
  const trimmedPrefix = prefix.trim();
  if (rest.startsWith(prefix)) {
    rest = rest.slice(prefix.length);
  } else if (rest.startsWith(trimmedPrefix)) {
    rest = rest.slice(trimmedPrefix.length);
  }
  rest = rest
    .replace(/[^\d ]/g, '')
    .replace(/\s+/g, ' ')
    .trimStart();
  return prefix + rest.slice(0, 20);
}

/**
 * Returns true when an edit at the given selection would remove part of the prefix.
 * @param {string} key
 * @param {number} selectionStart
 * @param {number} selectionEnd
 * @param {string} [prefix]
 */
export function wouldDeletePrefix(key, selectionStart, selectionEnd, prefix = DEFAULT_PREFIX) {
  if (key === 'Backspace') {
    return selectionStart === selectionEnd
      ? selectionStart <= prefix.length
      : selectionStart < prefix.length;
  }
  if (key === 'Delete') return selectionStart < prefix.length;
  return false;
}

/**
 * Inserts pasted text at the caret instead of replacing the whole value.
 * @param {string} value
 * @param {string} pasted
 * @param {number} selectionStart
 * @param {number} selectionEnd
 * @param {string} [prefix]
 */
export function applyPaste(value, pasted, selectionStart, selectionEnd, prefix = DEFAULT_PREFIX) {
  const start = Math.max(selectionStart, prefix.length);
  const end = Math.max(selectionEnd, start);
  // Drop a pasted country code so "+91 98765..." does not double the prefix.
  const cleaned = pasted.trim().replace(new RegExp(`^\\${prefix.trim()}\\s*`), '');
  return withPrefix(value.slice(0, start) + cleaned + value.slice(end), prefix);
}
