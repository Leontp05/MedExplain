import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-ink shadow-soft-sm transition-transform duration-300 group-hover:-translate-y-0.5">
        {/* Stylized "M" mark with pulse — nods to the medical/heartbeat theme */}
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-teal-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 14h3l2-6 3 11 3-8 2 3h5" />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-serif text-base font-semibold text-ink">
          MedExplain
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-teal-600">
          AI · Clinical
        </span>
      </div>
    </Link>
  );
}

function TrustStrip() {
  const items = [
    { label: 'Encrypted at rest', icon: 'lock' },
    { label: 'Auto-deleted in 24h', icon: 'clock' },
    { label: 'No camera required', icon: 'cursor' }
  ];
  const icons: Record<string, JSX.Element> = {
    lock: (
      <path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    'eye-off': (
      <>
        <path d="M3 3l18 18" />
        <path d="M10.6 5.1A11 11 0 0 1 12 5c5 0 9 4 10 7a13 13 0 0 1-2.4 3.6M6.1 6.1C3.7 7.7 2.1 9.9 2 12c1 3 5 7 10 7 1.4 0 2.7-.3 4-.8" />
        <path d="M9.9 9.9A3 3 0 0 0 14 14" />
      </>
    ),
    cursor: (
      <>
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        <path d="M13 13l6 6" />
      </>
    ),
  };
  return (
    <div className="border-b border-sand-200/70 bg-canvas-card/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-2 text-xs text-ink-muted">
        {items.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 text-teal-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {icons[item.icon]}
            </svg>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-canvas bg-grain">
      <TrustStrip />
      <header className="sticky top-0 z-30 border-b border-sand-200/70 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="btn-ghost btn-sm hidden sm:inline-flex"
                >
                  Dashboard
                </Link>
                <div className="hidden items-center gap-2 rounded-full border border-sand-200 bg-canvas-card/70 px-3 py-1.5 text-xs text-ink-muted md:flex">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-[10px] font-semibold uppercase text-white">
                    {user.email.slice(0, 1)}
                  </span>
                  <span className="max-w-[160px] truncate">{user.email}</span>
                </div>
                <button onClick={() => logout()} className="btn-secondary btn-sm">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost btn-sm">
                  Sign in
                </Link>
                <Link to="/register" className="btn-primary btn-sm">
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-sand-200/70 bg-canvas-card/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-center sm:flex-row sm:px-6 sm:text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-teal-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 14h3l2-6 3 11 3-8 2 3h5" />
              </svg>
            </div>
            <div className="text-xs text-ink-muted">
              <p className="font-medium text-ink">MedExplain AI</p>
              <p>Privacy-first medical report interpreter.</p>
            </div>
          </div>
          <p className="max-w-md text-xs italic text-ink-muted/80">
            Educational use only — not medical advice. Always consult your
            healthcare provider for clinical decisions.
          </p>
        </div>
      </footer>
    </div>
  );
}
