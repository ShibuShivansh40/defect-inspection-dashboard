import { memo } from 'react';
import { Link } from 'react-router';
import { useLatestFrame } from '../hooks/queries';
import { useVerdict } from '../hooks/verdict';
import { timeOf } from '../lib/format';
import type { StationStatus } from '../types';
import { FrameCanvas } from './FrameCanvas';
import { StatusBadge, VerdictBadge } from './StatusBadges';
import { Card, ErrorState, Skeleton } from './ui';

interface Props {
  stationId: string;
  name: string;
  status: StationStatus | undefined;
  latencyMs: number | undefined;
}

/** One camera tile on the Live Line. Owns its own polling query. */
export const StationCard = memo(function StationCard({ stationId, name, status, latencyMs }: Props) {
  const { data: frame, isPending, isError, error, refetch, isFetching } = useLatestFrame(stationId);
  const verdict = useVerdict(frame);
  const offline = status === 'offline' || (isError && !frame);

  return (
    <Card className="flex flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <Link
          to={`/stations/${stationId}`}
          className="truncate text-sm font-semibold text-ink hover:text-accent focus-visible:text-accent"
        >
          {name}
        </Link>
        <StatusBadge status={offline ? 'offline' : status} latencyMs={latencyMs} />
      </header>

      <div className="relative">
        {isPending ? (
          <Skeleton className="aspect-square w-full rounded-none" />
        ) : frame ? (
          <Link to={`/stations/${stationId}`} aria-label={`Open ${name}`}>
            <FrameCanvas frame={frame} className={offline ? 'opacity-40 grayscale' : ''} />
          </Link>
        ) : (
          <div className="flex aspect-square items-center justify-center bg-slate-900">
            <ErrorState
              title="No signal"
              message={error instanceof Error ? error.message : undefined}
              onRetry={() => refetch()}
              retrying={isFetching}
            />
          </div>
        )}
        {offline && frame && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 text-center">
            <span className="text-sm font-semibold text-ink">Camera offline</span>
            <span className="text-xs text-muted">Showing last frame · reconnecting</span>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted">
        {verdict ? <VerdictBadge verdict={verdict} /> : <Skeleton className="h-5 w-14" />}
        <span className="tabular-nums">{frame ? timeOf(frame.capturedAt) : '—'}</span>
      </footer>
    </Card>
  );
});
