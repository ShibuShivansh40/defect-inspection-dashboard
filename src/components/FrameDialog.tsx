import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useFrame } from '../hooks/queries';
import { CLASS_LABELS, pct, timeOf } from '../lib/format';
import type { DefectRow } from '../types';
import { FrameCanvas } from './FrameCanvas';
import { ErrorState, Skeleton } from './ui';

/** Modal showing the frame a logged defect came from, with that box highlighted. */
export function FrameDialog({ row, onClose }: { row: DefectRow | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { data: frame, isPending, isError, refetch, isFetching } = useFrame(row?.frameId ?? null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (row && !d.open) d.showModal();
    if (!row && d.open) d.close();
  }, [row]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()} // backdrop click
      aria-labelledby="frame-dialog-title"
      className="m-auto w-[min(92vw,520px)] rounded-xl border border-line bg-panel p-0 text-ink backdrop:bg-black/70"
    >
      {row && (
        <div className="p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="frame-dialog-title" className="text-sm font-semibold">
                {CLASS_LABELS[row.cls]} · {pct(row.confidence, 0)}
              </h2>
              <p className="text-xs text-muted">
                {row.stationId.replace('st-', 'Station ')} · {timeOf(row.capturedAt)} · {row.frameId}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm text-muted hover:bg-ink/5 hover:text-ink"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="overflow-hidden rounded-lg">
            {frame ? (
              <FrameCanvas frame={frame} highlightId={row.id} showAll />
            ) : isError ? (
              <ErrorState
                message="Couldn't load this frame."
                onRetry={() => refetch()}
                retrying={isFetching}
              />
            ) : isPending ? (
              <Skeleton className="aspect-square w-full" />
            ) : null}
          </div>
          <div className="mt-3 flex justify-between text-xs text-muted">
            <span>
              Box {row.box.w}×{row.box.h}px at ({row.box.x}, {row.box.y})
            </span>
            <Link to={`/stations/${row.stationId}`} className="text-accent hover:underline">
              Open station →
            </Link>
          </div>
        </div>
      )}
    </dialog>
  );
}
