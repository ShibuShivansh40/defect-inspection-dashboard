import { useId } from 'react';
import { MIN_THRESHOLD, useUi } from '../store/ui';

/** Reject threshold: boxes below it are hidden and don't fail the frame. Keyboard-operable. */
export function ThresholdSlider({ className = '' }: { className?: string }) {
  const threshold = useUi((s) => s.threshold);
  const setThreshold = useUi((s) => s.setThreshold);
  const id = useId();
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <label htmlFor={id} className="shrink-0 text-xs font-medium text-muted">
        Reject threshold
      </label>
      <input
        id={id}
        type="range"
        min={MIN_THRESHOLD}
        max={0.99}
        step={0.01}
        value={threshold}
        onChange={(e) => setThreshold(Number(e.target.value))}
        aria-valuetext={`${Math.round(threshold * 100)} percent confidence`}
        className="w-full min-w-24 accent-accent"
      />
      <output htmlFor={id} className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
        {Math.round(threshold * 100)}%
      </output>
    </div>
  );
}
