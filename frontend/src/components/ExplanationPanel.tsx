import type { Explanation, ReadingLevel } from '../types';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { DISCLAIMER } from '../types';

interface ExplanationPanelProps {
  explanation: Explanation | null;
  loading: boolean;
  readingLevel: ReadingLevel;
  onLevelChange: (level: ReadingLevel) => void;
  onExplain: () => void;
  selectedText: string;
}

const LEVELS: { value: ReadingLevel; label: string; sub: string }[] = [
  { value: 'basic', label: 'Basic', sub: 'Plain English' },
  { value: 'intermediate', label: 'Intermediate', sub: 'Some terms' },
  { value: 'medical', label: 'Clinical', sub: 'Full detail' },
];

function SkeletonExplanation() {
  return (
    <div className="space-y-3">
      <div className="skeleton h-3.5 w-full" />
      <div className="skeleton h-3.5 w-11/12" />
      <div className="skeleton h-3.5 w-4/5" />
      <div className="skeleton h-3.5 w-full" />
      <div className="skeleton h-3.5 w-3/4" />
    </div>
  );
}

export function ExplanationPanel({
  explanation,
  loading,
  readingLevel,
  onLevelChange,
  onExplain,
  selectedText,
}: ExplanationPanelProps) {
  const { speak, stop, isSpeaking } = useTextToSpeech();

  return (
    <div className="card sticky top-24 flex h-full max-h-[calc(100vh-7rem)] flex-col p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
            </svg>
          </span>
          <h3 className="font-serif text-base font-semibold text-ink">
            AI Explanation
          </h3>
        </div>
        {explanation && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
            {explanation.reading_level}
          </span>
        )}
      </div>

      {/* Reading-level toggle */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-ink-muted">
          Reading level
        </label>
        <div className="pill-group w-full">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              onClick={() => onLevelChange(l.value)}
              className={`pill flex-1 ${readingLevel === l.value ? 'pill-active' : ''}`}
            >
              <span className="block text-xs font-medium">{l.label}</span>
              <span className="block text-[9px] text-ink-muted">{l.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected text preview */}
      {selectedText ? (
        <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/50 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-teal-700">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 21l3-3h13a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16z" />
            </svg>
            Selected text
          </p>
          <p className="line-clamp-3 text-xs leading-relaxed text-ink-soft">
            "{selectedText}"
          </p>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-dashed border-sand-200 bg-canvas-subtle/40 p-4 text-center">
          <p className="text-xs text-ink-muted">
            Highlight any sentence in the report — or click a section — to get
            a plain-language explanation.
          </p>
        </div>
      )}

      {/* Action button */}
      <button
        onClick={onExplain}
        disabled={!selectedText || loading}
        className="btn-primary mb-4 w-full"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Generating…
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
            </svg>
            Explain selection
          </>
        )}
      </button>

      {/* Explanation output */}
      {loading && !explanation ? (
        <div className="flex-1 overflow-auto">
          <SkeletonExplanation />
        </div>
      ) : explanation ? (
        <div className="flex-1 overflow-auto pr-1">
          <div className="rounded-xl border border-sand-200 bg-canvas-card p-4">
            <p className="prose-explanation whitespace-pre-wrap">
              {explanation.explanation_text}
            </p>
            <div className="mt-4 flex items-start gap-2 border-t border-sand-200 pt-3">
              <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 flex-none text-warning-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-[11px] italic leading-relaxed text-warning-700">
                {explanation.disclaimer || DISCLAIMER}
              </p>
            </div>
          </div>

          {/* Audio controls */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => speak(explanation.explanation_text)}
              disabled={isSpeaking}
              className="btn-secondary flex-1 text-xs"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
              {isSpeaking ? 'Playing…' : 'Listen'}
            </button>
            {isSpeaking && (
              <button onClick={stop} className="btn-secondary text-xs">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                Stop
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
