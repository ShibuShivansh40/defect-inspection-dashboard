import { useStations, useStats } from '../hooks/queries';
import { CLASS_COLORS, CLASS_LABELS, clockOf, num, pct } from '../lib/format';
import { DEFECT_CLASSES } from '../types';
import { StatusBadge } from './StatusBadges';
import { Skeleton, StatTile } from './ui';

/** Shift-level numbers and station health, shown on every page. */
export function StatsHeader() {
  const stats = useStats();
  const stations = useStations();
  const s = stats.data;
  const maxClass = s ? Math.max(1, ...Object.values(s.byClass)) : 1;
  const online = stations.data?.filter((st) => st.status !== 'offline').length;

  return (
    <div className="border-b border-line bg-panel/60 px-4 py-3 lg:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-3 gap-4 sm:flex sm:gap-10">
          {s ? (
            <>
              <StatTile
                label="Inspected"
                value={num(s.inspected)}
                hint={`since ${clockOf(s.shiftStartedAt)}`}
              />
              <StatTile label="Defective" value={num(s.defective)} hint="frames" />
              <StatTile
                label="Defect rate"
                value={<span className="text-bad">{pct(s.defectRate)}</span>}
                hint="this shift"
              />
            </>
          ) : stats.isError ? (
            <div className="col-span-3 text-xs text-muted">
              Stats unavailable.{' '}
              <button className="underline" onClick={() => stats.refetch()}>
                Retry
              </button>
            </div>
          ) : (
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12 w-24" />)
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" aria-label="Station health">
          <span className="text-[11px] font-medium tracking-wide text-muted uppercase">
            Stations {online !== undefined && `${online}/${stations.data?.length}`}
          </span>
          {stations.data?.map((st) => (
            <span key={st.id} className="flex items-center gap-1" title={st.name}>
              <span className="text-xs text-muted">{st.id.replace('st-', 'S')}</span>
              <StatusBadge status={st.status} latencyMs={st.latencyMs} />
            </span>
          )) ?? <Skeleton className="h-5 w-48" />}
        </div>
      </div>

      <ul
        aria-label="Defects by class this shift"
        className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-6"
      >
        {DEFECT_CLASSES.map((c) => (
          <li key={c} className="min-w-0 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-muted">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-sm"
                  style={{ background: CLASS_COLORS[c] }}
                />
                <span className="truncate">{CLASS_LABELS[c]}</span>
              </span>
              <span className="tabular-nums text-ink">{s ? num(s.byClass[c]) : '–'}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-700/50">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: s ? `${(s.byClass[c] / maxClass) * 100}%` : 0, background: CLASS_COLORS[c] }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
