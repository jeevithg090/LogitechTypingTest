import { describe, expect, it, vi } from 'vitest';
import { ApiError, postToScript, verifyVolunteerCode } from '../src/lib/api.js';

const URL = 'https://script.example/exec';
const jsonResponse = (body, init = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

describe('postToScript', () => {
  it('posts form data and returns the parsed body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ result: 'success', row: 4 }));
    await expect(postToScript(URL, { name: 'Asha' }, { fetchImpl })).resolves.toEqual({
      result: 'success',
      row: 4,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(URL);
    expect(init.method).toBe('POST');
    expect(init.body.get('name')).toBe('Asha');
  });

  it('fails fast when the endpoint is not configured', async () => {
    await expect(postToScript('', {})).rejects.toMatchObject({ code: 'config' });
  });

  it('surfaces server-side errors with their code', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ result: 'error', code: 'unauthorized', error: 'nope' }));
    const error = await postToScript(URL, {}, { fetchImpl }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'unauthorized', message: 'nope' });
  });

  it('maps network, HTTP and parse failures to ApiError', async () => {
    await expect(
      postToScript(URL, {}, { fetchImpl: vi.fn().mockRejectedValue(new TypeError('offline')) }),
    ).rejects.toMatchObject({ code: 'network' });
    await expect(
      postToScript(
        URL,
        {},
        { fetchImpl: vi.fn().mockResolvedValue(new Response('', { status: 500 })) },
      ),
    ).rejects.toMatchObject({ code: 'http' });
    await expect(
      postToScript(URL, {}, { fetchImpl: vi.fn().mockResolvedValue(new Response('<html>')) }),
    ).rejects.toMatchObject({ code: 'parse' });
  });

  it('times out slow requests', async () => {
    const fetchImpl = vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    );
    await expect(postToScript(URL, {}, { fetchImpl, timeoutMs: 10 })).rejects.toMatchObject({
      code: 'timeout',
    });
  });
});

describe('verifyVolunteerCode', () => {
  it('sends the verify action with the code', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ result: 'success' }));
    await verifyVolunteerCode(URL, 'code-123', { fetchImpl });
    const body = fetchImpl.mock.calls[0][1].body;
    expect(body.get('action')).toBe('verify');
    expect(body.get('volunteer_code')).toBe('code-123');
  });
});
