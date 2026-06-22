import { useCallback, useEffect, useRef, useState } from 'react';
import type { GazePoint } from '../types';

interface UseEyeTrackingOptions {
  enabled: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  pageNumber: number;
  onBatchReady?: (points: GazePoint[]) => void;
  onDwell?: (point: { x: number; y: number; target: HTMLElement | null }) => void;
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
  const [currentGaze, setCurrentGaze] = useState<{ x: number; y: number } | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);

  const gazeBuffer = useRef<GazePoint[]>([]);
  const dwellStart = useRef<{ x: number; y: number; time: number; target: HTMLElement | null } | null>(null);
  const isCleaningUp = useRef(false);

  // Ref to always hold the latest onDwell callback without forcing
  // startTracking to be recreated on every render.
  const onDwellRef = useRef(onDwell);
  useEffect(() => {
    onDwellRef.current = onDwell;
  });

  const normalizeGaze = useCallback(
    (screenX: number, screenY: number) => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = (screenX - rect.left) / rect.width;
      const y = (screenY - rect.top) / rect.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return null;
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
              x: dwellStart.current.x,
              y: dwellStart.current.y,
              duration_ms: duration,
            });
            onDwellRef.current?.({
              x: dwellStart.current.x,
              y: dwellStart.current.y,
              target: dwellStart.current.target,
            });
          }
        }
        dwellStart.current = null;
        setCurrentGaze(null);
        return;
      }

      setCurrentGaze(normalized);

      // If no dwell in progress, start one.
      if (!dwellStart.current) {
        dwellStart.current = {
          ...normalized,
          time: now,
          target: e.target as HTMLElement,
        };
        return;
      }

      // If the mouse moved beyond the dwell radius, check if we accumulated
      // enough dwell time to fire. If yes, emit + record. Either way, reset
      // the dwell start to the current position.
      const dx = Math.abs(normalized.x - dwellStart.current.x);
      const dy = Math.abs(normalized.y - dwellStart.current.y);
      const moved = dx > DWELL_RADIUS || dy > DWELL_RADIUS;

      if (moved) {
        const duration = now - dwellStart.current.time;
        if (duration >= DWELL_THRESHOLD_MS) {
          gazeBuffer.current.push({
            page_number: pageNumber,
            x: dwellStart.current.x,
            y: dwellStart.current.y,
            duration_ms: duration,
          });
          onDwellRef.current?.({
            x: dwellStart.current.x,
            y: dwellStart.current.y,
            target: dwellStart.current.target,
          });
        }
        dwellStart.current = {
          ...normalized,
          time: now,
          target: e.target as HTMLElement,
        };
      }
      // If not moved beyond radius, do nothing — let the dwell keep
      // accumulating. This is the key fix: previously the dwell timer
      // was being implicitly reset by setCurrentGaze re-rendering.
    };

    const handleLeave = () => {
      if (dwellStart.current) {
        const duration = Date.now() - dwellStart.current.time;
        if (duration >= DWELL_THRESHOLD_MS) {
          gazeBuffer.current.push({
            page_number: pageNumber,
            x: dwellStart.current.x,
            y: dwellStart.current.y,
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
    console.info('[eye-tracking] Cursor tracking started. Hover over text to highlight sentences.');
  }, [containerRef, normalizeGaze, pageNumber]);
    // Heartbeat — checks every 200ms if the current dwell has exceeded the
  // threshold. mousemove only fires on movement, so without this heartbeat
  // a perfectly stationary mouse would never trigger the dwell callback.
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      if (!dwellStart.current) return;
      const duration = Date.now() - dwellStart.current.time;
      if (duration >= DWELL_THRESHOLD_MS) {
        // Fire the dwell callback ONCE, then reset the dwell start so we
        // don't fire again until the mouse moves to a new position.
        const point = {
          x: dwellStart.current.x,
          y: dwellStart.current.y,
          target: dwellStart.current.target,
        };
        // Push to gaze buffer too.
        gazeBuffer.current.push({
          page_number: pageNumber,
          x: point.x,
          y: point.y,
          duration_ms: duration,
        });
        onDwellRef.current?.(point);
        // Reset so we don't keep firing — user must move to a new line
        // to trigger another dwell.
        dwellStart.current = null;
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isActive, pageNumber]);

  const stopTracking = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      const handlers = (el as unknown as { _gazeHandlers?: { move: (e: MouseEvent) => void; leave: () => void } })._gazeHandlers;
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
          x: dwellStart.current.x,
          y: dwellStart.current.y,
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