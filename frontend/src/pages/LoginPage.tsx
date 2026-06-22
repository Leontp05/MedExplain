import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, ApiError } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-7xl items-stretch gap-0 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:py-16">
      {/* Left — form */}
      <div className="flex items-center">
        <div className="w-full max-w-md lg:mx-auto">
          <span className="eyebrow mb-4 block">Welcome back</span>
          <h1 className="mb-3 font-serif text-display-sm text-ink">
            Sign in to MedExplain
          </h1>
          <p className="mb-8 text-sm text-ink-muted">
            Access your private medical report explanations. Your session is
            encrypted and ends when you log out.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="input-label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="input-field"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="input-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                minLength={8}
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div
                className="flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 fade-in"
                role="alert"
              >
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            No account yet?{' '}
            <Link to="/register" className="font-medium text-teal-600 hover:text-teal-700 hover:underline">
              Create one — it's free
            </Link>
          </p>
        </div>
      </div>

      {/* Right — trust panel */}
      <div className="hidden items-center lg:flex">
        <div className="w-full rounded-3xl border border-sand-200 bg-gradient-to-br from-teal-50/60 via-canvas-card to-canvas-card p-10 shadow-soft">
          <div className="mb-6 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-teal-400">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 14h3l2-6 3 11 3-8 2 3h5" />
              </svg>
            </span>
            <span className="font-serif text-lg font-semibold text-ink">
              Why MedExplain?
            </span>
          </div>
          <ul className="space-y-5">
            {[
              {
                t: 'Private by default',
                d: 'Encrypted at rest, auto-deleted in 24 hours. No permanent storage.',
              },
              {
                t: 'Plain-language AI',
                d: 'Three reading levels — basic, intermediate, or clinical.',
              },
              {
                t: 'Audio playback',
                d: 'Listen to any explanation via your browser speech engine.',
              },
              {
                t: 'Optional cursor tracking',
                d: 'See which sections you dwelled on. No camera required.',
              },
            ].map((item) => (
              <li key={item.t} className="flex gap-4">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-teal-500 text-white">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{item.t}</p>
                  <p className="text-xs text-ink-muted">{item.d}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-2xl border border-sand-200 bg-canvas-card/60 p-4">
            <p className="text-xs italic text-ink-muted">
              "I finally understood my CBC panel without spending an hour on
              Google."
            </p>
            <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted/70">
              — Educational use only, not medical advice
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
