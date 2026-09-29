/**
 * Deterministic simulation of a 4-camera inspection line.
 *
 * Which frame each camera "captures" at a given second is derived from (stationId, tick), where
 * tick = whole seconds since epoch, so a reload shows the same frames and history. The detections
 * on each frame are real predictions from a YOLOv8n model (see ml/), replayed from predictions.json.
 * Only frames the model never trained on are used. No state is stored except incremental caches
 * for the shift aggregates.
 */
import manifestJson from './manifest.json';
import predictionsJson from './predictions.json';
import {
  DEFECT_CLASSES,
  type DefectClass,
  type DefectRow,
  type Detection,
  type Frame,
  type ManifestEntry,
  type Station,
  type Stats,
} from '../types';

const allFrames = manifestJson as ManifestEntry[];
const predictions = predictionsJson.frames as Record<
  string,
  Array<{ cls: DefectClass; confidence: number; x: number; y: number; w: number; h: number }>
>;
/** The line only sees held-out frames, so the shown detections are honest out-of-sample results. */
const manifest = allFrames.filter((e) => e.id in predictions);
export const MODEL_INFO = predictionsJson.model;

/** Shift totals and the defect log count detections at or above this confidence (the line's operating point). */
export const OPERATING_CONFIDENCE = 0.5;

export const STATIONS = [
  { id: 'st-1', name: 'Line 1 · Cam A' },
  { id: 'st-2', name: 'Line 1 · Cam B' },
  { id: 'st-3', name: 'Line 2 · Cam A' },
  { id: 'st-4', name: 'Line 2 · Cam B' },
] as const;

const OUTAGE_CYCLE_S = 120; // one station drops out every 2 minutes...
const OUTAGE_LEN_S = 20; // ...for 20 seconds
const DEGRADED_LEN_S = 15; // then runs slow while it recovers
export const SHIFT_LEN_S = 8 * 3600;

/** FNV-1a 32-bit hash with a murmur3 finaliser (so adjacent ticks differ), mapped to [0, 1). */
export function hash01(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const nowTick = () => Math.floor(Date.now() / 1000);
export const shiftStart = (tick: number) => Math.floor(tick / SHIFT_LEN_S) * SHIFT_LEN_S;

const stationIndex = (stationId: string) => STATIONS.findIndex((s) => s.id === stationId);
export const isKnownStation = (stationId: string) => stationIndex(stationId) !== -1;

export function stationStatus(stationId: string, tick: number): Station['status'] {
  const idx = stationIndex(stationId);
  const cycle = Math.floor(tick / OUTAGE_CYCLE_S);
  const intoCycle = tick % OUTAGE_CYCLE_S;
  if (cycle % STATIONS.length !== idx) return 'online';
  if (intoCycle < OUTAGE_LEN_S) return 'offline';
  if (intoCycle < OUTAGE_LEN_S + DEGRADED_LEN_S) return 'degraded';
  return 'online';
}

export function getStations(tick: number): Station[] {
  return STATIONS.map((s, i) => {
    const status = stationStatus(s.id, tick);
    // Latency drifts smoothly per station; degraded stations are slow.
    const base = 35 + 20 * Math.sin(tick / 17 + i * 1.7) + 10 * hash01(`${s.id}:${tick}`);
    const latencyMs = status === 'offline' ? 0 : Math.round(status === 'degraded' ? base + 260 : base);
    return { ...s, status, latencyMs, fps: status === 'offline' ? 0 : 1 };
  });
}

export const frameId = (stationId: string, tick: number) => `${stationId}_${tick}`;

export function parseFrameId(id: string): { stationId: string; tick: number } | null {
  const m = /^(st-\d+)_(\d+)$/.exec(id);
  if (!m || !isKnownStation(m[1])) return null;
  return { stationId: m[1], tick: Number(m[2]) };
}

/** The frame a station produced at a tick, or null if it was offline. */
export function frameAt(stationId: string, tick: number, baseUrl: string): Frame | null {
  if (stationStatus(stationId, tick) === 'offline') return null;
  const id = frameId(stationId, tick);
  const entry = manifest[Math.floor(hash01(`img:${id}`) * manifest.length)];
  // Real model output for this image, highest confidence first.
  const detections: Detection[] = predictions[entry.id].map((p, i) => ({
    id: `${id}_${i}`,
    cls: p.cls,
    confidence: p.confidence,
    box: { x: p.x, y: p.y, w: p.w, h: p.h },
  }));
  return {
    id,
    stationId,
    imageUrl: `${baseUrl}frames/${entry.file}`,
    width: entry.width,
    height: entry.height,
    capturedAt: new Date(tick * 1000).toISOString(),
    detections,
  };
}

/** Latest frame a station produced up to and including `tick` (walks back over an outage). */
export function latestFrame(stationId: string, tick: number, baseUrl: string): Frame | null {
  for (let t = tick; t > tick - OUTAGE_LEN_S - 2; t--) {
    const f = frameAt(stationId, t, baseUrl);
    if (f) return f;
  }
  return null;
}

export function recentFrames(stationId: string, tick: number, limit: number, baseUrl: string) {
  const out: Frame[] = [];
  for (let t = tick; out.length < limit && t > tick - limit * 3; t--) {
    const f = frameAt(stationId, t, baseUrl);
    if (f) out.push(f);
  }
  return out.reverse(); // oldest -> newest
}

/* ---------- Shift aggregates (incrementally cached) ---------- */

interface ShiftCache {
  start: number;
  upTo: number; // last tick included
  inspected: number;
  defective: number;
  byClass: Record<DefectClass, number>;
  rows: DefectRow[]; // ascending by time
}

let cache: ShiftCache | null = null;

const emptyByClass = () =>
  Object.fromEntries(DEFECT_CLASSES.map((c) => [c, 0])) as Record<DefectClass, number>;

function shiftCache(tick: number, baseUrl: string): ShiftCache {
  const start = shiftStart(tick);
  if (!cache || cache.start !== start) {
    cache = { start, upTo: start - 1, inspected: 0, defective: 0, byClass: emptyByClass(), rows: [] };
  }
  for (let t = cache.upTo + 1; t <= tick; t++) {
    for (const s of STATIONS) {
      const f = frameAt(s.id, t, baseUrl);
      if (!f) continue;
      cache.inspected++;
      const counted = f.detections.filter((d) => d.confidence >= OPERATING_CONFIDENCE);
      if (counted.length) cache.defective++;
      for (const d of counted) {
        cache.byClass[d.cls]++;
        cache.rows.push({ ...d, frameId: f.id, stationId: f.stationId, capturedAt: f.capturedAt });
      }
    }
  }
  cache.upTo = tick;
  return cache;
}

export function getStats(tick: number, baseUrl: string): Stats & { shiftStartedAt: string } {
  const c = shiftCache(tick, baseUrl);
  return {
    inspected: c.inspected,
    defective: c.defective,
    defectRate: c.inspected ? c.defective / c.inspected : 0,
    byClass: { ...c.byClass },
    shiftStartedAt: new Date(c.start * 1000).toISOString(),
  };
}

export interface DefectQuery {
  cls: DefectClass[];
  stationId: string | null;
  from: number | null; // ms
  to: number | null; // ms
  page: number;
  pageSize: number;
}

export function queryDefects(tick: number, q: DefectQuery, baseUrl: string) {
  const { rows } = shiftCache(tick, baseUrl);
  const clsSet = q.cls.length ? new Set(q.cls) : null;
  const matches: DefectRow[] = [];
  // Newest first.
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    const ts = Date.parse(r.capturedAt);
    if (q.to !== null && ts > q.to) continue;
    if (q.from !== null && ts < q.from) break; // rows are time-ordered
    if (clsSet && !clsSet.has(r.cls)) continue;
    if (q.stationId && r.stationId !== q.stationId) continue;
    matches.push(r);
  }
  const startIdx = (q.page - 1) * q.pageSize;
  return { items: matches.slice(startIdx, startIdx + q.pageSize), total: matches.length };
}
