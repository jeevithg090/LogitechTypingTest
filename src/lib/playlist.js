/**
 * Cyclic playlist that skips entries which failed to load.
 * @param {string[]} items
 */
export function createPlaylist(items) {
  const failed = new Set();
  let index = 0;

  return {
    /** Current item, or null when nothing playable remains. */
    current() {
      return items.length > failed.size ? items[index] : null;
    },
    /** Advances to the next playable item and returns it (or null). */
    next() {
      if (items.length <= failed.size) return null;
      do {
        index = (index + 1) % items.length;
      } while (failed.has(index));
      return items[index];
    },
    /** Marks the current item as broken and returns the next playable one (or null). */
    markFailed() {
      if (items.length === 0) return null;
      failed.add(index);
      return this.next();
    },
    get size() {
      return items.length;
    },
  };
}
