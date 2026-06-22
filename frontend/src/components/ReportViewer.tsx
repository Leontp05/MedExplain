import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api } from '../api/client';
import type { ExplanationMarker, GazePoint, HeatmapPoint } from '../types';
import { useEyeTracking } from '../hooks/useEyeTracking';
import { HeatmapOverlay } from './HeatmapOverlay';
import { CalibrationOverlay } from './CalibrationOverlay';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface ReportViewerProps {
  reportId: string;
  mimeType: string;
  eyeTrackingEnabled: boolean;
  showHeatmap: boolean;
  onTextSelect: (text: string) => void;
  onRegionClick: (text: string, bounds: { x: number; y: number; width: number; height: number }) => void;
}

export function ReportViewer({
  reportId,
  mimeType,
  eyeTrackingEnabled,
  showHeatmap,
  onTextSelect,
  onRegionClick,
}: ReportViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[]>([]);
  const [explanationPoints, setExplanationPoints] = useState<ExplanationMarker[]>([]);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // Dwell popup state
  const [dwellPopup, setDwellPopup] = useState<{
    text: string;
    rect: DOMRect;
  } | null>(null);
  const highlightedSpansRef = useRef<HTMLElement[]>([]);

  const handleGazeBatch = useCallback(
    async (points: GazePoint[]) => {
      try {
        await api.recordGaze(reportId, points);
      } catch {
        /* silent — gaze is best-effort */
      }
    },
    [reportId],
  );

  const clearDwellHighlight = useCallback(() => {
    highlightedSpansRef.current.forEach((s) =>
      s.classList.remove('dwell-highlight'),
    );
    highlightedSpansRef.current = [];
    setDwellPopup(null);
  }, []);

  const handleDwell = useCallback(
    (point: { x: number; y: number; target: HTMLElement | null }) => {
      const target = point.target;
      const textLayer = textLayerRef.current;
      if (!target || !textLayer || !textLayer.contains(target)) return;

      const allSpans = Array.from(
        textLayer.querySelectorAll('span'),
      ) as HTMLElement[];
      const targetSpan = (target as HTMLElement).closest('span') as HTMLElement | null;
      if (!targetSpan) return;

      // ---- Line-based selection -----------------------------------------
      // PDF.js splits text into individual word/item spans, each absolutely
      // positioned. Spans on the same visual line share approximately the
      // same `top` value. We collect all spans whose top is within half a
      // line-height of the target span's top — that's the whole line.
      const targetTop = targetSpan.offsetTop;
      const targetHeight = targetSpan.offsetHeight || 12;
      const tolerance = targetHeight * 0.5;

      const lineSpans = allSpans.filter((span) => {
        const spanTop = span.offsetTop;
        return Math.abs(spanTop - targetTop) <= tolerance;
      });

      if (lineSpans.length === 0) return;

      // Sort left-to-right so the joined text reads in the correct order.
      lineSpans.sort((a, b) => a.offsetLeft - b.offsetLeft);

      // Join with spaces and collapse runs of whitespace.
      const lineText = lineSpans
        .map((s) => (s.textContent || '').trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!lineText) return;

      // Clear previous highlight
      clearDwellHighlight();

      // Apply new highlight to just this line's spans
      lineSpans.forEach((s) => s.classList.add('dwell-highlight'));
      highlightedSpansRef.current = lineSpans;

      // Bounding rect of the line
      const rects = lineSpans.map((s) => s.getBoundingClientRect());
      const minX = Math.min(...rects.map((r) => r.left));
      const minY = Math.min(...rects.map((r) => r.top));
      const maxX = Math.max(...rects.map((r) => r.right));
      const maxY = Math.max(...rects.map((r) => r.bottom));
      const rect = new DOMRect(minX, minY, maxX - minX, maxY - minY);

      setDwellPopup({ text: lineText, rect });
    },
    [clearDwellHighlight],
  );

  const {
    isActive,
    isCalibrating,
    error: eyeError,
    currentGaze,
    startTracking,
    stopTracking,
    completeCalibration,
  } = useEyeTracking({
    enabled: eyeTrackingEnabled,
    containerRef,
    pageNumber: page,
    onBatchReady: handleGazeBatch,
    onDwell: handleDwell,
  });

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(api.getReportContentUrl(reportId), {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to load report');

        const blob = await response.blob();

        if (mimeType === 'application/pdf') {
          const arrayBuffer = await blob.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          if (revoked) return;
          pdfDocRef.current = pdf;
          setTotalPages(pdf.numPages);
        } else {
          objectUrl = URL.createObjectURL(blob);
          if (revoked) return;
          setImageUrl(objectUrl);
          setTotalPages(1);
        }
      } catch {
        if (!revoked) setError('Unable to load report');
      } finally {
        if (!revoked) setLoading(false);
      }
    }

    load();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      pdfDocRef.current = null;
    };
  }, [reportId, mimeType]);

  useEffect(() => {
    if (mimeType !== 'application/pdf' || !pdfDocRef.current) return;

    let cancelled = false;

    async function renderPage() {
      const pdf = pdfDocRef.current;
      const canvas = canvasRef.current;
      const textLayerDiv = textLayerRef.current;
      if (!pdf || !canvas) return;

      const pdfPage = await pdf.getPage(page);
      if (cancelled) return;

      const viewport = pdfPage.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      if (cancelled) return;

      // Build an invisible HTML text layer over the canvas so users can
      // highlight and select text natively. The visible glyphs come from the
      // canvas; these transparent spans are the actual selectable surface.
      if (!textLayerDiv) return;
      textLayerDiv.innerHTML = '';
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;

      const textContent = await pdfPage.getTextContent();
      if (cancelled) return;

      for (const item of textContent.items) {
        if (!('str' in item) || !item.str) continue;
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontHeight = Math.hypot(tx[2], tx[3]);
        if (fontHeight === 0) continue;

        const span = document.createElement('span');
        span.textContent = item.str;
        span.style.left = `${tx[4]}px`;
        span.style.top = `${tx[5] - fontHeight}px`;
        span.style.fontSize = `${fontHeight}px`;
        span.style.transform = `scaleX(${tx[0] / fontHeight})`;
        textLayerDiv.appendChild(span);
      }
    }

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [page, scale, mimeType, loading]);

  useEffect(() => {
    if (!showHeatmap) {
      setHeatmapPoints([]);
      setExplanationPoints([]);
      return;
    }

    api
      .getHeatmap(reportId, page)
      .then((data) => {
        setHeatmapPoints(data.points);
        setExplanationPoints(data.explanation_points || []);
      })
      .catch(() => {
        setHeatmapPoints([]);
        setExplanationPoints([]);
      });
  }, [reportId, page, showHeatmap]);

  // ---- Manual selection handler -------------------------------------------
  // Uses the selection's own getBoundingClientRect() (browser-computed,
  // accounts for transforms on the text-layer spans) and normalizes against
  // the SCROLL CONTAINER (not the canvas — the canvas is inside an inner
  // wrapper with padding, which throws off the math).
  const handleSelectionChange = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const container = containerRef.current;
    if (!container) return;
    if (!selection.anchorNode || !container.contains(selection.anchorNode)) return;

    const text = selection.toString().trim();
    if (!text || text.length < 2) return;

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const x = Math.max(0, Math.min(1, (rect.left - containerRect.left) / containerRect.width));
    const y = Math.max(0, Math.min(1, (rect.top - containerRect.top) / containerRect.height));
    const width = Math.min(1, rect.width / containerRect.width);
    const height = Math.min(1, rect.height / containerRect.height);

    onRegionClick(text, { x, y, width, height });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-sand-200 bg-canvas-card">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-teal-200 border-t-teal-500" />
          <p className="text-sm text-ink-muted">Loading report…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-danger-200 bg-danger-50 p-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-danger-100 text-danger-700">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-sm font-medium text-danger-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-sand-200 bg-canvas-card px-3 py-2 shadow-soft-sm">
        {mimeType === 'application/pdf' && (
          <>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-ghost btn-sm"
                aria-label="Previous page"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="px-2 text-xs text-ink-muted tnum">
                <span className="font-medium text-ink">{page}</span>
                {' / '}
                {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-ghost btn-sm"
                aria-label="Next page"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
            <div className="mx-1 h-5 w-px bg-sand-200" />
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
              className="btn-ghost btn-sm"
              aria-label="Zoom out"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <button
              onClick={() => setScale((s) => Math.min(3, s + 0.2))}
              className="btn-ghost btn-sm"
              aria-label="Zoom in"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
                <line x1="11" y1="8" x2="11" y2="14" />
              </svg>
            </button>
            <span className="text-[10px] text-ink-muted tnum">
              {Math.round(scale * 100)}%
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {!isActive ? (
            <button
              onClick={startTracking}
              disabled={!eyeTrackingEnabled}
              className="btn-secondary btn-sm"
              title="Track where your cursor dwells"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                <path d="M13 13l6 6" />
              </svg>
              Start cursor tracking
            </button>
          ) : (
            <button onClick={stopTracking} className="btn-secondary btn-sm">
              <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse-soft" />
              Stop cursor tracking
            </button>
          )}
        </div>
      </div>

      {/* Calibration overlay (kept for API compat — mouse tracking never shows it) */}
      {isCalibrating && isActive && (
        <CalibrationOverlay
          onComplete={completeCalibration}
          onCancel={stopTracking}
        />
      )}

      {/* Status banners */}
      {eyeError && (
        <div className="flex items-center gap-2 rounded-xl border border-warning-200 bg-warning-50 px-4 py-2.5 text-xs text-warning-700 fade-in">
          <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {eyeError}
        </div>
      )}

      {/* The document canvas — paper-like surface */}
      <div
        ref={containerRef}
        className={`relative overflow-auto rounded-2xl border border-sand-200 bg-sage-100/40 shadow-soft-sm ${
          isActive ? 'cursor-tracking-active' : ''
        }`}
        onMouseUp={handleSelectionChange}
        style={{ maxHeight: '70vh' }}
      >
        <HeatmapOverlay
          points={heatmapPoints}
          explanationPoints={explanationPoints}
          visible={showHeatmap}
        />

        <div className="min-h-full p-6">
          {mimeType === 'application/pdf' ? (
            <div className="relative mx-auto inline-block">
              <canvas
                ref={canvasRef}
                className="block rounded-sm bg-white shadow-soft"
              />
              {/* Invisible selectable text layer — sits over the canvas so the
                  browser handles native selection + highlight. Highlight color
                  comes from .pdf-text-layer ::selection in index.css. */}
              <div ref={textLayerRef} className="pdf-text-layer" />
            </div>
          ) : (
            imageUrl && (
              <img
                src={imageUrl}
                alt="Medical report"
                className="mx-auto max-w-full rounded-sm bg-white shadow-soft"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = (e.clientX - rect.left) / rect.width;
                  const y = (e.clientY - rect.top) / rect.height;
                  onRegionClick('Selected image region', { x: x - 0.1, y: y - 0.05, width: 0.2, height: 0.1 });
                }}
              />
            )
          )}
        </div>

        {isActive && currentGaze && (
          <div
            className="pointer-events-none absolute z-20"
            style={{
              left: `${currentGaze.x * 100}%`,
              top: `${currentGaze.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Pulsing outer ring */}
            <div className="absolute inset-0 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-teal-400/20 animate-ping" />
            {/* Solid dot */}
            <div className="h-4 w-4 rounded-full bg-teal-500 shadow-soft border-2 border-white" />
          </div>
        )}
      </div>

      {/* Dwell popup — appears when cursor dwells on a sentence */}
      {dwellPopup && (
        <>
          {/* Click-away overlay */}
          <div
            className="fixed inset-0 z-30"
            onClick={clearDwellHighlight}
          />
          {/* Popup */}
          <div
            className="fixed z-40 animate-fade-in-up"
            style={{
              left: `${dwellPopup.rect.left + dwellPopup.rect.width / 2}px`,
              top: `${dwellPopup.rect.top - 16}px`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-canvas-card px-4 py-3 shadow-soft-lg">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
                  </svg>
                </span>
                <div>
                  <p className="text-xs font-medium text-ink">Confused by this?</p>
                  <p className="max-w-[200px] truncate text-[10px] text-ink-muted">
                    &ldquo;{dwellPopup.text.slice(0, 60)}{dwellPopup.text.length > 60 ? '…' : ''}&rdquo;
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const canvas = canvasRef.current;
                  if (canvas) {
                    const canvasRect = canvas.getBoundingClientRect();
                    onRegionClick(dwellPopup.text, {
                      x: (dwellPopup.rect.left - canvasRect.left) / canvasRect.width,
                      y: (dwellPopup.rect.top - canvasRect.top) / canvasRect.height,
                      width: dwellPopup.rect.width / canvasRect.width,
                      height: dwellPopup.rect.height / canvasRect.height,
                    });
                  } else {
                    onRegionClick(dwellPopup.text, {
                      x: 0.1, y: 0.1, width: 0.8, height: 0.1,
                    });
                  }
                  clearDwellHighlight();
                }}
                className="btn-primary btn-sm"
              >
                Explain this
              </button>
            </div>
            {/* Arrow pointing down */}
            <div className="mx-auto h-0 w-0 -translate-y-px border-x-4 border-t-4 border-x-transparent border-t-teal-200" style={{ width: '8px' }} />
          </div>
        </>
      )}
    </div>
  );
}