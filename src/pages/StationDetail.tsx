import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { FrameCanvas } from '../components/FrameCanvas';
import { StatusBadge, VerdictBadge } from '../components/StatusBadges';
import { ThresholdSlider } from '../components/ThresholdSlider';
import { Card, EmptyState, ErrorState, Skeleton } from '../components/ui';
import { useFrames, useLatestFrame, useStations } from '../hooks/queries';
import { useVerdict } from '../hooks/verdict';
import { CLASS_COLORS, CLASS_LABELS, pct, timeOf } from '../lib/format';
import { useUi } from '../store/ui';

const HISTORY = 50;

export default function StationDetail() {
  const { id = '' } = useParams();
  const stations = useStations();
  const station = stations.data?.find((s) => s.id === id);

  if (stations.data && !station) {
    return (
      <div className="px-4 py-10">
        <EmptyState title="Unknown station" message={`No camera with id “${id}”.`} />
        <p className="text-center">
          <Link to="/" className="text-sm text-accent hover:underline">
            ← Back to live line
          </Link>
        </p>
      </div>
    );
  }
  return <Detail key={id} id={id} />;
}

function Detail({ id }: { id: string }) {
  const [live, setLive] = useState(true);
  const [idx, setIdx] = useState(0);
  const threshold = useUi((s) => s.threshold);

  const stations = useStations();
  const station = stations.data?.find((s) => s.id === id);
  const latest = useLatestFrame(id);
  const history = useFrames(id, HISTORY, live);
  const frames = history.data ?? [];

  const frame = live ? (latest.data ?? frames.at(-1)) : frames[Math.min(idx, frames.length - 1)];
  const verdict = useVerdict(frame);
  const sliderValue = live ? Math.max(0, frames.length - 1) : idx;

  const scrubTo = (i: number) => {
    setLive(false);
    setIdx(Math.max(0, Math.min(frames.length - 1, i)));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link to="/" className="text-sm text-muted hover:text-ink">
          ← Live line
        </Link>
        <h1 className="text-lg font-semibold text-ink">{station?.name ?? id}</h1>
        <StatusBadge status={station?.status} latencyMs={station?.latencyMs} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_1fr]">
        <Card className="overflow-hidden">
          <div className="relative">
            {frame ? (
              <FrameCanvas frame={frame} />
            ) : latest.isError && history.isError ? (
              <div className="flex aspect-square items-center justify-center">
                <ErrorState
                  message="No frames from this camera."
                  onRetry={() => {
                    latest.refetch();
                    history.refetch();
                  }}
                />
              </div>
            ) : (
              <Skeleton className="aspect-square w-full rounded-none" />
            )}
            {live && station?.status === 'offline' && frame && (
              <div className="absolute inset-x-0 top-0 bg-black/60 px-3 py-1.5 text-center text-xs text-white">
                Camera offline · showing last frame
              </div>
            )}
          </div>

          <div className="space-y-3 p-3">
            <div className="flex items-center justify-between gap-2">
              {verdict ? <VerdictBadge verdict={verdict} /> : <Skeleton className="h-5 w-14" />}
              <span className="text-xs tabular-nums text-muted">
                {frame ? `${timeOf(frame.capturedAt)} · ${frame.id}` : '—'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrubTo(sliderValue - 1)}
                disabled={frames.length === 0 || sliderValue === 0}
                className="rounded-md border border-line px-2 py-1 text-xs text-ink disabled:opacity-40"
                aria-label="Previous frame"
              >
                ◀
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(0, frames.length - 1)}
                value={sliderValue}
                onChange={(e) => scrubTo(Number(e.target.value))}
                disabled={frames.length === 0}
                aria-label={`Frame history, last ${HISTORY} frames`}
                aria-valuetext={frame ? `Frame at ${timeOf(frame.capturedAt)}` : undefined}
                className="w-full accent-accent"
              />
              <button
                type="button"
                onClick={() => scrubTo(sliderValue + 1)}
                disabled={frames.length === 0 || sliderValue >= frames.length - 1}
                className="rounded-md border border-line px-2 py-1 text-xs text-ink disabled:opacity-40"
                aria-label="Next frame"
              >
                ▶
              </button>
              <button
                type="button"
                onClick={() => setLive(true)}
                aria-pressed={live}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${
                  live ? 'bg-bad/20 text-bad' : 'border border-line text-ink hover:bg-ink/5'
                }`}
              >
                {live ? '● LIVE' : 'Go live'}
              </button>
            </div>
            <ThresholdSlider />
          </div>
        </Card>

        <Card className="p-3">
          <h2 className="mb-2 text-sm font-semibold text-ink">Detections</h2>
          {!frame ? (
            <Skeleton className="h-24 w-full" />
          ) : frame.detections.length === 0 ? (
            <EmptyState title="No defects in this frame" message="The part passed inspection." />
          ) : (
            <ul className="divide-y divide-line">
              {frame.detections.map((d) => {
                const hidden = d.confidence < threshold;
                return (
                  <li
                    key={d.id}
                    className={`flex items-center gap-3 py-2 text-sm ${hidden ? 'opacity-40' : ''}`}
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ background: CLASS_COLORS[d.cls] }}
                    />
                    <span className="flex-1 text-ink">{CLASS_LABELS[d.cls]}</span>
                    <span className="tabular-nums text-muted">
                      {d.box.w}×{d.box.h}px
                    </span>
                    <span className="w-12 text-right font-semibold tabular-nums text-ink">
                      {pct(d.confidence, 0)}
                    </span>
                    {hidden && <span className="text-xs text-muted">below threshold</span>}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">
            {live
              ? 'Following the camera live. Drag the scrubber to pause and step through the last 50 frames.'
              : `Paused on frame ${idx + 1} of ${frames.length}. Press “Go live” to resume.`}
          </p>
        </Card>
      </div>
    </div>
  );
}
