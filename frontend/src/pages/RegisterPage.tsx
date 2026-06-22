import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, ApiError } from '../context/AuthContext';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', test: (p: string) => p.length >= 8 },
    { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Number', test: (p: string) => /\d/.test(p) },
    { label: 'Symbol', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  ];
  const score = checks.filter((c) => c.test(password)).length;
  const scoreLabel = ['Weak', 'Fair', 'Good', 'Strong', 'Excellent'][score];
  const scoreColor = ['bg-clay-500', 'bg-clay-400', 'bg-warning-600', 'bg-teal-500', 'bg-teal-600'][score];

  return (
    <div className="mt-2 rounded-xl border border-sand-200 bg-canvas-subtle/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1">
          {checks.map((_, i) => (
            <div
              key={i}
              className={`h-full flex-1 rounded-full transition-colors ${
                i < score ? scoreColor : 'bg-sand-200'
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
          {scoreLabel}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-1">
        {checks.map((c) => (
          <li
            key={c.label}
            className={`flex items-center gap-1.5 text-[11px] ${
              c.test(password) ? 'text-teal-700' : 'text-ink-muted/70'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {c.test(password) ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <circle cx="12" cy="12" r="1" />
              )}
            </svg>
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await register(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-7xl items-stretch gap-0 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:py-16">
      {/* Left — form */}
      <div className="flex items-center">
        <div className="w-full max-w-md lg:mx-auto">
          <span className="eyebrow mb-4 block">Create your account</span>
          <h1 className="mb-3 font-serif text-display-sm text-ink">
            Start reading reports with clarity
          </h1>
          <p className="mb-8 text-sm text-ink-muted">
            Your email is your account identity. Reports are encrypted and
            never shared — you can delete everything with one click.
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
                minLength={8}
                autoComplete="new-password"
                className="input-field"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {password && <PasswordStrength password={password} />}
            </div>
            <div>
              <label htmlFor="confirm" className="input-label">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="input-field"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {confirm && password !== confirm && (
                <p className="mt-1.5 text-xs text-clay-500">
                  Passwords don't match yet.
                </p>
              )}
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
                  Creating account…
                </>
              ) : (
                <>
                  Create account
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-teal-600 hover:text-teal-700 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right — privacy promise panel */}
      <div className="hidden items-center lg:flex">
        <div className="w-full rounded-3xl border border-sand-200 bg-gradient-to-br from-canvas-card via-canvas-card to-teal-50/40 p-10 shadow-soft">
          <div className="mb-6 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span className="font-serif text-lg font-semibold text-ink">
              Our privacy promise
            </span>
          </div>

          <ul className="space-y-5">
            {[
              {
                t: 'Encrypted at rest',
                d: 'Files are encrypted with Fernet before they ever touch disk.',
              },
              {
                t: 'Auto-deleted in 24h',
                d: 'Reports and explanations are purged automatically — no backups.',
              },
              {
                t: 'No camera required',
                d: 'Cursor tracking identifies confusing sections — no webcam, no video.',
              },
              {
                t: 'One-click deletion',
                d: 'Wipe everything from your dashboard at any time.',
              },
              {
                t: 'No sharing, ever',
                d: 'No public URLs. No third-party data sharing. Your data is yours.',
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

          <div className="mt-8 rounded-2xl border border-amber-200 bg-warning-50/50 p-4">
            <p className="text-xs font-medium text-warning-700">
              Educational use only
            </p>
            <p className="mt-1 text-xs text-warning-700/80">
              MedExplain AI does not provide medical advice, diagnosis, or
              treatment. Always consult a qualified healthcare provider.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
