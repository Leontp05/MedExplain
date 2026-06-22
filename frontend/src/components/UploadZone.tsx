import { useCallback, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import { validateUploadFile } from '../utils/validation';

interface UploadZoneProps {
  onUploaded: (reportId: string) => void;
}

export function UploadZone({ onUploaded }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError('');
      const validation = validateUploadFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        return;
      }

      setUploading(true);
      setProgress(0);

      // Fake incremental progress while we wait on the network — gives the
      // user visible feedback that something is happening during larger uploads.
      const tick = setInterval(() => {
        setProgress((p) => Math.min(p + 6, 90));
      }, 120);

      try {
        const report = await api.uploadReport(file);
        setProgress(100);
        setTimeout(() => onUploaded(report.id), 200);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Upload failed');
      } finally {
        clearInterval(tick);
        setUploading(false);
      }
    },
    [onUploaded],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold text-ink">
          Upload a report
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="trust-badge">PDF</span>
          <span className="trust-badge">JPG</span>
          <span className="trust-badge">PNG</span>
          <span className="trust-badge">≤ 10 MB</span>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !uploading && inputRef.current?.click()}
        className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
          uploading
            ? 'border-teal-300 bg-teal-50/40 cursor-wait'
            : dragging
            ? 'border-teal-500 bg-teal-50 scale-[1.01] shadow-soft'
            : 'border-sand-200 bg-canvas-card hover:border-teal-300 hover:bg-canvas-raised'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-14 w-14 text-teal-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="absolute inset-0 animate-ping rounded-full bg-teal-500/20" />
            </div>
            <div className="w-full max-w-xs">
              <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
                <span>Uploading & scanning…</span>
                <span className="tnum font-medium text-teal-700">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-sand-200">
                <div
                  className="h-full bg-teal-500 transition-all duration-200 ease-out-soft"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div
              className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 ${
                dragging
                  ? 'bg-teal-500 text-white scale-110'
                  : 'bg-teal-50 text-teal-600 group-hover:bg-teal-100'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="font-serif text-base font-medium text-ink">
              {dragging ? 'Drop to upload' : 'Drop your medical report here'}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              or <span className="font-medium text-teal-600 underline-offset-2 group-hover:underline">browse your files</span>
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-[10px] text-ink-muted/70">
              <svg viewBox="0 0 24 24" className="h-3 w-3 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Encrypted in transit · virus scanned · auto-deleted in 24h
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          className="mt-3 flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 fade-in"
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
    </div>
  );
}
