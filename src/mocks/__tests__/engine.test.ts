import { describe, expect, it } from 'vitest';
import split from '../../../ml/split.json';
import { STATIONS, frameAt, hash01, latestFrame, stationStatus } from '../engine';

describe('hash01', () => {
  it('is deterministic and stays in [0, 1)', () => {
    expect(hash01('x')).toBe(hash01('x'));
    for (let i = 0; i < 500; i++) {
      const v = hash01(`k${i}`);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('gives adjacent ticks different values', () => {
    expect(hash01('st-1:1000')).not.toBe(hash01('st-1:1001'));
  });
});

describe('outage cycle', () => {
  it('takes one station offline for 20 s, degraded for 15 s, every 120 s', () => {
    const tick = 120 * 8; // cycle 8 -> station index 0
    expect(stationStatus('st-1', tick)).toBe('offline');
    expect(stationStatus('st-1', tick + 19)).toBe('offline');
    expect(stationStatus('st-1', tick + 20)).toBe('degraded');
    expect(stationStatus('st-1', tick + 35)).toBe('online');
    expect(stationStatus('st-2', tick)).toBe('online');
  });
  it('never has two stations offline at once', () => {
    for (let t = 0; t < 960; t++) {
      const off = STATIONS.filter((s) => stationStatus(s.id, t) === 'offline').length;
      expect(off).toBeLessThanOrEqual(1);
    }
  });
});

describe('frames', () => {
  it('returns null while offline and a stable frame otherwise', () => {
    const off = 120 * 8;
    expect(frameAt('st-1', off, '/')).toBeNull();
    const a = frameAt('st-1', off + 50, '/');
    expect(a).toEqual(frameAt('st-1', off + 50, '/'));
    expect(a?.imageUrl.startsWith('/frames/')).toBe(true);
  });
  it('walks back over an outage to the last good frame', () => {
    const f = latestFrame('st-1', 120 * 8 + 5, '/');
    expect(f).not.toBeNull();
    expect(Number(f!.id.split('_')[1])).toBeLessThan(120 * 8);
  });
});

describe('detections are real model output on held-out frames', () => {
  const held = new Set(split.val);
  const frames = Array.from({ length: 300 }, (_, t) => frameAt('st-2', 1_000_000 + t, '/')).filter(
    (f) => f !== null,
  );

  it('only ever shows frames the model never trained on', () => {
    expect(frames.length).toBeGreaterThan(0);
    for (const f of frames) {
      const name = f.imageUrl.split('/').pop()!.replace('.jpg', '');
      expect(held.has(name)).toBe(true);
    }
  });
  it('keeps confidences within the stored range and sorted high to low', () => {
    for (const f of frames) {
      const conf = f.detections.map((d) => d.confidence);
      expect(conf.every((c) => c >= 0.25 && c <= 1)).toBe(true);
      expect([...conf].sort((a, b) => b - a)).toEqual(conf);
    }
  });
  it('replays the same detections for the same frame every time', () => {
    expect(frameAt('st-3', 1_234_567, '/')).toEqual(frameAt('st-3', 1_234_567, '/'));
  });
});
