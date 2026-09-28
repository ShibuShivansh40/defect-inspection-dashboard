import { StationCard } from '../components/StationCard';
import { ThresholdSlider } from '../components/ThresholdSlider';
import { ErrorState } from '../components/ui';
import { useStations } from '../hooks/queries';
import type { Station } from '../types';

export default function LiveLine() {
  const { data: stations, isError, refetch, isFetching } = useStations();

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Live line</h1>
          <p className="text-sm text-muted">Latest frame from each camera, refreshed every second.</p>
        </div>
        <ThresholdSlider className="sm:w-80" />
      </div>

      {isError && !stations ? (
        <ErrorState
          title="Can't reach the line controller"
          message="Station list failed to load."
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(stations ?? PLACEHOLDER).map((s) => (
            <StationCard
              key={s.id}
              stationId={s.id}
              name={s.name}
              status={s.status}
              latencyMs={s.latencyMs}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Station ids are known up front, so cards (and their frame queries) start before the list loads.
const PLACEHOLDER: Array<Pick<Station, 'id' | 'name'> & Partial<Station>> = [
  { id: 'st-1', name: 'Line 1 · Cam A' },
  { id: 'st-2', name: 'Line 1 · Cam B' },
  { id: 'st-3', name: 'Line 2 · Cam A' },
  { id: 'st-4', name: 'Line 2 · Cam B' },
];
