import { useState } from 'react';

const POINTS = [
  { x: 15, y: 15 },
  { x: 50, y: 15 },
  { x: 85, y: 15 },
  { x: 15, y: 50 },
  { x: 50, y: 50 },
  { x: 85, y: 50 },
  { x: 15, y: 85 },
  { x: 50, y: 85 },
  { x: 85, y: 85 },
];

const CLICKS_PER_POINT = 5;

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

export function CalibrationOverlay({ onComplete, onCancel }: Props) {
  const [currentPoint, setCurrentPoint] = useState(0);
  const [clicks, setClicks] = useState(0);

  const handleClick = () => {
    if (clicks + 1 >= CLICKS_PER_POINT) {
      if (currentPoint + 1 >= POINTS.length) {
        onComplete();
        return;
      }
      setCurrentPoint((p) => p + 1);
      setClicks(0);
    } else {
      setClicks((c) => c + 1);
    }
  };

  const point = POINTS[currentPoint];
  const totalClicks = currentPoint * CLICKS_PER_POINT + clicks + 1;
  const totalClicksNeeded = POINTS.length * CLICKS_PER_POINT;
  const progress = (totalClicks / totalClicksNeeded) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm">
      {/* Top progress bar */}
      <div className="absolute left-1/2 top-6 w-80 max-w-[90vw] -translate-x-1/2 rounded-2xl bg-canvas-card p-4 shadow-soft-lg">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-ink">Calibrating eye tracker</span>
          <span className="text-ink-muted tnum">
            Point {currentPoint + 1} / {POINTS.length}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-sand-200">
          <div
            className="h-full bg-teal-500 transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-ink-muted">
          Look directly at the pulsing dot, then click it {CLICKS_PER_POINT} times. Repeat for all 9 dots.
        </p>
      </div>

      {/* The active calibration dot */}
      <button
        onClick={handleClick}
        className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full bg-teal-500 text-white shadow-soft-lg transition-transform hover:scale-110"
        style={{ left: `${point.x}%`, top: `${point.y}%` }}
        aria-label={`Calibration point ${currentPoint + 1}, click ${clicks + 1} of ${CLICKS_PER_POINT}`}
      >
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
          {clicks + 1}
        </span>
        {/* Pulsing ring */}
        <span className="absolute inset-0 animate-ping rounded-full bg-teal-500/40" />
      </button>

      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-sand-200 bg-canvas-card px-4 py-2 text-xs text-ink-muted shadow-soft hover:bg-canvas-raised"
      >
        Cancel calibration
      </button>
    </div>
  );
}