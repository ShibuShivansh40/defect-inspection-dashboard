import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-panel ${className}`}>{children}</section>;
}

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums text-ink">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-muted">{hint}</div>}
    </div>
  );
}

type Tone = 'ok' | 'bad' | 'warn' | 'off' | 'neutral';
const TONES: Record<Tone, string> = {
  ok: 'bg-ok/15 text-ok ring-ok/30',
  bad: 'bg-bad/15 text-bad ring-bad/30',
  warn: 'bg-warn/15 text-warn ring-warn/30',
  off: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
  neutral: 'bg-slate-500/10 text-muted ring-line',
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-slate-700/40 ${className}`} />;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retrying = false,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <div className="text-sm font-semibold text-ink">{title}</div>
      {message && <div className="max-w-xs text-xs text-muted">{message}</div>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-1 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-white/5 disabled:opacity-50"
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <div className="text-sm font-semibold text-ink">{title}</div>
      {message && <div className="mt-1 text-xs text-muted">{message}</div>}
    </div>
  );
}
