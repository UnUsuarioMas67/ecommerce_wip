import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import type { LoginInput } from '@ecommerce/schemas';

import { getSession, setSession, subscribeToSession } from '../../lib/session';
import { fetchCurrentUser, login, logout } from './api';

const authKeys = {
  me: ['auth', 'me'] as const,
};

/** The signed-in session (tokens + user), shared by every component. */
export function useSession() {
  return useSyncExternalStore(subscribeToSession, getSession);
}

/**
 * Re-reads the user from `GET /auth/me` so the UI reflects server-side changes
 * and proves the access token works. The login response seeds the cache, so the
 * name renders immediately while the request is in flight.
 */
export function useMe() {
  const session = useSession();

  return useQuery({
    queryKey: authKeys.me,
    queryFn: ({ signal }) => fetchCurrentUser(signal),
    enabled: session !== null,
    placeholderData: session?.user,
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (data) => {
      setSession({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      queryClient.setQueryData(authKeys.me, data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const session = getSession();
      if (session === null) {
        return;
      }
      try {
        await logout(session.refreshToken);
      } catch {
        // The local session is cleared either way: an expired refresh token
        // must not trap the user in a signed-in shell.
      }
    },
    onSettled: () => {
      setSession(null);
      queryClient.clear();
    },
  });
}
