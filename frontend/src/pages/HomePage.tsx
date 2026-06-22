import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function FeatureCard({
  title,
  description,
  icon,
  delay = 0,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="card-airy fade-in-up group hover:-translate-y-1 hover:shadow-soft-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600 transition-colors group-hover:bg-teal-500 group-hover:text-white">
        {icon}
      </div>
      <h3 className="mb-2 text-base font-semibold text-ink">{title}</h3>
      <p className="text-sm leading-relaxed text-ink-muted">{description}</p>
    </div>
  );
}

function MockReportCard() {
  return (
    <div className="relative">
      {/* Floating "explanation callout" behind the card */}
      <div
        className="absolute -left-6 top-12 z-10 hidden w-64 rotate-[-3deg] rounded-2xl border border-teal-200 bg-canvas-card p-4 shadow-soft-lg sm:block"
        style={{ animation: 'fade-in-up 0.6s 0.3s cubic-bezier(0.22,1,0.36,1) both' }}
      >
        <div className="mb-2 flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-white">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
            </svg>
          </span>
          <span className="eyebrow text-[10px]">AI · Plain English</span>
        </div>
        <p className="text-xs leading-relaxed text-ink-soft">
          <strong className="text-ink">"Hemoglobin 9.2 g/dL"</strong> means your
          blood has fewer oxygen-carrying cells than usual. This often causes
          tiredness — your doctor may suggest iron-rich foods or a supplement.
        </p>
      </div>

      {/* The "report" card */}
      <div
        className="relative ml-auto w-full max-w-md rotate-[1.5deg] rounded-2xl border border-sand-200 bg-canvas-card p-6 shadow-soft-lg transition-transform duration-500 hover:rotate-0 sm:ml-12"
        style={{ animation: 'fade-in-up 0.6s 0.1s cubic-bezier(0.22,1,0.36,1) both' }}
      >
        <div className="mb-4 flex items-center justify-between border-b border-sand-200 pb-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted/70">
              Lab Report · CBC
            </p>
            <p className="font-serif text-base font-semibold text-ink">
              Complete Blood Count
            </p>
          </div>
          <span className="rounded-full bg-success-50 px-2.5 py-1 text-[10px] font-semibold text-success-700">
            Normal range
          </span>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Hemoglobin', value: '9.2', unit: 'g/dL', range: '13.5–17.5', flag: 'low' },
            { label: 'WBC', value: '6.4', unit: 'K/µL', range: '4.5–11.0', flag: 'ok' },
            { label: 'Platelets', value: '248', unit: 'K/µL', range: '150–400', flag: 'ok' },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-lg bg-canvas-subtle px-3 py-2"
            >
              <div>
                <p className="text-xs font-medium text-ink">{row.label}</p>
                <p className="text-[10px] text-ink-muted">Ref: {row.range}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="tnum text-sm font-semibold text-ink">
                  {row.value}
                  <span className="ml-1 text-[10px] font-normal text-ink-muted">
                    {row.unit}
                  </span>
                </span>
                <span
                  className={`flex h-2 w-2 rounded-full ${
                    row.flag === 'low' ? 'bg-clay-500 animate-pulse-soft' : 'bg-teal-500'
                  }`}
                  title={row.flag === 'low' ? 'Below reference range' : 'In range'}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-sand-200 pt-3 text-[10px] text-ink-muted">
          <svg viewBox="0 0 24 24" className="h-3 w-3 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Encrypted · Auto-deletes in 24h
        </div>
      </div>
    </div>
  );
}

function TrustBadges() {
  const badges = [
    'Encrypted at rest',
    'Auto-deleted in 24h',
    'No video stored',
    'HIPAA-style controls',
    'Local eye tracking',
    'No public URLs',
  ];
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {badges.map((badge) => (
        <span key={badge} className="trust-badge">
          <svg viewBox="0 0 24 24" className="h-3 w-3 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {badge}
        </span>
      ))}
    </div>
  );
}

export function HomePage() {
  const { user } = useAuth();

  return (
    <div>
      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-teal-50/40 via-canvas to-canvas" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="fade-in-up">
            <span className="eyebrow mb-5 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/60 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              Privacy-first medical AI
            </span>

            <h1 className="mb-5 font-serif text-display-lg text-ink">
              Understand your medical report in{' '}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10 text-teal-600">plain English.</span>
                <span className="absolute inset-x-0 bottom-1 z-0 h-3 bg-teal-200/60" aria-hidden="true" />
              </span>
            </h1>

            <p className="mb-8 max-w-xl text-lg leading-relaxed text-ink-muted">
              Upload a lab report or imaging result. Get plain-language
              explanations at the reading level you choose — basic,
              intermediate, or clinical. Optional eye-tracking finds the
              sections you stare at. Everything is encrypted and auto-deleted
              within 24 hours.
            </p>

            <div className="mb-8 flex flex-wrap items-center gap-3">
              {user ? (
                <Link to="/dashboard" className="btn-primary btn-lg">
                  Go to your dashboard
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn-primary btn-lg">
                    Get started — free
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>
                  <Link to="/login" className="btn-secondary btn-lg">
                    Sign in
                  </Link>
                </>
              )}
            </div>

            <TrustBadges />
          </div>

          <div className="relative">
            <MockReportCard />
          </div>
        </div>
      </section>

      {/* ---------- DISCLAIMER STRIP ---------- */}
      <section className="border-y border-sand-200 bg-canvas-subtle/50">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <p className="text-center text-sm italic text-ink-muted">
            <span className="font-medium text-ink">Educational only.</span>{' '}
            MedExplain AI does not provide medical advice, diagnosis, or
            treatment. Always consult a qualified healthcare provider.
          </p>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-14 text-center">
          <span className="eyebrow mb-3 block">How it works</span>
          <h2 className="mb-4 font-serif text-display-md text-ink">
            Three calm steps to clarity
          </h2>
          <p className="mx-auto max-w-2xl text-base text-ink-muted">
            No jargon. No data shared. No long-term storage. Just an AI reading
            partner that meets you where you are.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            delay={0}
            title="Upload securely"
            description="Drop a PDF or image. Files are virus-scanned, encrypted, and automatically deleted within 24 hours — no permanent storage, no sharing."
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            }
          />
          <FeatureCard
            delay={80}
            title="Select & explain"
            description="Highlight any sentence or click a section. Get a plain-language explanation at the reading level you choose — basic, intermediate, or clinical."
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
              </svg>
            }
          />
                    <FeatureCard
            delay={160}
            title="Listen or track focus"
            description="Have explanations read aloud. Optionally enable cursor tracking to surface the sections you dwelled on — no camera, fully private."
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                <path d="M13 13l6 6" />
              </svg>
            }
          />
        </div>
      </section>

      {/* ---------- PRIVACY SECTION ---------- */}
      <section className="border-t border-sand-200 bg-canvas-subtle/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="eyebrow mb-3 block">Privacy by default</span>
              <h2 className="mb-5 font-serif text-display-md text-ink">
                Built for anxious patients, not data harvesting.
              </h2>
              <p className="mb-6 text-base leading-relaxed text-ink-muted">
                Medical reports are some of the most sensitive documents a
                person owns. MedExplain AI was designed around that fact from
                day one — encryption at rest, virus scanning, automatic
                deletion, and no sharing or public URLs. Webcam eye tracking,
                when you opt in, runs locally in your browser.
              </p>
              <ul className="space-y-3">
                {[
                  'Encrypted at rest with rotating Fernet keys',
                  'Auto-deleted 24 hours after upload',
                  'Webcam video never recorded or stored',
                  'Only anonymized gaze coordinates saved (optional)',
                  'No report sharing or public URLs',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-teal-50 text-teal-600">
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span className="text-sm text-ink-soft">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card-airy">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-50 text-success-700">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </span>
                <p className="font-serif text-lg font-semibold text-ink">
                  Your data lifecycle
                </p>
              </div>
              <ol className="space-y-4">
                {[
                  { t: 'Upload', d: 'TLS in transit, virus scan, Fernet encryption' },
                  { t: 'Read', d: 'Stored encrypted; only your session can read it' },
                  { t: 'Listen', d: 'Audio synthesized locally via Web Speech API' },
                  { t: 'Expire', d: 'Auto-deleted 24 hours after upload — no backups' },
                ].map((step, i) => (
                  <li key={step.t} className="flex gap-4">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-teal-200 bg-canvas-card text-xs font-semibold text-teal-600">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-ink">{step.t}</p>
                      <p className="text-xs text-ink-muted">{step.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
        <h2 className="mb-4 font-serif text-display-md text-ink">
          Ready to read your report with confidence?
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-base text-ink-muted">
          Upload your report and get your first plain-language explanation in
          under a minute.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <Link to="/dashboard" className="btn-primary btn-lg">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn-primary btn-lg">
                Get started — free
              </Link>
              <Link to="/login" className="btn-secondary btn-lg">
                I already have an account
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
