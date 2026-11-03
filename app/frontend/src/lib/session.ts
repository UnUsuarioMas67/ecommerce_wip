import type { PublicUser } from '@ecommerce/schemas';

export type Session = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

const STORAGE_KEY = 'ecommerce.session';

const listeners = new Set<() => void>();

let session: Session | null = readStoredSession();

function isStoredSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accessToken === 'string' &&
    typeof candidate.refreshToken === 'string' &&
    typeof candidate.user === 'object' &&
    candidate.user !== null
  );
}

function readStoredSession(): Session | null {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isStoredSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persist(next: Session | null): void {
  try {
    if (next === null) {
      globalThis.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode, quota). The in-memory session
    // still works for the current tab.
  }
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getSession(): Session | null {
  return session;
}

export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setSession(next: Session | null): void {
  session = next;
  persist(next);
  notify();
}

/** Keeps the cached user while swapping rotated tokens (refresh flow). */
export function updateSessionTokens(tokens: {
  accessToken: string;
  refreshToken: string;
}): void {
  if (session === null) {
    return;
  }
  setSession({ ...session, ...tokens });
}
