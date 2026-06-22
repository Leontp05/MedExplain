import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { UploadZone } from '../components/UploadZone';
import { PrivacyControls } from '../components/PrivacyControls';
import type { Report } from '../types';

function ReportRow({ report, onDelete }: { report: Report; onDelete: (id: string) => void }) {
  const date = new Date(report.created_at);
  const sizeKb = report.file_size / 1024;
  const sizeLabel = sizeKb < 1024 ? `${sizeKb.toFixed(1)} KB` : `${(sizeKb / 1024).toFixed(1)} MB`;

  const statusBadge =
    report.status === 'ready' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-medium text-success-700">
        <span className="h-1.5 w-1.5 rounded-full bg-success-600" /> Ready
      </span>
    ) : report.status === 'processing' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-medium text-warning-700">
        <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-warning-600" /> Processing
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-canvas-subtle px-2 py-0.5 text-[10px] font-medium text-ink-muted">
        {report.status}
      </span>
    );

  return (
    <li className="group relative flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-canvas-raised">
      <Link to={`/report/${report.id}`} className="flex flex-1 items-center gap-4">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-sand-200 bg-canvas-card text-ink-muted transition-colors group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-600">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="13" y2="17" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink group-hover:text-teal-700">
            {report.original_filename}
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted tnum">
            <span>{sizeLabel}</span>
            <span className="h-1 w-1 rounded-full bg-ink-muted/40" />
            <span>
              {date.toLocaleDateString(undefined, {
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
      </Link>
      <div className="flex items-center gap-3">
        {statusBadge}
        <button
          onClick={() => onDelete(report.id)}
          className="rounded-lg p-2 text-ink-muted/60 opacity-0 transition-all hover:bg-danger-50 hover:text-danger-600 focus:opacity-100 group-hover:opacity-100"
          title="Delete report"
          aria-label={`Delete ${report.original_filename}`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </li>
  );
}

function ReportRowSkeleton() {
  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <div className="skeleton h-11 w-11 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3.5 w-1/2" />
        <div className="skeleton h-2.5 w-1/3" />
      </div>
      <div className="skeleton h-5 w-16 rounded-full" />
    </li>
  );
}

function EmptyState() {
  return (
    <div className="card-airy flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="13" x2="12" y2="17" />
          <line x1="10" y1="15" x2="14" y2="15" />
        </svg>
      </div>
      <h3 className="mb-2 font-serif text-xl font-semibold text-ink">
        No reports yet
      </h3>
      <p className="mb-1 max-w-sm text-sm text-ink-muted">
        Upload a PDF lab report or imaging result to get your first
        plain-language explanation.
      </p>
      <p className="mb-6 text-xs text-ink-muted/70">
        Files are encrypted and auto-deleted within 24 hours.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="trust-badge">PDF · JPG · PNG</span>
        <span className="trust-badge">Up to 10 MB</span>
        <span className="trust-badge">Virus scanned</span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReports = () => {
    api
      .listReports()
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this report and all associated data?')) return;
    try {
      await api.deleteReport(id);
      setReports((r) => r.filter((rep) => rep.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow mb-2 block">Dashboard</span>
          <h1 className="font-serif text-display-md text-ink">Your reports</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Upload, read, and explain medical reports — encrypted, private,
            auto-deleted.
          </p>
        </div>
        {!loading && reports.length > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-sand-200 bg-canvas-card px-3 py-1.5 text-xs text-ink-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            {reports.length} report{reports.length === 1 ? '' : 's'} ·{' '}
            <span className="font-medium text-ink">
              oldest auto-deletes in 24h
            </span>
          </div>
        )}
      </div>

      {/* Upload zone */}
      <div className="mb-10">
        <UploadZone
          onUploaded={(id) => {
            loadReports();
            navigate(`/report/${id}`);
          }}
        />
      </div>

      {/* Reports list */}
      {loading ? (
        <div className="card overflow-hidden p-0">
          <div className="border-b border-sand-200 px-5 py-3">
            <div className="skeleton h-4 w-32" />
          </div>
          <ul className="divide-y divide-sand-200/70">
            <ReportRowSkeleton />
            <ReportRowSkeleton />
            <ReportRowSkeleton />
          </ul>
        </div>
      ) : reports.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-sand-200 px-5 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Recent reports
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-ink-muted/70">
              Click a row to open
            </span>
          </div>
          <ul className="divide-y divide-sand-200/70">
            {reports.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Privacy controls */}
      <div className="mt-10">
        <PrivacyControls />
      </div>
    </div>
  );
}
