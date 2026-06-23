import { useCallback, useEffect, useRef, useState } from 'react';
import type { GazePoint } from '../types';

interface UseEyeTrackingOptions {
  enabled: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  pageNumber: number;
  onBatchReady?: (points: GazePoint[]) => void;
  onDwell?: (point: {
    x: number;
    y: number;
    clientX: number;
    clientY: number;
    target: HTMLElement | null;
  }) => void;
}

const DWELL_THRESHOLD_MS = 1000;
const BATCH_INTERVAL_MS = 5000;
const DWELL_RADIUS = 0.04;

export function useEyeTracking({
  enabled,
  containerRef,
  pageNumber,
  onBatchReady,
  onDwell,
}: UseEyeTrackingOptions) {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Store BOTH viewport coords (for the dot, scroll-proof via position:fixed)
  // and normalized coords (for gaze buffer / heatmap).
  const [currentGaze, setCurrentGaze] = useState<{
    clientX: number;
    clientY: number;
    normalizedX: number;
    normalizedY: number;
  } | null>(null);

  const gazeBuffer = useRef<GazePoint[]>([]);
  const dwellStart = useRef<{
    clientX: number;
    clientY: number;
    normalizedX: number;
    normalizedY: number;
    time: number;
  } | null>(null);
  const isCleaningUp = useRef(false);

  const onDwellRef = useRef(onDwell);
  useEffect(() => {
    onDwellRef.current = onDwell;
  });

  // --------------------------------------------------------------------------
  // normalizeGaze — returns clamped [0,1] coords as long as the cursor is
  // anywhere inside the container's visible viewport (including padding).
  // Returns null only when the cursor is truly outside the container.
  // --------------------------------------------------------------------------
  const normalizeGaze = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();

      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return null;
      }

      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      return { x, y };
    },
    [containerRef],
  );

  const completeCalibration = useCallback(() => {
    setIsCalibrating(false);
  }, []);

  const startTracking = useCallback(async () => {
    setError(null);
    const el = containerRef.current;
    if (!el) {
      setError('Report container not ready. Try again in a moment.');
      return;
    }

    const handleMove = (e: MouseEvent) => {
      const normalized = normalizeGaze(e.clientX, e.clientY);
      const now = Date.now();

      if (!normalized) {
        // Mouse left the container — finalize any dwell.
        if (dwellStart.current) {
          const duration = now - dwellStart.current.time;
          if (duration >= DWELL_THRESHOLD_MS) {
            gazeBuffer.current.push({
              page_number: pageNumber,
              x: dwellStart.current.normalizedX,
              y: dwellStart.current.normalizedY,
              duration_ms: duration,
            });
            const targetNow = document.elementFromPoint(
              dwellStart.current.clientX,
              dwellStart.current.clientY,
            ) as HTMLElement | null;
            onDwellRef.current?.({
              x: dwellStart.current.normalizedX,
              y: dwellStart.current.normalizedY,
              clientX: dwellStart.current.clientX,
              clientY: dwellStart.current.clientY,
              target: targetNow,
            });
          }
        }
        dwellStart.current = null;
        setCurrentGaze(null);
        return;
      }

      setCurrentGaze({
        clientX: e.clientX,
        clientY: e.clientY,
        normalizedX: normalized.x,
        normalizedY: normalized.y,
      });

      if (!dwellStart.current) {
        dwellStart.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          normalizedX: normalized.x,
          normalizedY: normalized.y,
          time: now,
        };
        return;
      }

      const dx = Math.abs(normalized.x - dwellStart.current.normalizedX);
      const dy = Math.abs(normalized.y - dwellStart.current.normalizedY);
      const moved = dx > DWELL_RADIUS || dy > DWELL_RADIUS;

      if (moved) {
        const duration = now - dwellStart.current.time;
        if (duration >= DWELL_THRESHOLD_MS) {
          gazeBuffer.current.push({
            page_number: pageNumber,
            x: dwellStart.current.normalizedX,
            y: dwellStart.current.normalizedY,
            duration_ms: duration,
          });
          const targetNow = document.elementFromPoint(
            dwellStart.current.clientX,
            dwellStart.current.clientY,
          ) as HTMLElement | null;
          onDwellRef.current?.({
            x: dwellStart.current.normalizedX,
            y: dwellStart.current.normalizedY,
            clientX: dwellStart.current.clientX,
            clientY: dwellStart.current.clientY,
            target: targetNow,
          });
        }
        dwellStart.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          normalizedX: normalized.x,
          normalizedY: normalized.y,
          time: now,
        };
      }
    };

    const handleLeave = () => {
      if (dwellStart.current) {
        const duration = Date.now() - dwellStart.current.time;
        if (duration >= DWELL_THRESHOLD_MS) {
          gazeBuffer.current.push({
            page_number: pageNumber,
            x: dwellStart.current.normalizedX,
            y: dwellStart.current.normalizedY,
            duration_ms: duration,
          });
        }
        dwellStart.current = null;
      }
      setCurrentGaze(null);
    };

    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', handleLeave);
    (el as unknown as { _gazeHandlers?: { move: typeof handleMove; leave: typeof handleLeave } })._gazeHandlers = {
      move: handleMove,
      leave: handleLeave,
    };

    setIsActive(true);
    console.info('[eye-tracking] Cursor tracking started.');
  }, [containerRef, normalizeGaze, pageNumber]);

  // Heartbeat — fires onDwell when dwell threshold is reached, even if the
  // mouse is perfectly stationary. Resolves target via elementFromPoint AT
  // HEARTBEAT TIME so it's never stale (key fix for scroll drift).
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      if (!dwellStart.current) return;
      const duration = Date.now() - dwellStart.current.time;
      if (duration >= DWELL_THRESHOLD_MS) {
        const point = {
          x: dwellStart.current.normalizedX,
          y: dwellStart.current.normalizedY,
          clientX: dwellStart.current.clientX,
          clientY: dwellStart.current.clientY,
        };
        gazeBuffer.current.push({
          page_number: pageNumber,
          x: point.x,
          y: point.y,
          duration_ms: duration,
        });
        const target = document.elementFromPoint(
          point.clientX,
          point.clientY,
        ) as HTMLElement | null;
        onDwellRef.current?.({ ...point, target });
        dwellStart.current = null;
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isActive, pageNumber]);

  const stopTracking = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      const handlers = (
        el as unknown as {
          _gazeHandlers?: { move: (e: MouseEvent) => void; leave: () => void };
        }
      )._gazeHandlers;
      if (handlers) {
        el.removeEventListener('mousemove', handlers.move);
        el.removeEventListener('mouseleave', handlers.leave);
        delete (el as unknown as { _gazeHandlers?: unknown })._gazeHandlers;
      }
    }

    if (dwellStart.current) {
      const duration = Date.now() - dwellStart.current.time;
      if (duration >= DWELL_THRESHOLD_MS) {
        gazeBuffer.current.push({
          page_number: pageNumber,
          x: dwellStart.current.normalizedX,
          y: dwellStart.current.normalizedY,
          duration_ms: duration,
        });
      }
      dwellStart.current = null;
    }

    setIsActive(false);
    setIsCalibrating(false);
    setCurrentGaze(null);
  }, [containerRef, pageNumber]);

  useEffect(() => {
    if (!enabled && isActive) {
      stopTracking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!isActive || !onBatchReady) return;
    const interval = setInterval(() => {
      if (gazeBuffer.current.length > 0) {
        onBatchReady([...gazeBuffer.current]);
        gazeBuffer.current = [];
      }
    }, BATCH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isActive, onBatchReady]);

  useEffect(() => {
    return () => {
      if (isCleaningUp.current) return;
      isCleaningUp.current = true;
      stopTracking();
    };
  }, [stopTracking]);

  return {
    isActive,
    isCalibrating,
    error,
    currentGaze,
    startTracking,
    stopTracking,
    completeCalibration,
  };
}