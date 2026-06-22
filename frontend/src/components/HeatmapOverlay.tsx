import type { ExplanationMarker, HeatmapPoint } from '../types';

interface HeatmapOverlayProps {
  points: HeatmapPoint[];
  explanationPoints?: ExplanationMarker[];
  visible: boolean;
}

/**
 * Confusion heatmap with two layers:
 * - Orange circles = viewed regions (size + opacity scale with visit count)
 * - Red dots = explanation requested (user clicked "Explain this")
 *
 * Visit-count scaling:
 *   1 visit  -> faint (small, low opacity)
 *   3 visits -> medium
 *   5+ visits -> strong (larger, high opacity)
 */
export function HeatmapOverlay({ points, explanationPoints = [], visible }: HeatmapOverlayProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Layer 1: Viewed hotspots (orange/amber) */}
      {points.map((p, i) => {
        const visits = p.visits || 1;

        // Size: 1 visit = 18px, scaling up to 5+ visits = 36px
        // (reduced ~25% from previous 24-80px range)
        const size = 18 + Math.min(visits, 5) * 4.5;

        // Opacity: 1 visit = 0.25, 3 = 0.45, 5+ = 0.65
        const opacity = 0.20 + Math.min(visits, 5) * 0.09;

        return (
          <div
            key={`view-${i}`}
            className="absolute rounded-full mix-blend-multiply animate-fade-in"
            style={{
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              width: `${size}px`,
              height: `${size}px`,
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, rgba(199,113,79,${opacity}) 0%, rgba(199,113,79,${opacity * 0.4}) 50%, transparent 70%)`,
              animationDelay: `${i * 20}ms`,
            }}
          />
        );
      })}

      {/* Layer 2: Explanation markers (red) */}
      {explanationPoints.map((m, i) => (
        <div
          key={`ex-${i}`}
          className="absolute animate-fade-in"
          style={{
            left: `${m.x * 100}%`,
            top: `${m.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            animationDelay: `${i * 40}ms`,
          }}
        >
          {/* Pulsing red ring */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-red-500/30 animate-ping"
          />
          {/* Solid red dot */}
          <div
            className="h-3 w-3 rounded-full bg-red-600 border-2 border-white shadow-soft"
            title={`Explained: "${m.region_text.slice(0, 50)}..."`}
          />
        </div>
      ))}
    </div>
  );
}