export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Works when the app is served from a sub-path (e.g. /inspection/).
const ROOT = import.meta.env.BASE_URL.replace(/\/$/, '');

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${ROOT}${path}`, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) {
    let message = res.statusText || `HTTP ${res.status}`;
    try {
      const body: unknown = await res.json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        message = body.error;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const api = { get };
