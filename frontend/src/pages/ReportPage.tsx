import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { ReportViewer } from '../components/ReportViewer';
import { ExplanationPanel } from '../components/ExplanationPanel';
import { AnalyticsPanel } from '../components/AnalyticsPanel';
import type { Explanation, ReadingLevel, Report } from '../types';

function LoadingState() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="skeleton mb-6 h-7 w-64" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="skeleton h-96 w-full rounded-2xl" />
        </div>
        <div className="space-y-4 lg:col-span-1">
          <div className="skeleton h-10 w-full rounded-xl" />
          <div className="skeleton h-64 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2 className="mb-2 font-serif text-xl font-semibold text-ink">
        We couldn't load that report
      </h2>
      <p className="mb-6 text-sm text-ink-muted">{message}</p>
      <Link to="/dashboard" className="btn-secondary">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to dashboard
      </Link>
    </div>
  );
}

function EyeTrackingCard({
  eyeTrackingEnabled,
  setEyeTrackingEnabled,
  showHeatmap,
  setShowHeatmap,
}: {
  eyeTrackingEnabled: boolean;
  setEyeTrackingEnabled: (v: boolean) => void;
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
}) {
  return (
    <div className="card-airy">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            <path d="M13 13l6 6" />
          </svg>
        </span>
        <div>
          <h3 className="font-serif text-base font-semibold text-ink">
            Cursor tracking
          </h3>
          <p className="text-xs text-ink-muted">
            Tracks where you hover to surface confusing sections. No camera required.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-sand-200 bg-canvas-card p-3 transition-colors hover:bg-canvas-raised">
          <input
            type="checkbox"
            checked={eyeTrackingEnabled}
            onChange={(e) => setEyeTrackingEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-teal-500"
          />
          <div>
            <p className="text-sm font-medium text-ink">Enable cursor tracking</p>
            <p className="text-xs text-ink-muted">
              Records where your cursor dwells to identify confusing sections of the report.
            </p>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-sand-200 bg-canvas-card p-3 transition-colors hover:bg-canvas-raised">
          <input
            type="checkbox"
            checked={showHeatmap}
            onChange={(e) => setShowHeatmap(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-teal-500"
          />
          <div>
            <p className="text-sm font-medium text-ink">Show confusion heatmap</p>
            <p className="text-xs text-ink-muted">
              Overlays your dwell patterns on the document.
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [regionBounds, setRegionBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>('basic');
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [eyeTrackingEnabled, setEyeTrackingEnabled] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .getReport(id)
      .then(setReport)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load report'),
      )
      .finally(() => setLoading(false));
  }, [id]);

  const handleExplain = async () => {
    if (!id || !selectedText) return;
    setExplaining(true);
    try {
      const result = await api.explain(id, {
        region_text: selectedText,
        reading_level: readingLevel,
        page_number: 1,
        region_bounds: regionBounds ?? undefined,
      });
      setExplanation(result);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Explanation failed');
    } finally {
      setExplaining(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Delete this report permanently?')) return;
    try {
      await api.deleteReport(id);
      window.location.href = '/dashboard';
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  if (loading) return <LoadingState />;

  if (error || !report || !id) {
    return <ErrorState message={error || 'Report not found'} />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            to="/dashboard"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to dashboard
          </Link>
          <h1 className="font-serif text-display-sm text-ink">
            {report.original_filename}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-xs text-ink-muted tnum">
            <span>{(report.file_size / 1024).toFixed(1)} KB</span>
            <span className="h-1 w-1 rounded-full bg-ink-muted/40" />
            <span>
              {new Date(report.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            {report.page_count && (
              <>
                <span className="h-1 w-1 rounded-full bg-ink-muted/40" />
                <span>{report.page_count} page{report.page_count === 1 ? '' : 's'}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleDelete} className="btn-danger btn-sm">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete report
          </button>
        </div>
      </div>

      {/* Main grid: PDF + side panel */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ReportViewer
            reportId={id}
            mimeType={report.mime_type}
            eyeTrackingEnabled={eyeTrackingEnabled}
            showHeatmap={showHeatmap}
            onTextSelect={setSelectedText}
            onRegionClick={(text, bounds) => {
              setSelectedText(text);
              setRegionBounds(bounds);
            }}
          />
          <EyeTrackingCard
            eyeTrackingEnabled={eyeTrackingEnabled}
            setEyeTrackingEnabled={setEyeTrackingEnabled}
            showHeatmap={showHeatmap}
            setShowHeatmap={setShowHeatmap}
          />
        </div>
        <div className="lg:col-span-1">
          <ExplanationPanel
            explanation={explanation}
            loading={explaining}
            readingLevel={readingLevel}
            onLevelChange={setReadingLevel}
            onExplain={handleExplain}
            selectedText={selectedText}
          />
        </div>
      </div>

      {/* Analytics dashboard */}
      <div className="mt-8">
        <AnalyticsPanel reportId={id} />
      </div>
    </div>
  );
}