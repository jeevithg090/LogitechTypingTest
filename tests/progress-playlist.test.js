import { describe, expect, it } from 'vitest';
import { createPlaylist } from '../src/lib/playlist.js';
import { completionPercent } from '../src/lib/progress.js';

describe('completionPercent', () => {
  it('counts non-blank fields', () => {
    expect(completionPercent([])).toBe(0);
    expect(completionPercent([{ value: 'a' }, { value: ' ' }])).toBe(50);
    expect(completionPercent([{ value: 'a' }, { value: 'b' }, { value: 'c' }])).toBe(100);
  });

  it('treats a placeholder value as empty', () => {
    expect(completionPercent([{ value: '+91 ', emptyValue: '+91 ' }])).toBe(0);
    expect(completionPercent([{ value: '+91 9', emptyValue: '+91 ' }])).toBe(100);
  });
});

describe('createPlaylist', () => {
  it('cycles through items', () => {
    const playlist = createPlaylist(['a', 'b', 'c']);
    expect(playlist.current()).toBe('a');
    expect([playlist.next(), playlist.next(), playlist.next()]).toEqual(['b', 'c', 'a']);
  });

  it('skips failed items and returns null when none remain', () => {
    const playlist = createPlaylist(['a', 'b']);
    expect(playlist.markFailed()).toBe('b');
    expect(playlist.next()).toBe('b');
    expect(playlist.markFailed()).toBeNull();
    expect(playlist.current()).toBeNull();
    expect(playlist.next()).toBeNull();
  });

  it('handles an empty playlist', () => {
    const playlist = createPlaylist([]);
    expect(playlist.current()).toBeNull();
    expect(playlist.markFailed()).toBeNull();
    expect(playlist.size).toBe(0);
  });
});
