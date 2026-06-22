import { useState } from 'react';
import { api, ApiError } from '../api/client';

export function PrivacyControls() {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClearAll = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.clearAllData();
      setMessage(res.message);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Deletion failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-airy border-amber-200 bg-warning-50/30">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning-50 text-warning-700">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </span>
        <div>
          <h3 className="font-serif text-base font-semibold text-ink">
            Privacy controls
          </h3>
          <p className="text-xs text-ink-muted">
            Your data lifecycle — and how to wipe it on demand.
          </p>
        </div>
      </div>

      <ul className="mb-5 grid gap-2.5 text-sm text-ink-soft sm:grid-cols-2">
        {[
          'Encrypted at rest, auto-deleted in 24h',
          'No camera or webcam required',
          'Only anonymized gaze coords saved (optional)',
          'No report sharing or public URLs',
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-none text-teal-600" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {item}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3 border-t border-sand-200 pt-4">
        {!confirming ? (
          <>
            <button
              onClick={() => setConfirming(true)}
              className="btn-danger btn-sm"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete all my data now
            </button>
            <p className="text-xs text-ink-muted">
              Wipes every report, explanation, and gaze point — immediately.
            </p>
          </>
        ) : (
          <div className="w-full space-y-3">
            <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
              <p className="text-sm font-medium text-danger-700">
                This permanently deletes all reports, explanations, and gaze data.
              </p>
              <p className="mt-1 text-xs text-danger-700/80">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleClearAll}
                disabled={loading}
                className="btn-danger btn-sm"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-danger-600/40 border-t-danger-700" />
                    Deleting…
                  </>
                ) : (
                  'Confirm deletion'
                )}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {message && (
        <div
          className="mt-3 flex items-center gap-2 rounded-xl border border-success-600/30 bg-success-50 px-4 py-2.5 text-sm text-success-700 fade-in"
          role="status"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {message}
        </div>
      )}
      {error && (
        <div
          className="mt-3 flex items-center gap-2 rounded-xl border border-danger-200 bg-danger-50 px-4 py-2.5 text-sm text-danger-700 fade-in"
          role="alert"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
