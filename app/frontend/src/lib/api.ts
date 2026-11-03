import type { TokenResponse } from '@ecommerce/schemas';

import { getSession, setSession, updateSessionTokens } from './session';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Set to false for endpoints that must not carry (or refresh) the access token. */
  auth?: boolean;
};

async function send(path: string, options: ApiFetchOptions): Promise<Response> {
  const headers = new Headers();
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const accessToken = getSession()?.accessToken;
  if (accessToken !== undefined) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Single-flight refresh so concurrent 401s only rotate the token pair once.
 * A failed refresh clears the session, which sends the UI back to the login page.
 */
async function refreshAccessToken(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const current = getSession();
    if (current === null) {
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });

    if (!response.ok) {
      setSession(null);
      return false;
    }

    updateSessionTokens((await response.json()) as TokenResponse);
    return true;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  let code: string | undefined;

  try {
    const payload = (await response.json()) as { error?: unknown; code?: unknown };
    if (typeof payload.error === 'string') {
      message = payload.error;
    }
    if (typeof payload.code === 'string') {
      code = payload.code;
    }
  } catch {
    // Non-JSON error body; keep the status-based message.
  }

  return new ApiError(message, response.status, code);
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const useAuth = options.auth !== false;
  let response = await send(path, options);

  if (response.status === 401 && useAuth && (await refreshAccessToken())) {
    response = await send(path, options);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
