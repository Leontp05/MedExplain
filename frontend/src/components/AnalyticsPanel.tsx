import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AnalyticsData } from '../types';

interface Props {
  reportId: string;
}

export function AnalyticsPanel({ reportId }: Props) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAnalytics(reportId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [reportId]);

  if (loading) {
    return (
      <div className="card-airy space-y-4">
        <div className="skeleton h-5 w-32" />
        <div className="skeleton h-20 w-full" />
        <div className="skeleton h-20 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card-airy text-center text-sm text-ink-muted">
        Analytics unavailable. Start cursor tracking and request some explanations to see insights here.
      </div>
    );
  }

  const maxVisits = Math.max(...data.top_viewed_sections.map((s) => s.visit_count), 1);
  const maxExplanations = Math.max(...data.top_explained_terms.map((s) => s.explanation_count), 1);

  return (
    <div className="card-airy space-y-6">
      {/* Header */}
      <div>
        <span className="eyebrow mb-2 block">Reading analytics</span>
        <h3 className="font-serif text-lg font-semibold text-ink">
          How you read this report
        </h3>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-teal-50/50 p-4">
          <p className="text-2xl font-serif font-semibold text-teal-700 tnum">
            {data.total_views}
          </p>
          <p className="text-xs text-ink-muted">total gaze points recorded</p>
        </div>
        <div className="rounded-xl bg-red-50/50 p-4">
          <p className="text-2xl font-serif font-semibold text-red-600 tnum">
            {data.total_explanations}
          </p>
          <p className="text-xs text-ink-muted">explanations requested</p>
        </div>
      </div>

      {/* Top viewed sections */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="h-2 w-2 rounded-full bg-clay-500" />
          Most viewed sections
        </h4>
        {data.top_viewed_sections.length === 0 ? (
          <p className="text-xs text-ink-muted">No gaze data yet. Enable cursor tracking and read the report.</p>
        ) : (
          <div className="space-y-2">
            {data.top_viewed_sections.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-clay-50 text-[10px] font-semibold text-clay-500">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-ink">{s.label}</p>
                    <span className="text-xs text-ink-muted tnum flex-none">
                      {s.visit_count} visit{s.visit_count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand-200">
                    <div
                      className="h-full bg-clay-500 transition-all duration-500"
                      style={{ width: `${(s.visit_count / maxVisits) * 100}%` }}
                    />
                  </div>
                </div>
                {s.explanation_count > 0 && (
                  <span className="flex-none rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                    {s.explanation_count} explained
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top explained terms */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="h-2 w-2 rounded-full bg-red-600" />
          Most explained terms
        </h4>
        {data.top_explained_terms.length === 0 ? (
          <p className="text-xs text-ink-muted">No explanations yet. Select confusing text and click "Explain".</p>
        ) : (
          <div className="space-y-2">
            {data.top_explained_terms.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-red-50 text-[10px] font-semibold text-red-600">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-ink" title={s.label}>
                      "{s.label}"
                    </p>
                    <span className="text-xs text-ink-muted tnum flex-none">
                      ×{s.explanation_count}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand-200">
                    <div
                      className="h-full bg-red-600 transition-all duration-500"
                      style={{ width: `${(s.explanation_count / maxExplanations) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="border-t border-sand-200 pt-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted">
          Heatmap legend
        </p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-clay-400/60" />
            Viewed (orange = looked at)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-600" />
            Explained (red = clicked "Explain this")
          </span>
        </div>
      </div>
    </div>
  );
}