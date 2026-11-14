/** Thin client for the Apps Script web app. */

export class ApiError extends Error {
  /** @param {string} message @param {string} [code] */
  constructor(message, code = 'unknown') {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

/**
 * POSTs form data to the Apps Script endpoint and returns the parsed JSON body.
 * Throws ApiError for network failures, non-JSON responses and `result: "error"`.
 * @param {string} url
 * @param {Record<string, string>} fields
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 */
export async function postToScript(url, fields, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  if (!url) {
    throw new ApiError('Submissions are not configured (missing VITE_SCRIPT_URL).', 'config');
  }

  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchImpl(url, { method: 'POST', body, signal: controller.signal });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    throw new ApiError(
      timedOut
        ? 'The request timed out. Please try again.'
        : 'Network error. Check the connection and try again.',
      timedOut ? 'timeout' : 'network',
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ApiError(`Server responded with status ${response.status}.`, 'http');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('Unexpected response from the server.', 'parse');
  }

  if (!data || data.result !== 'success') {
    throw new ApiError(data?.error || 'The server rejected the request.', data?.code);
  }
  return data;
}

/** @param {string} url @param {string} volunteerCode @param {{ fetchImpl?: typeof fetch }} [options] */
export function verifyVolunteerCode(url, volunteerCode, options) {
  return postToScript(url, { action: 'verify', volunteer_code: volunteerCode }, options);
}
