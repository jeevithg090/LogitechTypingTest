import { config } from './lib/config.js';
import { createPlaylist } from './lib/playlist.js';

const video = /** @type {HTMLVideoElement} */ (document.getElementById('background-video'));
const overlay = /** @type {HTMLElement} */ (document.getElementById('overlay'));
const learnMore = /** @type {HTMLAnchorElement} */ (document.getElementById('learn-more'));

if (config.learnMoreUrl) {
  learnMore.href = config.learnMoreUrl;
  learnMore.textContent = config.learnMoreLabel;
  learnMore.hidden = false;
}

const playlist = createPlaylist(config.videos);

/** Falls back to the static gradient background when no video can be played. */
function showFallback() {
  video.removeAttribute('src');
  document.body.classList.add('no-video');
}

/** @param {string | null} src */
function play(src) {
  if (!src) {
    showFallback();
    return;
  }
  video.src = encodeURI(src);
  video.play().catch(() => {
    // Autoplay can be blocked until the user interacts; the poster gradient remains.
  });
}

if (playlist.size === 0) {
  showFallback();
} else {
  // A single video simply loops; a playlist advances on "ended".
  video.loop = playlist.size === 1;
  video.addEventListener('ended', () => play(playlist.next()));
  video.addEventListener('error', () => play(playlist.markFailed()));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && video.src) video.play().catch(() => {});
  });
  play(playlist.current());
}

// Kiosk mode: "L" toggles the buttons so the video can play unobstructed.
document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'l' || event.ctrlKey || event.metaKey || event.altKey) return;
  const hidden = document.body.classList.toggle('kiosk-hidden');
  overlay.classList.toggle('overlay-clear', hidden);
});
