import { useState } from 'react';
import type { FormEvent } from 'react';

import { ApiError } from '../lib/api';
import { useLogin } from '../features/auth/use-auth';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const errorMessage = login.isError
    ? login.error instanceof ApiError
      ? login.error.message
      : 'Could not reach the API. Is the backend running?'
    : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate({ email: email.trim().toLowerCase(), password });
  }

  function handleChange() {
    if (login.isError) {
      login.reset();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-indigo-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-semibold text-white shadow-lg shadow-indigo-600/30">
            E
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Access your ecommerce account.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                handleChange();
              }}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
              placeholder="you@example.com"
              disabled={login.isPending}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                handleChange();
              }}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
              placeholder="••••••••"
              disabled={login.isPending}
            />
          </div>

          {errorMessage !== null && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-indigo-400"
          >
            {login.isPending && (
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {import.meta.env.DEV && (
          <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
            Dev hint: the backend seeds{' '}
            <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-slate-700">
              admin@ecommerce.test
            </code>{' '}
            /{' '}
            <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-slate-700">
              ChangeMe1234!
            </code>{' '}
            unless ADMIN_EMAIL / ADMIN_PASSWORD are set.
          </p>
        )}
      </div>
    </main>
  );
}
