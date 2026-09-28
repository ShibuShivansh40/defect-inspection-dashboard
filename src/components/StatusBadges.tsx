import type { StationStatus } from '../types';
import { Badge } from './ui';

const DOT: Record<StationStatus, string> = {
  online: 'bg-ok',
  degraded: 'bg-warn',
  offline: 'bg-slate-400',
};

export function StatusBadge({
  status,
  latencyMs,
}: {
  status: StationStatus | undefined;
  latencyMs?: number;
}) {
  if (!status) return <Badge tone="neutral">…</Badge>;
  const tone = status === 'online' ? 'ok' : status === 'degraded' ? 'warn' : 'off';
  return (
    <Badge tone={tone}>
      <span aria-hidden className={`size-1.5 rounded-full ${DOT[status]}`} />
      {status === 'offline'
        ? 'Offline'
        : `${status === 'degraded' ? 'Degraded' : 'Online'} · ${latencyMs ?? '–'} ms`}
    </Badge>
  );
}

/** Text and colour, so the verdict never relies on colour alone. */
export function VerdictBadge({ verdict }: { verdict: 'pass' | 'fail' }) {
  return verdict === 'pass' ? <Badge tone="ok">✓ PASS</Badge> : <Badge tone="bad">✕ FAIL</Badge>;
}
