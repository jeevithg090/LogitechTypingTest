/** Runtime configuration, read from Vite env vars at build time. */

const env = import.meta.env;

/** @param {string | undefined} raw */
export function parseList(raw) {
  return (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  /** Apps Script web app URL ("…/exec"). Empty means submissions are disabled. */
  scriptUrl: (env.VITE_SCRIPT_URL ?? '').trim(),
  /** Prize shown on the registration page. */
  prizeName: (env.VITE_PRIZE_NAME ?? '').trim() || 'a wireless mouse',
  /** Optional "learn more" link on the home screen. */
  learnMoreUrl: (env.VITE_LEARN_MORE_URL ?? '').trim(),
  learnMoreLabel: (env.VITE_LEARN_MORE_LABEL ?? '').trim() || 'Learn more',
  /** Background video playlist, relative to the site root. */
  videos: parseList(env.VITE_BACKGROUND_VIDEOS),
  /** Seconds before returning to the home screen after a successful submission. */
  redirectSeconds: Number(env.VITE_REDIRECT_SECONDS) || 5,
};
