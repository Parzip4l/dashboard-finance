import { AppError } from './errors.js';

export async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new AppError(response.status, 'Dynamics 365 request failed.', {
        url,
        upstreamStatus: response.status,
      });
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError(504, 'Dynamics 365 request timed out.', { url, timeoutMs });
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
