import { useLogout, useMe, useSession } from '../features/auth/use-auth';

const placeholderSections = [
  { title: 'Products', description: 'Browse the catalog once the storefront is built.' },
  { title: 'Cart', description: 'Add products and review totals before checkout.' },
  { title: 'Orders', description: 'Track purchases and payment status.' },
];

export function HomePage() {
  const session = useSession();
  const { data: user, isFetching, isError } = useMe();
  const logout = useLogout();

  const currentUser = user ?? session?.user;

  if (currentUser === undefined) {
    return null;
  }

  const fullName = `${currentUser.firstName} ${currentUser.lastName}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white">
              E
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-900">Ecommerce</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{fullName}</p>
              <p className="text-xs text-slate-500">{currentUser.email}</p>
            </div>
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
            >
              {logout.isPending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-medium text-indigo-600">Signed in</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Welcome back, {currentUser.firstName}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {fullName} · {currentUser.email}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">
              {currentUser.role}
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
              {currentUser.isActive ? 'active' : 'inactive'}
            </span>
            {isFetching && <span className="text-slate-400">refreshing profile…</span>}
            {isError && (
              <span className="text-amber-600">could not refresh profile from the API</span>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Placeholder
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {placeholderSections.map((section) => (
              <article
                key={section.title}
                className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-5"
              >
                <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{section.description}</p>
                <p className="mt-4 text-xs font-medium text-slate-400">Coming soon</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
