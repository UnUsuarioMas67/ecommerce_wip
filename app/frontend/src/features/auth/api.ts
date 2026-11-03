import type { AuthResponse, PublicUser } from '@ecommerce/schemas';

import { apiFetch } from '../../lib/api';

export function login(input: { email: string; password: string }): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: input,
    auth: false,
  });
}

export async function fetchCurrentUser(signal?: AbortSignal): Promise<PublicUser> {
  const { user } = await apiFetch<{ user: PublicUser }>('/auth/me', { signal });
  return user;
}

export async function logout(refreshToken: string): Promise<void> {
  await apiFetch<void>('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    auth: false,
  });
}
